import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { connect, createServer, type Server } from 'node:net';
import path from 'node:path';

import bcrypt from 'bcryptjs';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { hashNik, kunciNik } from '@/server/legacy/nik';
import { terapkanMigrasi } from '@/server/migrasi';

// Integrasi paket F terhadap server standalone hasil `npm run build` (sama dengan image cc-web): login NIK & username,
// logout, salah peran, rate limit login angka Laravel, dan tetap jalan saat Valkey mati. DB: skema sementara per
// proses di contact_center_dev (cc_migrate/cc_app); Valkey: valkey-server sendiri di port acak.
// Jalankan: npm run build && npm run test:integrasi.

const diminta = process.env.CC_TEST_INTEGRASI === '1';
const SERVER = path.resolve('.next/standalone/web/server.js');
const SKEMA = `cc_uji_integrasi_${process.pid}`;
const SKEMA_BOSS = `cc_uji_integrasi_boss_${process.pid}`;
const URL_MIGRATE = 'postgres://cc_migrate@127.0.0.1:5432/contact_center_dev';
const KUNCI = 'base64:' + Buffer.alloc(32, 3).toString('base64');
const NIK = '3171010101010077';
const SANDI = 'sandi-uji-123';
const SESI = '__Host-cc_session';
const INGAT = '__Host-cc_ingat';
const NAMA_APP = `cc-web-uji-${process.pid}`;

const portBebas = () =>
    new Promise<number>((ok) => {
        const s = createServer().listen(0, '127.0.0.1', () => {
            const { port } = s.address() as { port: number };
            s.close(() => ok(port));
        });
    });

const tidur = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

describe.runIf(diminta)('integrasi auth (server standalone)', { timeout: 120_000 }, () => {
    let web: ChildProcess;
    let valkey: ChildProcess;
    let base = '';
    let portValkey = 0;
    let pgProxy: Server;
    let urlPgAplikasi = '';
    let jumlahQuery = 0;
    const migrate = new pg.Client({ connectionString: URL_MIGRATE });
    const mentah = async (q: string, p: unknown[] = []) => (await migrate.query(q, p)).rows;
    let log = '';

    beforeAll(async () => {
        if (!existsSync(SERVER)) throw new Error('jalankan `npm run build` dulu (.next/standalone/web/server.js tidak ada)');
        await migrate.connect();
        await mentah(`DROP SCHEMA IF EXISTS ${SKEMA} CASCADE; DROP SCHEMA IF EXISTS ${SKEMA_BOSS} CASCADE; CREATE SCHEMA ${SKEMA}`);
        for (const t of ['users', 'activity_logs', 'chat_conversations']) {
            await mentah(`CREATE TABLE ${SKEMA}.${t} (LIKE public.${t} INCLUDING ALL);
                CREATE SEQUENCE ${SKEMA}.${t}_id_seq OWNED BY ${SKEMA}.${t}.id;
                ALTER TABLE ${SKEMA}.${t} ALTER id SET DEFAULT nextval('${SKEMA}.${t}_id_seq')`);
        }
        await terapkanMigrasi({ url: URL_MIGRATE, folder: path.resolve('drizzle-cc'), skema: SKEMA, skemaBoss: SKEMA_BOSS });
        await mentah(`GRANT USAGE ON SCHEMA ${SKEMA} TO cc_app;
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${SKEMA} TO cc_app;
            GRANT USAGE ON ALL SEQUENCES IN SCHEMA ${SKEMA} TO cc_app`);
        const h = bcrypt.hashSync(SANDI, 4).replace(/^\$2b\$/, '$2y$');
        await mentah(
            `INSERT INTO ${SKEMA}.users (username, name, role, password, is_active, nik_hash, email_verified_at, created_at, updated_at) VALUES
            (NULL, 'Warga Uji', 'warga', $1, true, $2, '2026-11-01 10:00:00', '2026-11-01 10:00:00', '2026-11-01 10:00:00'),
            ('wargauser', 'Warga Username', 'warga', $1, true, NULL, '2026-11-01 10:00:00', '2026-11-01 10:00:00', '2026-11-01 10:00:00'),
            ('superadmin', 'Super Admin', 'super_admin', $1, true, NULL, NULL, '2026-11-01 10:00:00', '2026-11-01 10:00:00'),
            ('kawasan', 'Admin Kawasan', 'admin_kawasan', $1, true, NULL, NULL, '2026-11-01 10:00:00', '2026-11-01 10:00:00')`,
            [h, hashNik(NIK, kunciNik(KUNCI))],
        );

        // Penghitung query: proxy TCP di depan PostgreSQL yang menghitung pesan Parse ('P', satu per query Drizzle/pg)
        // dan Query sederhana ('Q') dari aplikasi. Hasil langsung, tanpa menunggu flush statistik PostgreSQL.
        pgProxy = createServer((klien) => {
            const pgsql = connect(5432, '127.0.0.1');
            pgsql.pipe(klien);
            let sisa = Buffer.alloc(0);
            let mulai = true;
            klien.on('data', (d: Buffer) => {
                pgsql.write(d);
                sisa = Buffer.concat([sisa, d]);
                for (;;) {
                    const kepala = mulai ? 0 : 1;
                    if (sisa.length < kepala + 4) break;
                    const panjang = sisa.readInt32BE(kepala);
                    if (sisa.length < kepala + panjang) break;
                    if (!mulai && (sisa[0] === 0x50 || sisa[0] === 0x51)) jumlahQuery++;
                    sisa = sisa.subarray(kepala + panjang);
                    mulai = false;
                }
            });
            klien.on('error', () => pgsql.destroy());
            pgsql.on('error', () => klien.destroy());
        });
        const portPg = await portBebas();
        await new Promise<void>((ok) => pgProxy.listen(portPg, '127.0.0.1', ok));
        urlPgAplikasi = `postgres://cc_app@127.0.0.1:${portPg}/contact_center_dev?options=${encodeURIComponent(`-c search_path=${SKEMA}`)}`;
        portValkey = await portBebas();
        valkey = spawn('valkey-server', ['--port', String(portValkey), '--bind', '127.0.0.1', '--save', '', '--appendonly', 'no'], {
            stdio: 'ignore',
        });
        const port = await portBebas();
        base = `http://127.0.0.1:${port}`;
        web = spawn(process.execPath, [SERVER], {
            env: {
                PATH: process.env.PATH,
                PORT: String(port),
                HOSTNAME: '127.0.0.1',
                NODE_ENV: 'production',
                APP_URL: base,
                APP_KEY: KUNCI,
                NIK_HASH_KEY: KUNCI,
                DATABASE_URL: urlPgAplikasi,
                VALKEY_URL: `redis://127.0.0.1:${portValkey}/0`,
                REALTIME_APP_ID: 'cc',
                REALTIME_APP_KEY: 'kunci-publik',
                REALTIME_APP_SECRET: 'rahasia-uji',
                RECAPTCHA_SITE_KEY: 'kunci-situs-uji',
                LOG_LEVEL: 'warn',
                // Satu koneksi per pool: bila proxy & rute masing-masing punya pool, koneksi aplikasi ini menjadi 2.
                DB_POOL_MAX: '1',
                DB_APP_NAME: NAMA_APP,
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        web.stdout!.on('data', (d) => (log += d));
        web.stderr!.on('data', (d) => (log += d));
        for (let i = 0; i < 100; i++) {
            if (
                await fetch(`${base}/up`).then(
                    (r) => r.ok,
                    () => false,
                )
            )
                return;
            await tidur(100);
        }
        throw new Error(`server tidak siap:\n${log}`);
    });

    afterAll(async () => {
        web?.kill('SIGTERM');
        valkey?.kill('SIGKILL');
        pgProxy?.close();
        await mentah(`DROP SCHEMA IF EXISTS ${SKEMA} CASCADE; DROP SCHEMA IF EXISTS ${SKEMA_BOSS} CASCADE`).catch(() => {});
        await migrate.end();
    });

    /** Browser mini: cookie jar + redirect manual + header asal situs sendiri. */
    function peramban(ip = '198.51.100.1') {
        const jar = new Map<string, string>();
        const minta = async (jalur: string, init: RequestInit & { form?: Record<string, string> } = {}) => {
            const headers = new Headers(init.headers);
            headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
            headers.set('cf-connecting-ip', ip);
            let body = init.body;
            if (init.form) {
                headers.set('content-type', 'application/x-www-form-urlencoded');
                headers.set('origin', base);
                headers.set('referer', `${base}/masuk`);
                if (jar.has('XSRF-TOKEN') && !headers.has('x-xsrf-token')) headers.set('x-xsrf-token', jar.get('XSRF-TOKEN')!);
                body = new URLSearchParams(init.form).toString();
            }
            const res = await fetch(base + jalur, {
                ...init,
                method: init.method ?? (init.form ? 'POST' : 'GET'),
                headers,
                body,
                redirect: 'manual',
            });
            for (const c of res.headers.getSetCookie()) {
                const [pasangan] = c.split(';');
                const i = pasangan.indexOf('=');
                if (/max-age=0/i.test(c)) jar.delete(pasangan.slice(0, i));
                else jar.set(pasangan.slice(0, i), pasangan.slice(i + 1));
            }
            return res;
        };
        const masuk = async (identifier: string, password = SANDI, extra: Record<string, string> = {}) => {
            if (!jar.has(SESI)) await minta('/_platform');
            return minta('/masuk', { form: { identifier, password, ...extra } });
        };
        return { jar, minta, masuk };
    }
    const lokasi = (r: Response) => {
        const l = r.headers.get('location');
        return l === null ? null : new URL(l, base).pathname + new URL(l, base).search;
    };

    it('halaman tamu: cookie sesi & XSRF-TOKEN, CSP ber-nonce cocok dengan skrip, header keamanan', async () => {
        const b = peramban();
        const r = await b.minta('/_platform');
        expect(r.status).toBe(200);
        expect(b.jar.has(SESI) && b.jar.has('XSRF-TOKEN')).toBe(true);
        const csp = r.headers.get('content-security-policy')!;
        const nonce = /'nonce-([^']+)'/.exec(csp)![1];
        const html = await r.text();
        expect(html).toContain(`<script nonce="${nonce}">`);
        expect(csp).toContain(`connect-src 'self' ws://127.0.0.1:`);
        expect(r.headers.get('x-frame-options')).toBe('DENY');
        expect(r.headers.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains');
        const sc = r.headers.getSetCookie().join('\n');
        expect(sc).toMatch(/__Host-cc_session=[^;]+; Path=\/; Expires=[^;]+; Max-Age=7200; Secure; HttpOnly; SameSite=lax/);
    });

    it('warga login dengan NIK → /portal-warga; salah area → dialihkan; logout → /; tamu → /masuk', async () => {
        const b = peramban('198.51.100.2');
        await b.minta('/_platform');
        const idTamu = b.jar.get(SESI);
        const r = await b.masuk(NIK);
        expect(r.status).toBe(302);
        expect(r.headers.get('location')).toBe(`${base}/portal-warga`);
        expect(b.jar.get(SESI)).not.toBe(idTamu); // rotasi id saat login
        expect(lokasi(await b.minta('/admin'))).toBe('/portal-warga');
        const keluar = await b.minta('/keluar', { form: {} });
        expect(keluar.status).toBe(302);
        expect(keluar.headers.get('location')).toBe(`${base}/`);
        expect(lokasi(await b.minta('/portal-warga'))).toBe('/masuk');
        // Token CSRF lama tidak berlaku setelah logout (regenerateToken).
        expect((await b.minta('/keluar', { form: {}, headers: { 'x-xsrf-token': 'lama' } })).status).toBe(419);
    });

    it('warga dengan username; admin dengan username → /admin; url.intended dipakai', async () => {
        expect(lokasi(await peramban('198.51.100.3').masuk('wargauser'))).toBe('/portal-warga');
        const b = peramban('198.51.100.3');
        expect(lokasi(await b.minta('/admin/tiket?status=baru'))).toBe('/masuk');
        expect(lokasi(await b.masuk('superadmin'))).toBe('/admin/tiket?status=baru');
        expect(lokasi(await b.minta('/masuk'))).toBe('/'); // guest
    });

    it('salah peran ditolak seperti Laravel: 403 halaman / JSON, gagal login kembali dengan pesan', async () => {
        const b = peramban('198.51.100.4');
        await b.masuk('kawasan');
        const html = await b.minta('/admin/petugas');
        expect(html.status).toBe(403);
        expect(await html.text()).toContain('Akses khusus petugas');
        const json = await b.minta('/admin/petugas', { headers: { accept: 'application/json' } });
        expect([json.status, await json.json()]).toEqual([403, { authenticated: true, error: 'Akses khusus petugas' }]);
        const tamu = await peramban('198.51.100.4').minta('/api/v1/admin/tickets', { headers: { referer: `${base}/` } });
        expect([tamu.status, await tamu.json()]).toEqual([401, { message: 'Unauthenticated.' }]);
        // Cookie admin tanpa Referer/Origin (curl, klien luar): Sanctum tidak memakai sesi → tamu → 401, bukan lolos guard.
        const luar = await b.minta('/api/v1/admin/tickets');
        expect([luar.status, await luar.json()]).toEqual([401, { message: 'Unauthenticated.' }]);
        const gagal = await peramban('198.51.100.4').masuk('superadmin', 'salah');
        expect([gagal.status, lokasi(gagal)]).toEqual([302, '/masuk']);
    });

    it('CSRF: tanpa token → 419; asal lintas situs → 419 meski token benar', async () => {
        const b = peramban('198.51.100.5');
        await b.minta('/_platform');
        expect((await b.minta('/masuk', { form: { identifier: 'x', password: 'y' }, headers: { 'x-xsrf-token': 'salah' } })).status).toBe(419);
        const lintas = await b.minta('/masuk', { form: { identifier: 'x', password: 'y' }, headers: { 'sec-fetch-site': 'cross-site' } });
        expect(lintas.status).toBe(419);
        expect(await lintas.text()).toContain('Page Expired');
    });

    it('_token di body formulir diterima seperti Laravel; jalur aset/health/realtime tidak lewat proxy', async () => {
        const b = peramban('198.51.100.7');
        await b.minta('/_platform');
        const token = b.jar.get('XSRF-TOKEN')!;
        const r = await b.minta('/masuk', { form: { identifier: 'superadmin', password: SANDI, _token: token }, headers: { 'x-xsrf-token': '' } });
        expect(lokasi(r)).toBe('/admin');
        for (const jalur of ['/up', '/_realtime/app/kunci-publik', '/_cc/tidak-ada.css']) {
            const res = await fetch(base + jalur, { redirect: 'manual' });
            expect(res.headers.get('content-security-policy'), jalur).toBeNull();
            expect(res.headers.getSetCookie(), jalur).toEqual([]);
            // Header keamanan statis tetap ada untuk semua jalur (next.config.ts), seperti nginx produksi.
            if (jalur !== '/_realtime/app/kunci-publik') expect(res.headers.get('x-content-type-options'), jalur).toBe('nosniff');
        }
    });

    it('"Ingat saya": browser baru yang hanya membawa cookie ingat lolos ke /admin dengan sesi baru', async () => {
        const b = peramban('198.51.100.8');
        expect(lokasi(await b.masuk('superadmin', SANDI, { remember: '1' }))).toBe('/admin');
        const ingat = b.jar.get(INGAT);
        expect(ingat).toMatch(/^\d+\.[A-Za-z0-9_-]+\.[0-9a-f]{64}\.[A-Za-z0-9_-]+$/);
        const baru = peramban('198.51.100.8');
        baru.jar.set(INGAT, ingat!);
        const r = await baru.minta('/admin');
        expect(r.status).not.toBe(302); // guard lolos (halaman /admin belum di-port → 404)
        expect(baru.jar.has(SESI)).toBe(true);
        // Logout di browser pertama mengganti remember_token → cookie ingat lama mati.
        await b.minta('/keluar', { form: {} });
        const lagi = peramban('198.51.100.8');
        lagi.jar.set(INGAT, ingat!);
        expect(lokasi(await lagi.minta('/admin'))).toBe('/masuk');
    });

    it('body terlalu besar → 413 halaman nginx sebelum dibaca (12 MB umum, 64 KB rute auth, chunked)', async () => {
        const b = peramban('198.51.100.9');
        await b.minta('/_platform');
        const besar = await b.minta('/masuk', { form: { identifier: 'x', password: 'y'.repeat(70 * 1024) } });
        expect(besar.status).toBe(413);
        expect(await besar.text()).toContain('413 Request Entity Too Large');
        const chunked = await fetch(`${base}/masuk`, {
            method: 'POST',
            body: new ReadableStream({ start: (c) => (c.enqueue(new TextEncoder().encode('a=1')), c.close()) }),
            duplex: 'half',
        } as RequestInit);
        expect(chunked.status).toBe(413);
        // > 12 MB di rute mana pun. Catatan: Next.js menyalin body (maks proxyClientMaxBodySize = 12 MB) SEBELUM proxy
        // berjalan, jadi memori per permintaan dibatasi 12 MB, tetapi body tetap diterima dulu — beda dengan nginx.
        const r = await fetch(`${base}/chat/lampiran`, { method: 'POST', body: Buffer.alloc(13 * 1024 * 1024, 97) });
        expect([r.status, await r.text()]).toEqual([413, expect.stringContaining('<hr><center>nginx</center>')]);
    });

    it('jumlah query auth per permintaan: proxy memuat sesi & pengguna sekali, rute memakai konteks bertanda tangan', async () => {
        const admin = peramban('198.51.100.12');
        await admin.masuk('superadmin');
        const tamu = peramban('198.51.100.13');
        await tamu.minta('/_platform');
        const hitung = async (fn: () => Promise<unknown>) => {
            await fn(); // pemanasan (last_activity baru disentuh paling sering 60 dtk sekali)
            const awal = jumlahQuery;
            await fn();
            return jumlahQuery - awal;
        };
        const izin = (b: ReturnType<typeof peramban>) => () =>
            b.minta('/broadcasting/auth', { form: { socket_id: '1.2', channel_name: 'private-admin.chat' } });
        // Pernah gagal login (flash errors), lalu berhasil: flash sudah habis umurnya → tidak ada UPDATE sesi lagi.
        const bekasFlash = peramban('198.51.100.14');
        await bekasFlash.masuk('superadmin', 'salah');
        await bekasFlash.minta('/_platform'); // errors terbaca
        await bekasFlash.masuk('superadmin');
        await bekasFlash.minta('/_platform');
        const hasil = {
            halamanAdmin: await hitung(() => admin.minta('/_platform')),
            halamanTamu: await hitung(() => tamu.minta('/_platform')),
            izinKanal: await hitung(izin(admin)),
            izinKanalBekasFlash: await hitung(izin(bekasFlash)),
            halamanBekasFlash: await hitung(() => bekasFlash.minta('/_platform')),
        };
        console.log('query per permintaan', hasil);
        expect(hasil).toEqual({ halamanAdmin: 2, halamanTamu: 1, izinKanal: 2, izinKanalBekasFlash: 2, halamanBekasFlash: 2 });
        // Semua rute memakai konteks proxy yang sah: tidak ada peringatan jatuh ke DB.
        expect(log).not.toContain('konteks auth proxy tidak tersedia');
    });

    it('satu pool DB per proses (proxy & rute berbagi; DB_POOL_MAX=1 → tepat satu koneksi)', async () => {
        await Promise.all([peramban('198.51.100.10').masuk('superadmin'), peramban('198.51.100.11').minta('/_platform')]);
        const [r] = await mentah('SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name = $1', [NAMA_APP]);
        expect(r.n).toBe(1);
    });

    it('prototype pollution lewat nama field (audit run-2): sesi korban utuh, guard tetap berlaku', async () => {
        const korban = peramban('198.51.100.15');
        expect(lokasi(await korban.masuk('wargauser'))).toBe('/portal-warga');
        const sesiKorban = korban.jar.get(SESI);
        for (const q of ['__proto__[keluarkan]=1', '__proto__[metode]=X', 'constructor[prototype][keluarkan]=1']) {
            const r = await fetch(`${base}/broadcasting/auth?${q.replace(/\[/g, '%5B').replace(/\]/g, '%5D')}`, { redirect: 'manual' });
            expect(r.status, q).toBe(403);
        }
        // Keputusan guard bukan "lolos" (guest → redirect /) memicu cabang `keluarkan` bila prototipe tercemar.
        expect(lokasi(await korban.minta('/masuk'))).toBe('/');
        expect(korban.jar.get(SESI)).toBe(sesiKorban);
        const r = await korban.minta('/portal-warga');
        expect(r.status).not.toBe(302); // tetap login (halaman belum di-port → 404)
        expect(lokasi(await peramban('198.51.100.16').minta('/admin'))).toBe('/masuk');
        const [a] = await mentah(`SELECT count(*)::int AS n FROM ${SKEMA}.activity_logs WHERE action = 'auth.blocked_inactive'`);
        expect(a.n).toBe(0);
    });

    it('/broadcasting/auth: admin boleh admin.chat, warga & tamu 403', async () => {
        const form = { socket_id: '123.456', channel_name: 'private-admin.chat' };
        const admin = peramban('198.51.100.6');
        await admin.masuk('superadmin');
        const ok = await admin.minta('/broadcasting/auth', { form });
        expect(ok.status).toBe(200);
        expect((await ok.json()).auth).toMatch(/^kunci-publik:[0-9a-f]{64}$/);
        const warga = peramban('198.51.100.6');
        await warga.masuk('wargauser');
        expect((await warga.minta('/broadcasting/auth', { form })).status).toBe(403);
        expect((await warga.minta('/broadcasting/auth', { form: { ...form, channel_name: 'private-user.2' } })).status).toBe(200);
        expect((await peramban('198.51.100.6').minta('/broadcasting/auth', { form })).status).toBe(403);
        // Header konteks internal dari klien dibuang proxy (O1): warga tidak bisa mengaku admin.
        const palsu = { 'x-cc-konteks': 'v1.rid.sid.3.sidik.mac', 'x-nonce': 'n' };
        expect((await warga.minta('/broadcasting/auth', { form, headers: palsu })).status).toBe(403);
    });

    async function ujiBatas(ipDasar: string) {
        // 5/menit per identifier+IP (respons ke-6 = 429 HTML dengan Retry-After), identifier lain di IP yang sama lolos.
        const b = peramban(`${ipDasar}.1`);
        for (let i = 0; i < 5; i++) {
            const r = await b.masuk('Korban', `salah-${i}`);
            expect(r.status, `percobaan ${i + 1}`).toBe(302);
        }
        const tolak = await b.masuk(' korban ', 'salah');
        expect(tolak.status).toBe(429);
        expect(Number(tolak.headers.get('retry-after'))).toBeGreaterThan(0);
        expect(await tolak.text()).toContain('Too Many Requests');
        expect((await peramban(`${ipDasar}.2`).masuk('korban', 'salah')).status).toBe(302);
        // Inertia → 303 kembali dengan pesan validasi.
        const inertia = await b.minta('/masuk', { form: { identifier: 'korban', password: 'x' }, headers: { 'x-inertia': 'true' } });
        expect(inertia.status).toBe(303);
        // 20/menit per IP lintas identifier.
        const c = peramban(`${ipDasar}.3`);
        for (let i = 0; i < 20; i++) expect((await c.masuk(`akun-${i}`, 'x')).status, `akun-${i}`).toBe(302);
        expect((await c.masuk('akun-baru', 'x')).status).toBe(429);
    }

    it('rate limit login angka Laravel (Valkey hidup)', async () => {
        await ujiBatas('192.0.2');
        const kunci = spawnSync('valkey-cli', ['-p', String(portValkey), '--scan', '--pattern', 'cc:batas:*']).stdout.toString();
        expect(kunci.trim().length).toBeGreaterThan(0);
    });

    it('Valkey mati: rate limit jatuh ke memori, login tetap jalan', async () => {
        valkey.kill('SIGKILL');
        await tidur(300);
        await ujiBatas('203.0.113');
        expect(lokasi(await peramban('203.0.113.9').masuk('superadmin'))).toBe('/admin');
    });
});
