import path from 'node:path';

import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Sesi cc_session, login, dan tumpukan proxy terhadap contact_center_dev lokal di skema sementara per proses:
// cc_uji_sesi_<pid> (users/activity_logs/chat_conversations disalin strukturnya + migrasi drizzle-cc sebagai
// cc_migrate). Aplikasi berjalan sebagai cc_app. Tanpa PostgreSQL → dilewati, kecuali CC_TEST_DB=1 / CI=true.

const SKEMA = `cc_uji_sesi_${process.pid}`;
const SKEMA_BOSS = `cc_uji_sesi_boss_${process.pid}`;
const URL_MIGRATE = 'postgres://cc_migrate@127.0.0.1:5432/contact_center_dev';
const URL_APP = `postgres://cc_app@127.0.0.1:5432/contact_center_dev?options=${encodeURIComponent(`-c search_path=${SKEMA}`)}`;
const KUNCI = 'base64:' + Buffer.alloc(32, 5).toString('base64');
const NIK = '3171010101010077';

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

describe.runIf(diminta && alasan)('sesi & login DB (CC_TEST_DB=1)', () => {
    it('membutuhkan PostgreSQL lokal', () => expect.fail(`${alasan}`));
});

const hash = (s: string) => bcrypt.hashSync(s, 4).replace(/^\$2b\$/, '$2y$');

describe.skipIf(!!alasan)(`sesi & login DB${alasan ? ` — dilewati: ${alasan}` : ''}`, { timeout: 30_000 }, async () => {
    vi.stubEnv('DATABASE_URL', URL_APP);
    vi.stubEnv('APP_KEY', KUNCI);
    vi.stubEnv('NIK_HASH_KEY', KUNCI);
    vi.stubEnv('APP_URL', 'http://cc.test');
    vi.stubEnv('VALKEY_URL', '');
    const { tutupDb } = await import('@/server/db/client');
    const { bacaKunci, enkripsi } = await import('@/server/legacy/laravel-crypt');
    const { hashNikApp } = await import('@/server/db/kolom');
    const { terapkanMigrasi } = await import('@/server/migrasi');
    const sesiMod = await import('@/server/auth/sesi');
    const { muatSesi, sesiBaru, simpanSesi, rotasiSesi, bersihkanSesi, hapusSesiPengguna, periksaSidik } = sesiMod;
    const { cobaMasuk, masukkan, keluarkan, penggunaDariIngat, PESAN_GAGAL_MASUK, TIMEBOX_MS } = await import('@/server/auth/masuk');
    const { ambilPengguna } = await import('@/server/auth/pengguna');
    const { teruskanApiLuar, tumpukanWeb } = await import('@/server/auth/tumpukan');
    const { penggunaDariSesi, sesiDariHeader } = await import('@/server/auth/konteks');
    const { COOKIE_INGAT, COOKIE_SESI } = await import('@/server/auth/cookie');
    const { tutupPoolSandi } = await import('@/server/legacy/sandi');

    const migrate = new pg.Client({ connectionString: URL_MIGRATE });
    const mentah = async (q: string, p: unknown[] = []) => (await migrate.query(q, p)).rows;
    const meta = { ip: '203.0.113.5', userAgent: 'vitest' };
    const id: Record<string, number> = {};

    beforeAll(async () => {
        await migrate.connect();
        await mentah(`DROP SCHEMA IF EXISTS ${SKEMA} CASCADE; DROP SCHEMA IF EXISTS ${SKEMA_BOSS} CASCADE; CREATE SCHEMA ${SKEMA}`);
        for (const t of ['users', 'activity_logs', 'chat_conversations']) {
            await mentah(`CREATE TABLE ${SKEMA}.${t} (LIKE public.${t} INCLUDING ALL);
                CREATE SEQUENCE ${SKEMA}.${t}_id_seq OWNED BY ${SKEMA}.${t}.id;
                ALTER TABLE ${SKEMA}.${t} ALTER id SET DEFAULT nextval('${SKEMA}.${t}_id_seq')`);
        }
        // Seperti deploy/next/uji/init.sh: cc_readonly mendapat SELECT otomatis untuk tabel baru cc_migrate.
        await mentah(`ALTER DEFAULT PRIVILEGES FOR ROLE cc_migrate IN SCHEMA ${SKEMA} GRANT SELECT ON TABLES TO cc_readonly`);
        await terapkanMigrasi({ url: URL_MIGRATE, folder: path.resolve('drizzle-cc'), skema: SKEMA, skemaBoss: SKEMA_BOSS });
        await mentah(`GRANT USAGE ON SCHEMA ${SKEMA} TO cc_app;
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${SKEMA} TO cc_app;
            GRANT USAGE ON ALL SEQUENCES IN SCHEMA ${SKEMA} TO cc_app`);
        const tambah = async (kunci: string, kolom: Record<string, unknown>) => {
            const nilai = { name: kunci, password: hash('sandi-benar'), is_active: true, role: 'warga', ...kolom };
            const k = Object.keys(nilai);
            const [r] = await mentah(
                `INSERT INTO ${SKEMA}.users (${k.join(', ')}, created_at, updated_at) VALUES (${k.map((_, i) => `$${i + 1}`).join(', ')}, '2026-11-01 10:00:00', '2026-11-01 10:00:00') RETURNING id`,
                Object.values(nilai),
            );
            id[kunci] = Number(r.id);
        };
        await tambah('warga', { nik_hash: hashNikApp(NIK), email_verified_at: '2026-11-01 10:00:00' });
        await tambah('admin', { username: 'admin1', role: 'super_admin' });
        await tambah('nonaktif', { username: 'nonaktif', is_active: false });
        await tambah('kawasan', { username: 'kawasan1', role: 'admin_kawasan' });
    });

    afterAll(async () => {
        await tutupPoolSandi();
        await tutupDb();
        await mentah(`DROP SCHEMA IF EXISTS ${SKEMA} CASCADE; DROP SCHEMA IF EXISTS ${SKEMA_BOSS} CASCADE`);
        await migrate.end();
        vi.unstubAllEnvs();
    });

    const jumlahSesi = async () => (await mentah(`SELECT count(*)::int AS n FROM ${SKEMA}.cc_sessions`))[0].n as number;

    describe('penyimpanan', () => {
        it('INSERT lalu baca; id disimpan sebagai sha256, bukan id mentah', async () => {
            const s = sesiBaru();
            s.data.x = 1;
            await simpanSesi(s, meta);
            const dibaca = await muatSesi(s.id);
            expect(dibaca).toMatchObject({ id: s.id, ada: true, userId: null, csrf: s.csrf, data: { x: 1 } });
            const [baris] = await mentah(
                `SELECT id, ip_address, user_agent FROM ${SKEMA}.cc_sessions WHERE id <> $1 AND user_agent = 'vitest' LIMIT 1`,
                [s.id],
            );
            expect(baris.id).toMatch(/^[0-9a-f]{64}$/);
        });

        it('data terenkripsi APP_KEY: NIK di _old_input tidak terbaca polos di DB', async () => {
            const s = sesiBaru();
            s.data._old_input = { identifier: NIK };
            await simpanSesi(s, meta);
            const [baris] = await mentah(`SELECT data FROM ${SKEMA}.cc_sessions WHERE id = encode(sha256($1::bytea), 'hex')`, [s.id]);
            expect(baris.data).not.toContain(NIK);
            expect(JSON.parse(Buffer.from(baris.data, 'base64').toString())).toHaveProperty('mac');
            expect((await muatSesi(s.id))?.data).toEqual({ _old_input: { identifier: NIK } });
        });

        it('cc_readonly tidak bisa membaca tabel cc_* walau default privileges memberinya SELECT', async () => {
            for (const t of ['cc_sessions', 'cc_outbox', 'cc_idempotency']) {
                const [r] = await mentah(`SELECT has_table_privilege('cc_readonly', '${SKEMA}.${t}', 'SELECT') AS boleh`);
                expect(r.boleh, t).toBe(false);
            }
        });

        it('id salah format, isi rusak/salah kunci, atau kedaluwarsa → tanpa sesi (bukan galat)', async () => {
            expect(await muatSesi('pendek')).toBeNull();
            expect(await muatSesi('x'.repeat(43))).toBeNull();
            const satu = async (ubah: string, nilai: string) => {
                const s = sesiBaru();
                await simpanSesi(s, meta);
                await mentah(`UPDATE ${SKEMA}.cc_sessions SET ${ubah} = $2 WHERE id = encode(sha256($1::bytea), 'hex')`, [s.id, nilai]);
                return muatSesi(s.id);
            };
            const kunciLain = bacaKunci('base64:' + Buffer.alloc(32, 6).toString('base64'));
            expect(await satu('data', 'bukan-payload')).toBeNull();
            expect(await satu('data', enkripsi('[1,2]', bacaKunci(KUNCI)))).toBeNull();
            expect(await satu('data', enkripsi('{rusak', bacaKunci(KUNCI)))).toBeNull();
            expect(await satu('data', enkripsi('{}', kunciLain))).toBeNull();
            expect(await satu('csrf_token', '')).toBeNull();
            const u = sesiBaru();
            await simpanSesi(u, meta);
            await mentah(`UPDATE ${SKEMA}.cc_sessions SET last_activity = now() - interval '121 minutes'`);
            expect(await muatSesi(u.id)).toBeNull();
        });

        it('tulis-balik update-only: sesi yang dihapus logout serentak tidak dibangkitkan lagi (NV-1)', async () => {
            const s = sesiBaru();
            s.userId = id.warga;
            await simpanSesi(s, meta);
            const permintaanLambat = await muatSesi(s.id); // dibaca sebelum logout
            const logout = await muatSesi(s.id);
            await keluarkan(logout!, await ambilPengguna(id.warga), meta, false);
            await simpanSesi(logout!, meta);
            permintaanLambat!.data.ubah = true;
            expect(await simpanSesi(permintaanLambat!, meta)).toBe(false);
            expect(await muatSesi(s.id)).toBeNull();
        });

        it('rotasi: id & token CSRF baru, baris lama hilang; data dipertahankan (regenerate) atau dikosongkan (invalidate)', async () => {
            const s = sesiBaru();
            s.data['url.intended'] = '/admin';
            await simpanSesi(s, meta);
            const [idLama, csrfLama] = [s.id, s.csrf];
            await rotasiSesi(s, false);
            await simpanSesi(s, meta);
            expect(s.id).not.toBe(idLama);
            expect(s.csrf).not.toBe(csrfLama);
            expect(await muatSesi(idLama)).toBeNull();
            expect((await muatSesi(s.id))?.data).toEqual({ 'url.intended': '/admin' });
            await rotasiSesi(s, true);
            await simpanSesi(s, meta);
            expect((await muatSesi(s.id))?.data).toEqual({});
        });

        it('GC menghapus sesi kedaluwarsa saja; hapusSesiPengguna menyisakan sesi yang dikecualikan', async () => {
            await mentah(`DELETE FROM ${SKEMA}.cc_sessions`);
            const [a, b, c] = [sesiBaru(), sesiBaru(), sesiBaru()];
            for (const s of [a, b, c]) {
                s.userId = id.admin;
                await simpanSesi(s, meta);
            }
            await mentah(
                `UPDATE ${SKEMA}.cc_sessions SET last_activity = now() - interval '3 hours' WHERE id = (SELECT id FROM ${SKEMA}.cc_sessions LIMIT 1)`,
            );
            expect(await bersihkanSesi()).toBe(1);
            expect(await jumlahSesi()).toBe(2);
            const sisa = (await muatSesi(b.id)) ?? (await muatSesi(c.id));
            expect(await hapusSesiPengguna(id.admin, sisa)).toBe(1);
            expect(await jumlahSesi()).toBe(1);
        });
    });

    describe('login (AuthService::attempt)', () => {
        it('username & NIK (blind index) berhasil + audit auth.login', async () => {
            expect(await cobaMasuk(' admin1 ', 'sandi-benar', meta)).toMatchObject({ pengguna: { id: id.admin } });
            expect(await cobaMasuk(NIK, 'sandi-benar', meta)).toMatchObject({ pengguna: { id: id.warga } });
            const audit = await mentah(
                `SELECT user_id, username, action, subject_type, subject_id, description, ip_address FROM ${SKEMA}.activity_logs WHERE action = 'auth.login' ORDER BY id`,
            );
            expect(audit[0]).toEqual({
                user_id: String(id.admin),
                username: 'admin1',
                action: 'auth.login',
                subject_type: 'App\\Models\\User',
                subject_id: String(id.admin),
                description: 'Login berhasil: admin.',
                ip_address: '203.0.113.5',
            });
            expect(audit[1].username).toBe('warga'); // tanpa username → name
        });

        it('gagal: sandi salah, akun tidak ada (hash tiruan), nonaktif, 16 digit bukan username — pesan sama, ≥ timebox', async () => {
            await mentah(`DELETE FROM ${SKEMA}.activity_logs`);
            await mentah(`UPDATE ${SKEMA}.users SET username = '9999999999999999' WHERE id = $1`, [id.kawasan]);
            for (const [identifier, sandi, alasanGagal] of [
                ['admin1', 'salah', 'bad_password'],
                ['tidak-ada', 'x', 'not_found'],
                ['nonaktif', 'sandi-benar', 'inactive'],
                ['9999999999999999', 'sandi-benar', 'not_found'],
            ]) {
                const mulai = Date.now();
                expect(await cobaMasuk(identifier, sandi, meta)).toEqual({ galat: PESAN_GAGAL_MASUK });
                expect(Date.now() - mulai).toBeGreaterThanOrEqual(TIMEBOX_MS - 5);
                const [a] = await mentah(`SELECT user_id, action, properties FROM ${SKEMA}.activity_logs ORDER BY id DESC LIMIT 1`);
                expect(a).toMatchObject({ user_id: null, action: 'auth.login_failed', properties: { reason: alasanGagal } });
            }
            await mentah(`UPDATE ${SKEMA}.users SET username = 'kawasan1' WHERE id = $1`, [id.kawasan]);
            await cobaMasuk('3171010101019999', 'x', meta);
            const [nik] = await mentah(`SELECT properties FROM ${SKEMA}.activity_logs ORDER BY id DESC LIMIT 1`);
            expect(nik.properties).toEqual({ identifier: '3171********9999', reason: 'not_found' });
        });
    });

    describe('Ingat saya & ganti sandi', () => {
        it('cookie ingat sah selama token & sandi sama; logout mengganti remember_token tanpa menyentuh updated_at', async () => {
            const admin = (await ambilPengguna(id.admin))!;
            const s = sesiBaru();
            const ingat = await masukkan(s, admin, true);
            expect(s.userId).toBe(id.admin);
            expect(await penggunaDariIngat(ingat)).toMatchObject({ id: id.admin });
            expect(await penggunaDariIngat(ingat!.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')))).toBeNull();
            const [sebelum] = await mentah(`SELECT updated_at FROM ${SKEMA}.users WHERE id = $1`, [id.admin]);
            await keluarkan(s, (await ambilPengguna(id.admin))!, meta, true);
            expect(await penggunaDariIngat(ingat)).toBeNull();
            const [sesudah] = await mentah(`SELECT updated_at FROM ${SKEMA}.users WHERE id = $1`, [id.admin]);
            expect(sesudah.updated_at).toEqual(sebelum.updated_at);
        });

        it('ganti sandi di tempat lain → sesi lain keluar pada permintaan berikutnya (proxy: redirect /masuk)', async () => {
            const kawasan = (await ambilPengguna(id.kawasan))!;
            const s = sesiBaru();
            await masukkan(s, kawasan, false);
            await simpanSesi(s, meta);
            const minta = (jalur: string) =>
                tumpukanWeb(new NextRequest(`http://cc.test${jalur}`, { headers: { cookie: `${COOKIE_SESI}=${s.id}` } }), new Headers());
            expect((await minta('/admin')).headers.get('x-middleware-next')).toBe('1');
            await mentah(`UPDATE ${SKEMA}.users SET password = $1 WHERE id = $2`, [hash('sandi-baru'), id.kawasan]);
            expect(periksaSidik((await muatSesi(s.id))!, (await ambilPengguna(id.kawasan))!.password)).toBe('beda');
            const res = await minta('/admin/tiket');
            expect(res.status).toBe(302);
            expect(new URL(res.headers.get('location')!).pathname).toBe('/masuk');
            const setelah = await muatSesi(s.id);
            expect(setelah).toMatchObject({ userId: null, sidikSandi: null, data: { 'url.intended': '/admin/tiket' } });
        });

        it('proxy: cookie ingat memulihkan login dengan id sesi baru; cookie sesi ganda → sesi tamu baru', async () => {
            const admin = (await ambilPengguna(id.admin))!;
            const ingat = await masukkan(sesiBaru(), admin, true);
            const res = await tumpukanWeb(
                new NextRequest('http://cc.test/admin', { headers: { cookie: `${COOKIE_INGAT}=${ingat}` } }),
                new Headers(),
            );
            expect(res.headers.get('x-middleware-next')).toBe('1');
            const idBaru = res.cookies.get(COOKIE_SESI)!.value;
            expect(await muatSesi(idBaru)).toMatchObject({ userId: id.admin });
            const ganda = await tumpukanWeb(
                new NextRequest('http://cc.test/', { headers: { cookie: `${COOKIE_SESI}=${idBaru}; ${COOKIE_SESI}=${idBaru}` } }),
                new Headers(),
            );
            expect(ganda.cookies.get(COOKIE_SESI)!.value).not.toBe(idBaru);
            expect(await muatSesi(ganda.cookies.get(COOKIE_SESI)!.value)).toMatchObject({ userId: null });
        });

        it('proxy: /api/* tanpa Referer/Origin situs sendiri diteruskan TANPA cookie sesi & ingat (pengguna null)', async () => {
            const warga = (await ambilPengguna(id.warga))!;
            const s = sesiBaru();
            const ingat = await masukkan(s, warga, true);
            await simpanSesi(s, meta);
            const cookie = `a=1; ${COOKIE_SESI}=${s.id}; ${COOKIE_INGAT}=${ingat}`;
            const diteruskan = async (headers: Record<string, string>) => {
                const res = teruskanApiLuar(
                    new NextRequest('http://cc.test/api/v1/katalog/kanal', { headers: { cookie, ...headers } }),
                    new Headers(),
                );
                return res === null ? null : res.headers.get('x-middleware-request-cookie');
            };
            for (const luar of [{}, { referer: 'https://jahat.test/' }, { origin: 'https://jahat.test' }] as Record<string, string>[]) {
                const c = await diteruskan(luar);
                expect(c).toBe('a=1');
                expect(await penggunaDariSesi(await sesiDariHeader(new Headers({ cookie: c! })))).toBeNull();
            }
            // Rute API berguard tetap dijaga sebagai tamu (auth:sanctum tanpa token).
            const admin = teruskanApiLuar(new NextRequest('http://cc.test/api/v1/admin/tickets', { headers: { cookie } }), new Headers());
            expect([admin?.status, await admin?.json()]).toEqual([401, { message: 'Unauthenticated.' }]);
            // Dari halaman sendiri → tumpukan web biasa (sesi dipakai).
            expect(await diteruskan({ referer: 'http://cc.test/portal-warga' })).toBeNull();
            expect(await penggunaDariSesi(await sesiDariHeader(new Headers({ cookie })))).toMatchObject({ id: id.warga });
        });

        it('proxy: akun nonaktif → audit, sesi di-invalidate, redirect /masuk dengan flash error', async () => {
            await mentah(`DELETE FROM ${SKEMA}.activity_logs`);
            const nonaktif = (await ambilPengguna(id.nonaktif))!;
            const s = sesiBaru();
            await masukkan(s, nonaktif, false);
            await simpanSesi(s, meta);
            const res = await tumpukanWeb(
                new NextRequest('http://cc.test/portal-warga', { headers: { cookie: `${COOKIE_SESI}=${s.id}` } }),
                new Headers(),
            );
            expect(res.status).toBe(302);
            expect(await muatSesi(s.id)).toBeNull();
            const baru = await muatSesi(res.cookies.get(COOKIE_SESI)!.value);
            expect(baru).toMatchObject({ userId: null, data: { error: 'Akun Anda dinonaktifkan. Hubungi admin Contact Center.' } });
            const [a] = await mentah(`SELECT action, user_id FROM ${SKEMA}.activity_logs`);
            expect(a).toEqual({ action: 'auth.blocked_inactive', user_id: String(id.nonaktif) });
        });
    });
});
