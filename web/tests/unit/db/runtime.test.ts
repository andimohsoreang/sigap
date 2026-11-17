import { readFileSync } from 'node:fs';
import path from 'node:path';

import { eq, sql } from 'drizzle-orm';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Outbox, idempotency key, dan pg-boss terhadap contact_center_dev lokal (CI: job paritas), di skema sementara per
// proses: cc_uji_rt_<pid> (tabel cc_* hasil migrasi drizzle-cc) dan cc_uji_boss_<pid> (pg-boss). Migrasi dijalankan
// sebagai cc_migrate persis seperti service `migrate`; aplikasi & worker sebagai cc_app (DML saja).
// Tanpa PostgreSQL → dilewati, kecuali CC_TEST_DB=1 / CI=true (gagal). CC_TEST_DB=0 → selalu dilewati.

const SKEMA = `cc_uji_rt_${process.pid}`;
const SKEMA_BOSS = `cc_uji_boss_${process.pid}`;
const URL_MIGRATE = 'postgres://cc_migrate@127.0.0.1:5432/contact_center_dev';
const URL_APP = `postgres://cc_app@127.0.0.1:5432/contact_center_dev?options=${encodeURIComponent(`-c search_path=${SKEMA}`)}`;
const URL_BOSS = 'postgres://cc_app@127.0.0.1:5432/contact_center_dev';

async function cekDb(): Promise<string | null> {
    const c = new pg.Client({ connectionString: URL_MIGRATE, connectionTimeoutMillis: 2000 });
    try {
        await c.connect();
        return null;
    } catch (e) {
        return `PostgreSQL lokal contact_center_dev tidak terjangkau (${(e as Error).message})`;
    } finally {
        await c.end().catch(() => {});
    }
}

const diminta = process.env.CC_TEST_DB === '1' || (process.env.CI === 'true' && process.env.CC_TEST_DB !== '0');
const alasan = process.env.CC_TEST_DB === '0' ? 'CC_TEST_DB=0' : await cekDb();

describe.runIf(diminta && alasan)('runtime DB (CC_TEST_DB=1)', () => {
    it('membutuhkan PostgreSQL lokal', () => expect.fail(`${alasan}`));
});

describe.skipIf(!!alasan)(`runtime DB${alasan ? ` — dilewati: ${alasan}` : ''}`, { timeout: 30_000 }, async () => {
    vi.stubEnv('DATABASE_URL', URL_APP);
    vi.stubEnv('VALKEY_URL', '');
    const { db, transaksi, tutupDb } = await import('@/server/db/client');
    const { ccIdempotency, ccOutbox } = await import('@/server/db/schema-cc');
    const { enqueueOutbox, idJobOutbox, kirimOutbox, MAKS_PERCOBAAN } = await import('@/server/outbox');
    const { denganIdempotensi, hashPermintaan, MAKS_BODY_TERSIMPAN } = await import('@/server/idempotensi');
    const { terapkanMigrasi } = await import('@/server/migrasi');
    const { siaran } = await import('@/server/realtime/kanal');
    const { JADWAL, JADWAL_CC } = await import('@/server/antrean');
    const { buatBoss } = await import('@/worker/boss');
    const { pasangJadwal } = await import('@/worker/jadwal');

    const migrate = new pg.Client({ connectionString: URL_MIGRATE });
    const mentah = async (q: string) => (await migrate.query(q)).rows;
    const migrasi = () => terapkanMigrasi({ url: URL_MIGRATE, folder: path.resolve('drizzle-cc'), skema: SKEMA, skemaBoss: SKEMA_BOSS });

    beforeAll(async () => {
        await migrate.connect();
        await mentah(`DROP SCHEMA IF EXISTS ${SKEMA} CASCADE; DROP SCHEMA IF EXISTS ${SKEMA_BOSS} CASCADE; CREATE SCHEMA ${SKEMA}`);
        // drizzle-cc/0002 menambah indeks di tabel Laravel `tickets` (di stack uji sudah dimuat init.sh sebelum migrasi).
        await mentah(`CREATE TABLE ${SKEMA}.tickets (LIKE public.tickets INCLUDING ALL)`);
        await migrasi();
        // Tabel Laravel yang dibaca dispatcher (chat.unread) — id eksplisit, tanpa sequence public.
        await mentah(`CREATE TABLE ${SKEMA}.chat_conversations (LIKE public.chat_conversations INCLUDING DEFAULTS)`);
        // Di public hak DML cc_app datang dari default privileges cc_migrate (uji/init.sh); skema uji diberi manual.
        await mentah(`GRANT USAGE ON SCHEMA ${SKEMA} TO cc_app;
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${SKEMA} TO cc_app;
            GRANT USAGE ON ALL SEQUENCES IN SCHEMA ${SKEMA} TO cc_app`);
    });

    afterAll(async () => {
        await tutupDb();
        await mentah(`DROP SCHEMA IF EXISTS ${SKEMA} CASCADE; DROP SCHEMA IF EXISTS ${SKEMA_BOSS} CASCADE`);
        await migrate.end();
        vi.unstubAllEnvs();
    });

    const kosongkanOutbox = () => db.delete(ccOutbox);

    it('migrasi idempoten dan cc_app tidak punya DDL', async () => {
        await migrasi();
        // Satu baris per berkas migrasi drizzle-cc (bertambah tiap paket menambah tabel).
        const jumlah = JSON.parse(readFileSync(path.resolve('drizzle-cc/meta/_journal.json'), 'utf8')).entries.length;
        expect(await mentah(`SELECT count(*)::int AS n FROM ${SKEMA}.cc_migrasi`)).toEqual([{ n: jumlah }]);
        const app = new pg.Client({ connectionString: URL_BOSS });
        await app.connect();
        try {
            await expect(app.query(`CREATE TABLE ${SKEMA_BOSS}.coba (x int)`)).rejects.toThrow(/permission denied/);
        } finally {
            await app.end();
        }
    });

    describe('outbox', () => {
        const job = (data: object, agregat?: string) => ({ jenis: 'job' as const, antrean: 'default', data, agregat });

        it('hanya pesan dari transaksi yang commit yang masuk outbox', async () => {
            await kosongkanOutbox();
            await transaksi((tx) => enqueueOutbox(tx, job({ n: 1 }), { jenis: 'realtime', siaran: siaran.chatUnreadChanged(5) }));
            await transaksi(async (tx) => {
                await enqueueOutbox(tx, job({ n: 2 }));
                throw new Error('batal');
            }).catch(() => {});
            const baris = await db
                .select({ kind: ccOutbox.kind, topic: ccOutbox.topic, payload: ccOutbox.payload })
                .from(ccOutbox)
                .orderBy(ccOutbox.id);
            expect(baris).toEqual([
                { kind: 'job', topic: 'default', payload: { n: 1 } },
                { kind: 'realtime', topic: 'chat.unread', payload: { kanal: ['private-admin.chat'], data: { conversation_id: 5 } } },
            ]);
        });

        it('urutan per agregat: pesan berikutnya menunggu pendahulunya; agregat lain tidak tertahan', async () => {
            await kosongkanOutbox();
            await transaksi((tx) => enqueueOutbox(tx, job({ n: 'A1' }, 'a'), job({ n: 'A2' }, 'a'), job({ n: 'B1' }, 'b'), job({ n: 'X' })));
            const dikirim: string[] = [];
            let gagalkanA1 = true;
            const penerbit = {
                job: async (_: string, d: object) => {
                    const n = (d as { n: string }).n;
                    if (n === 'A1' && gagalkanA1) throw new Error('Sockudo 503');
                    dikirim.push(n);
                },
                realtime: async () => {},
            };
            expect(await kirimOutbox(db, penerbit)).toBe(3); // A1, B1, X — A2 tertahan
            expect(dikirim.sort()).toEqual(['B1', 'X']);
            expect(await kirimOutbox(db, penerbit)).toBe(0); // A1 backoff, A2 masih tertahan

            gagalkanA1 = false;
            await db
                .update(ccOutbox)
                .set({ availableAt: sql`now()` })
                .where(sql`sent_at IS NULL`);
            await kirimOutbox(db, penerbit);
            await kirimOutbox(db, penerbit);
            expect(dikirim).toEqual(['B1', 'X', 'A1', 'A2']);
            const [a1] = await db
                .select()
                .from(ccOutbox)
                .where(sql`payload->>'n' = 'A1'`);
            expect(a1).toMatchObject({ attempts: 2, lastError: null });
            expect(a1.sentAt).toBeInstanceOf(Date);
        });

        it('menyerah setelah batas percobaan dan tidak lagi menahan agregat', async () => {
            await kosongkanOutbox();
            await transaksi((tx) => enqueueOutbox(tx, job({ n: 'racun' }, 'c'), job({ n: 'berikut' }, 'c')));
            await db
                .update(ccOutbox)
                .set({ attempts: MAKS_PERCOBAAN - 1 })
                .where(sql`payload->>'n' = 'racun'`);
            const dikirim: string[] = [];
            const penerbit = {
                job: async (_: string, d: object) => {
                    if ((d as { n: string }).n === 'racun') throw new Error('selalu gagal');
                    dikirim.push((d as { n: string }).n);
                },
                realtime: async () => {},
            };
            await kirimOutbox(db, penerbit);
            const [racun] = await db
                .select()
                .from(ccOutbox)
                .where(sql`payload->>'n' = 'racun'`);
            expect(racun.failedAt).toBeInstanceOf(Date);
            expect(racun.lastError).toBe('selalu gagal');
            await kirimOutbox(db, penerbit);
            expect(dikirim).toEqual(['berikut']);
        });

        // Penerbit yang menahan pengiriman sampai dilepas (meniru Sockudo lambat / worker macet).
        function penerbitTertahan() {
            const dikirim: string[] = [];
            let lepas!: () => void;
            const tahan = new Promise<void>((r) => (lepas = r));
            const penerbit = {
                job: async (_: string, d: object) => {
                    await tahan;
                    dikirim.push((d as { n: string }).n);
                },
                realtime: async () => {},
            };
            return { dikirim, lepas, penerbit };
        }
        const langsung = (dikirim: string[]) => ({
            job: async (_: string, d: object) => void dikirim.push((d as { n: string }).n),
            realtime: async () => {},
        });

        it('worker mati di antara kirim & tandai terkirim: setelah sewa habis pesan dikirim ulang', async () => {
            await kosongkanOutbox();
            await transaksi((tx) => enqueueOutbox(tx, job({ n: 'P' })));
            const macet = penerbitTertahan();
            const pertama = kirimOutbox(db, macet.penerbit); // diambil, belum ditandai
            await vi.waitFor(async () => expect((await db.select().from(ccOutbox))[0].attempts).toBe(1));
            // Sewa habis tanpa sent_at (worker pertama dianggap mati).
            await db.update(ccOutbox).set({ availableAt: sql`now()` });
            const ulang: string[] = [];
            expect(await kirimOutbox(db, langsung(ulang))).toBe(1);
            expect(ulang).toEqual(['P']);
            macet.lepas();
            await pertama;
            const [b] = await db.select().from(ccOutbox);
            expect(b.attempts).toBe(2);
            expect(b.sentAt).toBeInstanceOf(Date);
        });

        it('dua dispatcher pada agregat yang sama: A2 tidak diambil selama A1 disewa', async () => {
            await kosongkanOutbox();
            await transaksi((tx) => enqueueOutbox(tx, job({ n: 'A1' }, 'sama'), job({ n: 'A2' }, 'sama')));
            const d1 = penerbitTertahan();
            const jalan1 = kirimOutbox(db, d1.penerbit);
            await vi.waitFor(async () =>
                expect(
                    (
                        await db
                            .select()
                            .from(ccOutbox)
                            .where(sql`payload->>'n' = 'A1'`)
                    )[0].attempts,
                ).toBe(1),
            );
            const d2: string[] = [];
            expect(await kirimOutbox(db, langsung(d2))).toBe(0);
            d1.lepas();
            await jalan1;
            expect(await kirimOutbox(db, langsung(d2))).toBe(1);
            expect([...d1.dikirim, ...d2]).toEqual(['A1', 'A2']);
        });

        it('galat permanen (4xx, antrean tidak ada) langsung menyerah', async () => {
            await kosongkanOutbox();
            await transaksi((tx) => enqueueOutbox(tx, job({ n: 'x' }, 'p'), job({ n: 'y' }, 'p')));
            const dikirim: string[] = [];
            const penerbit = {
                job: async (_: string, d: object) => {
                    if ((d as { n: string }).n === 'x')
                        throw Object.assign(new Error('Queue default does not exist'), { code: 'PGBOSS_QUEUE_NOT_FOUND' });
                    dikirim.push((d as { n: string }).n);
                },
                realtime: async () => {},
            };
            await kirimOutbox(db, penerbit);
            const [x] = await db
                .select()
                .from(ccOutbox)
                .where(sql`payload->>'n' = 'x'`);
            expect(x).toMatchObject({ attempts: 1, lastError: 'Queue default does not exist' });
            expect(x.failedAt).toBeInstanceOf(Date);
            await kirimOutbox(db, penerbit);
            expect(dikirim).toEqual(['y']);
        });

        it('pesan racun yang membuat worker mati berulang (sewa habis 10 kali) dihentikan', async () => {
            await kosongkanOutbox();
            await transaksi((tx) => enqueueOutbox(tx, job({ n: 'crash' }, 'r'), job({ n: 'sesudah' }, 'r')));
            await db
                .update(ccOutbox)
                .set({ attempts: MAKS_PERCOBAAN })
                .where(sql`payload->>'n' = 'crash'`);
            const dikirim: string[] = [];
            expect(await kirimOutbox(db, langsung(dikirim))).toBe(1);
            expect(dikirim).toEqual(['sesudah']);
            const [c] = await db
                .select()
                .from(ccOutbox)
                .where(sql`payload->>'n' = 'crash'`);
            expect(c.failedAt).toBeInstanceOf(Date);
            expect(c.lastError).toBe(`sewa habis ${MAKS_PERCOBAAN} kali tanpa hasil`);
        });

        it('chat.unread: total dihitung saat dikirim (setelah commit), bukan saat ditulis', async () => {
            await kosongkanOutbox();
            await mentah(`INSERT INTO ${SKEMA}.chat_conversations (id, unread_admin) VALUES (1, 2), (2, 0)`);
            await transaksi((tx) => enqueueOutbox(tx, { jenis: 'realtime', siaran: siaran.chatUnreadChanged(2) }));
            // Berubah setelah pesan ditulis: Laravel menghitung di queue, jadi yang terkirim nilai terbaru.
            await mentah(`UPDATE ${SKEMA}.chat_conversations SET unread_admin = 3 WHERE id = 2`);
            const terbit: unknown[] = [];
            await kirimOutbox(db, { job: async () => {}, realtime: async (s) => void terbit.push(s) });
            expect(terbit).toEqual([{ event: 'chat.unread', kanal: ['private-admin.chat'], data: { conversation_id: 2, total: 5 } }]);
        });

        it('dua dispatcher serentak tidak mengirim baris yang sama (SKIP LOCKED)', async () => {
            await kosongkanOutbox();
            await transaksi((tx) => enqueueOutbox(tx, ...Array.from({ length: 40 }, (_, i) => job({ n: i }))));
            const dikirim: number[] = [];
            const penerbit = {
                job: async (_: string, d: object) => {
                    await new Promise((r) => setTimeout(r, 5));
                    dikirim.push((d as { n: number }).n);
                },
                realtime: async () => {},
            };
            await Promise.all([kirimOutbox(db, penerbit, 25), kirimOutbox(db, penerbit, 25), kirimOutbox(db, penerbit, 25)]);
            expect(dikirim).toHaveLength(40);
            expect(new Set(dikirim).size).toBe(40);
        });
    });

    describe('idempotency key', () => {
        const opsi = (kunci: string, body: unknown = { judul: 'x' }) => ({ cakupan: 'uji', kunci, hash: hashPermintaan('POST', '/pengaduan', body) });

        it('kunci & isi sama → respons tersimpan, handler sekali; isi beda → 422', async () => {
            let dipanggil = 0;
            const fn = async () => ({ status: 201, body: { nomor: `TKT-${++dipanggil}` } });
            expect(await denganIdempotensi(opsi('k1'), fn)).toEqual({ status: 201, body: { nomor: 'TKT-1' }, diulang: false });
            expect(await denganIdempotensi(opsi('k1'), fn)).toEqual({ status: 201, body: { nomor: 'TKT-1' }, diulang: true });
            expect(await denganIdempotensi(opsi('k1', { judul: 'lain' }), fn)).toMatchObject({ status: 422, diulang: false });
            expect(dipanggil).toBe(1);
        });

        it('hash tidak bergantung urutan kunci objek', () => {
            expect(hashPermintaan({ a: 1, b: [{ y: 2, x: 1 }] })).toBe(hashPermintaan({ b: [{ x: 1, y: 2 }], a: 1 }));
            expect(hashPermintaan({ a: 1 })).not.toBe(hashPermintaan({ a: 2 }));
        });

        it('duplikat serentak diserialkan: handler sekali, semua mendapat respons yang sama', async () => {
            let dipanggil = 0;
            const fn = async () => {
                dipanggil++;
                await new Promise((r) => setTimeout(r, 200));
                return { status: 201, body: { ke: dipanggil } };
            };
            const hasil = await Promise.all(Array.from({ length: 4 }, () => denganIdempotensi(opsi('serentak'), fn)));
            expect(dipanggil).toBe(1);
            expect(hasil.map((h) => h.body)).toEqual(Array(4).fill({ ke: 1 }));
            expect(hasil.filter((h) => !h.diulang)).toHaveLength(1);
        });

        it('handler gagal → tidak ada yang tersimpan, tulisan handler ikut batal, kunci boleh dipakai lagi', async () => {
            await kosongkanOutbox();
            await expect(
                denganIdempotensi(opsi('gagal'), async (tx) => {
                    await enqueueOutbox(tx, { jenis: 'job', antrean: 'default', data: {} });
                    throw new Error('validasi');
                }),
            ).rejects.toThrow('validasi');
            expect(await db.select().from(ccIdempotency).where(eq(ccIdempotency.key, 'gagal'))).toEqual([]);
            expect(await db.select().from(ccOutbox)).toEqual([]);
            expect((await denganIdempotensi(opsi('gagal'), async () => ({ status: 200, body: null }))).diulang).toBe(false);
        });

        it('respons 5xx tidak disimpan dan tulisan handler dibatalkan; body > 64 KB ditolak', async () => {
            await kosongkanOutbox();
            const gagal = await denganIdempotensi(opsi('lima-ratus'), async (tx) => {
                await enqueueOutbox(tx, { jenis: 'job', antrean: 'default', data: {} });
                return { status: 503, body: { message: 'Layanan sibuk' } };
            });
            expect(gagal).toEqual({ status: 503, body: { message: 'Layanan sibuk' }, diulang: false });
            expect(await db.select().from(ccIdempotency).where(eq(ccIdempotency.key, 'lima-ratus'))).toEqual([]);
            expect(await db.select().from(ccOutbox)).toEqual([]);
            expect((await denganIdempotensi(opsi('lima-ratus'), async () => ({ status: 201, body: 1 }))).status).toBe(201);

            await expect(denganIdempotensi(opsi('besar'), async () => ({ status: 200, body: 'x'.repeat(MAKS_BODY_TERSIMPAN) }))).rejects.toThrow(
                /melebihi/,
            );
            expect(await db.select().from(ccIdempotency).where(eq(ccIdempotency.key, 'besar'))).toEqual([]);
        });

        it('kunci kedaluwarsa (24 jam) dipakai ulang dan bisa dibersihkan', async () => {
            const { bersihkanIdempotensi } = await import('@/server/idempotensi');
            await denganIdempotensi(opsi('lama'), async () => ({ status: 200, body: 1 }));
            const [baris] = await db.select().from(ccIdempotency).where(eq(ccIdempotency.key, 'lama'));
            expect(baris.expiresAt.getTime() - baris.createdAt.getTime()).toBe(24 * 3600 * 1000);
            await db
                .update(ccIdempotency)
                .set({ expiresAt: sql`now() - interval '1 second'` })
                .where(eq(ccIdempotency.key, 'lama'));
            expect(await denganIdempotensi(opsi('lama', { beda: true }), async () => ({ status: 200, body: 2 }))).toEqual({
                status: 200,
                body: 2,
                diulang: false,
            });
            await db
                .update(ccIdempotency)
                .set({ expiresAt: sql`now() - interval '1 second'` })
                .where(eq(ccIdempotency.key, 'lama'));
            expect(await bersihkanIdempotensi(db)).toBeGreaterThanOrEqual(1);
        });
    });

    describe('pg-boss sebagai cc_app (migrate:false)', () => {
        const boss = buatBoss(URL_BOSS, { schema: SKEMA_BOSS, max: 2, supervise: false });
        let hentiJadwal = () => {};
        beforeAll(async () => {
            await boss.start();
        });
        afterAll(async () => {
            hentiJadwal();
            await boss.stop({ graceful: false });
        });

        it('jadwal Laravel terdaftar dengan cron & zona Asia/Jakarta; jadwal usang dihapus', async () => {
            await boss.schedule('cek-portal', '*/5 * * * *', null, { tz: 'UTC', key: 'usang' });
            hentiJadwal = await pasangJadwal(boss);
            const jadwal = (await boss.getSchedules()).map((s) => [s.name, s.cron, s.timezone ?? s.options?.tz]);
            expect(jadwal.sort()).toEqual(
                [...JADWAL, ...JADWAL_CC]
                    .filter((j) => j.cron)
                    .map((j) => [j.nama, j.cron, 'Asia/Jakarta'])
                    .sort(),
            );
        });

        it('jadwal sub-menit: satu job per slot walau dikirim berulang (beberapa worker)', async () => {
            const kirim = () => boss.send('ai-macet', null, { singletonKey: 'ai-macet', singletonSeconds: 15 });
            const id = await Promise.all([kirim(), kirim(), kirim()]);
            expect(id.filter(Boolean)).toHaveLength(1);
        });

        it('outbox → pg-boss: id job turunan id outbox, kiriman ulang tidak membuat job ganda', async () => {
            await kosongkanOutbox();
            await transaksi((tx) => enqueueOutbox(tx, { jenis: 'job', antrean: 'ingest', data: { url: 'https://contoh.test' } }));
            const penerbit = { job: (a: string, d: object, id: string) => boss.send(a, d, { id }), realtime: async () => {} };
            await kirimOutbox(db, penerbit);
            const [baris] = await db.select().from(ccOutbox);
            // Simulasi worker mati setelah kirim, sebelum menandai terkirim.
            await db.update(ccOutbox).set({ sentAt: null, availableAt: sql`now()` });
            await kirimOutbox(db, penerbit);
            const job = await boss.findJobs('ingest', { id: idJobOutbox(baris.id) });
            expect(job).toHaveLength(1);
            expect(job[0].data).toEqual({ url: 'https://contoh.test' });
            expect(await mentah(`SELECT count(*)::int AS n FROM ${SKEMA_BOSS}.job WHERE name = 'ingest'`)).toEqual([{ n: 1 }]);
        });

        it('send → work selesai', async () => {
            const diterima = new Promise<unknown>((ok) => {
                void boss.work('default', { pollingIntervalSeconds: 0.5 }, async ([j]) => ok(j.data));
            });
            await boss.send('default', { halo: 'dunia' });
            expect(await diterima).toEqual({ halo: 'dunia' });
        });
    });
});
