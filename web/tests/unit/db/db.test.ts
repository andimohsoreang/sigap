import { eq } from 'drizzle-orm';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { fixture, kunciUji, type FixtureEnkripsi, type FixtureNik } from '../legacy/fixture';
import { cekLaravel, laravel, type EnvLaravel } from './laravel';

// Terhadap contact_center_dev lokal, di skema sementara `cc_uji_db_<pid>` (salinan struktur 4 tabel, dihapus sesudahnya):
// tidak ada baris yang tertinggal di public. Tanpa DB/PHP → dilewati, kecuali CC_TEST_DB=1 (`npm run test:db`) atau
// CI=true → wajib (gagal). CC_TEST_DB=0 → selalu dilewati (job `web` tanpa PostgreSQL; test DB jalan di paritas.yml).

// Per proses: worktree/CI paralel tidak saling DROP skema.
const SKEMA = `cc_uji_db_${process.pid}`;
const TABEL = ['users', 'tickets', 'chat_conversations', 'referrals'];
const URL_MIGRATE = 'postgres://cc_migrate@127.0.0.1:5432/contact_center_dev';
const URL_APP = `postgres://cc_app@127.0.0.1:5432/contact_center_dev?options=${encodeURIComponent(`-c search_path=${SKEMA}`)}`;

const fe = fixture<FixtureEnkripsi>('enkripsi.json');
const envLaravel: EnvLaravel = {
    skema: SKEMA,
    appKey: fe.app_key,
    appPreviousKeys: fe.app_previous_keys,
    nikHashKey: fixture<FixtureNik>('nik.json').kunci_nik.base64,
};

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
const dimatikan = process.env.CC_TEST_DB === '0';
const alasanDb = dimatikan ? 'CC_TEST_DB=0' : await cekDb();
const alasan = alasanDb ?? cekLaravel();

describe.runIf(diminta && alasan)('lapisan DB (CC_TEST_DB=1)', () => {
    it('membutuhkan PostgreSQL lokal, PHP, dan sigap/vendor', () => {
        expect.fail(`${alasan}`);
    });
});

describe.skipIf(!!alasanDb)(`lapisan DB${alasanDb ? ` — dilewati: ${alasanDb}; CC_TEST_DB=1 untuk mewajibkan` : ''}`, async () => {
    vi.stubEnv('DATABASE_URL', URL_APP);
    vi.stubEnv('APP_KEY', envLaravel.appKey);
    vi.stubEnv('APP_PREVIOUS_KEYS', envLaravel.appPreviousKeys);
    vi.stubEnv('NIK_HASH_KEY', envLaravel.nikHashKey);
    const { db, transaksi, kunciBaris, tutupDb, GalatUnik } = await import('@/server/db/client');
    const { users, tickets, chatConversations, referrals } = await import('@/server/db/schema');
    const { dariWib, denganNikHash, denganReporterNikHash, hashNikApp, keJsonLaravel } = await import('@/server/db/kolom');
    const { dekripsi } = await import('@/server/legacy/laravel-crypt');

    const migrate = new pg.Client({ connectionString: URL_MIGRATE });
    const mentah = async (sql: string) => (await migrate.query(sql)).rows;

    beforeAll(async () => {
        await migrate.connect();
        await mentah(`DROP SCHEMA IF EXISTS ${SKEMA} CASCADE; CREATE SCHEMA ${SKEMA}`);
        for (const t of TABEL) {
            // Sequence sendiri agar sequence public tidak ikut maju.
            await mentah(`CREATE TABLE ${SKEMA}.${t} (LIKE public.${t} INCLUDING ALL);
                CREATE SEQUENCE ${SKEMA}.${t}_id_seq OWNED BY ${SKEMA}.${t}.id;
                ALTER TABLE ${SKEMA}.${t} ALTER id SET DEFAULT nextval('${SKEMA}.${t}_id_seq')`);
        }
        await mentah(`GRANT USAGE ON SCHEMA ${SKEMA} TO cc_app;
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${SKEMA} TO cc_app;
            GRANT USAGE ON ALL SEQUENCES IN SCHEMA ${SKEMA} TO cc_app`);
    });

    afterAll(async () => {
        await tutupDb();
        await mentah(`DROP SCHEMA IF EXISTS ${SKEMA} CASCADE`);
        await migrate.end();
        vi.unstubAllEnvs();
    });

    const NIK = '3171234567890123';
    const KONTAK = '0812-3456-7890';

    describe.skipIf(!!alasan)(`round-trip Laravel${alasan ? ` — dilewati: ${alasan}` : ''}`, () => {
        it('Next membaca baris tulisan Laravel: jam WIB, NIK & kontak terdekripsi, hash NIK sama', { timeout: 60_000 }, async () => {
            // 23:59:59.999999 WIB: Laravel memotong ke detik, tetap tanggal 14.
            const id = laravel<Record<string, number>>(envLaravel, {
                aksi: 'tulis',
                sekarang: '2026-11-14 23:59:59.999999',
                nik: NIK,
                kontak: KONTAK,
                ticket_no: 'TKT-261114-LRVL01',
            });

            expect(await mentah(`SELECT created_at::text AS c FROM ${SKEMA}.users WHERE id = ${id.user}`)).toEqual([{ c: '2026-11-14 23:59:59' }]);
            const [u] = await db.select().from(users).where(eq(users.id, id.user));
            expect(u.createdAt?.toISOString()).toBe('2026-11-14T16:59:59.000Z');
            expect(keJsonLaravel(u.createdAt)).toBe('2026-11-14T16:59:59.000000Z');
            expect(u.nik).toBe(NIK);
            expect(u.nikHash).toBe(hashNikApp(NIK));

            const [t] = await db.select().from(tickets).where(eq(tickets.id, id.ticket));
            expect(t.reporterNik).toBe(NIK);
            expect(t.reporterNikHash).toBe(hashNikApp(NIK));
            expect(keJsonLaravel(t.slaDueAt)).toBe('2026-11-28T16:59:59.000000Z');
            expect((await db.select().from(chatConversations).where(eq(chatConversations.id, id.chat)))[0].contact).toBe(KONTAK);
            expect((await db.select().from(referrals).where(eq(referrals.id, id.referral)))[0].contact).toBe(KONTAK);
        });

        it('Laravel membaca baris tulisan Next: waktu, dekripsi, dan pencarian lewat hash NIK', { timeout: 60_000 }, async () => {
            const nik = '3171000011112222';
            // 23:59:59.999 WIB dipotong ke 23:59:59 (bukan dibulatkan ke hari berikutnya).
            const waktu = new Date('2026-11-14T16:59:59.999Z');
            const id = await transaksi(async (tx) => {
                const [u] = await tx
                    .insert(users)
                    .values(denganNikHash({ name: 'Uji Next', password: 'x', nik, createdAt: waktu, updatedAt: waktu }))
                    .returning({ id: users.id });
                const [t] = await tx
                    .insert(tickets)
                    .values(
                        denganReporterNikHash({
                            ticketNo: 'TKT-261114-NEXT01',
                            title: 'Uji',
                            description: 'Uji',
                            reporterNik: nik,
                            slaDueAt: new Date('2026-11-28T16:59:59.500Z'),
                            createdAt: waktu,
                        }),
                    )
                    .returning({ id: tickets.id });
                const [c] = await tx.insert(chatConversations).values({ contact: KONTAK, createdAt: waktu }).returning({ id: chatConversations.id });
                const [r] = await tx
                    .insert(referrals)
                    .values({ token: 'b'.repeat(64), code: 'RJK-NEXT', portalId: 1, contact: KONTAK, createdAt: waktu })
                    .returning({ id: referrals.id });
                return { user: u.id, ticket: t.id, chat: c.id, referral: r.id };
            });

            const [mentahUser] = await mentah(`SELECT created_at::text AS c, nik FROM ${SKEMA}.users WHERE id = ${id.user}`);
            expect(mentahUser.c).toBe('2026-11-14 23:59:59');
            // Ciphertext format Laravel, bukan plaintext.
            expect(mentahUser.nik).not.toContain(nik);
            expect(dekripsi(mentahUser.nik, kunciUji(fe))).toBe(nik);

            const hasil = laravel<Record<string, unknown>>(envLaravel, { aksi: 'baca', nik, ...id });
            expect(hasil).toEqual({
                nik,
                created_at: '2026-11-14T16:59:59.000000Z',
                created_at_wib: '2026-11-14 23:59:59',
                user_by_nik: id.user,
                reporter_nik: nik,
                ticket_by_hash: id.ticket,
                sla_due_at: '2026-11-28T16:59:59.000000Z',
                chat_contact: KONTAK,
                referral_contact: KONTAK,
            });
        });
    });

    it('created_at/updated_at tanpa nilai diisi jam WIB aplikasi (sama satu sama lain), updated_at ikut update', async () => {
        const [{ id }] = await db.insert(chatConversations).values({ subject: 'tanpa waktu' }).returning({ id: chatConversations.id });
        const [baris] = await mentah(`SELECT created_at::text AS c, updated_at::text AS u FROM ${SKEMA}.chat_conversations WHERE id = ${id}`);
        expect(baris.c).not.toBeNull();
        expect(baris.u).toBe(baris.c);
        // Jam WIB (bukan UTC = selisih 7 jam) dari waktu sekarang.
        expect(Math.abs(dariWib(baris.c).getTime() - Date.now())).toBeLessThan(5_000);

        await mentah(`UPDATE ${SKEMA}.chat_conversations SET updated_at = '2000-01-01 00:00:00' WHERE id = ${id}`);
        await db.update(chatConversations).set({ subject: 'diubah' }).where(eq(chatConversations.id, id));
        const [setelah] = await mentah(`SELECT updated_at::text AS u FROM ${SKEMA}.chat_conversations WHERE id = ${id}`);
        expect(Math.abs(dariWib(setelah.u).getTime() - Date.now())).toBeLessThan(5_000);
    });

    it('FOR UPDATE menahan transaksi kedua sampai transaksi pertama commit', { timeout: 20_000 }, async () => {
        const [{ id }] = await db
            .insert(tickets)
            .values({ ticketNo: 'TKT-261114-KUNCI1', title: 'awal', description: 'x' })
            .returning({ id: tickets.id });
        const urutan: string[] = [];
        let lepasA!: () => void;
        const tahanA = new Promise<void>((r) => (lepasA = r));
        let aTerkunci!: () => void;
        const terkunciA = new Promise<void>((r) => (aTerkunci = r));

        const a = transaksi(async (tx) => {
            await kunciBaris(tx, tickets, eq(tickets.id, id));
            aTerkunci();
            await tahanA;
            await tx.update(tickets).set({ title: 'diubah A' }).where(eq(tickets.id, id));
            urutan.push('A commit');
        });
        await terkunciA;
        const b = transaksi(async (tx) => {
            const [t] = await kunciBaris(tx, tickets, eq(tickets.id, id));
            urutan.push(`B membaca "${t.title}"`);
        });

        // B benar-benar menunggu kunci baris di PostgreSQL (koneksi pool kedua), bukan sekadar belum dijadwalkan.
        await vi.waitFor(
            async () =>
                expect(
                    await mentah(`SELECT 1 FROM pg_locks WHERE NOT granted
                        AND pid IN (SELECT pid FROM pg_stat_activity WHERE application_name = 'cc-web')`),
                ).toHaveLength(1),
            { timeout: 5_000 },
        );
        expect(urutan).toEqual([]);

        lepasA();
        await Promise.all([a, b]);
        // READ COMMITTED + FOR UPDATE: B membaca versi baris setelah commit A.
        expect(urutan).toEqual(['A commit', 'B membaca "diubah A"']);
    });

    it('unique violation menjadi GalatUnik tanpa nilai parameter di pesan', async () => {
        const nik = '3171999988887777';
        const tambah = () => transaksi((tx) => tx.insert(users).values(denganNikHash({ name: 'Ganda', password: 'x', nik })));
        await tambah();
        const galat = await tambah().catch((e: unknown) => e);

        expect(galat).toBeInstanceOf(GalatUnik);
        expect(galat).toMatchObject({ kode: '23505', constraint: expect.stringContaining('nik_hash') });
        expect(JSON.stringify({ ...(galat as object), pesan: (galat as Error).message })).not.toContain(hashNikApp(nik));
    });
});
