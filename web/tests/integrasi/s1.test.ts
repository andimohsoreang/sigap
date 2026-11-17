import { spawn, type ChildProcess } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { terapkanMigrasi } from '@/server/migrasi';

// Integrasi jalur proxy S1 terhadap server standalone hasil `npm run build` (sama dengan image cc-web): halaman publik
// untuk tamu, redirect 301 lama, header internal x-cc-url dari klien, dan berkas publik tanpa sesi. DB: skema
// sementara per proses di contact_center_dev; Valkey sendiri di port acak.
// Jalankan: npm run build && npm run test:integrasi.

const diminta = process.env.CC_TEST_INTEGRASI === '1';
const WEB = path.resolve('.next/standalone/web');
const SKEMA = `cc_uji_s1_${process.pid}`;
const SKEMA_BOSS = `cc_uji_s1_boss_${process.pid}`;
const URL_MIGRATE = 'postgres://cc_migrate@127.0.0.1:5432/contact_center_dev';
const KUNCI = 'base64:' + Buffer.alloc(32, 4).toString('base64');
const SESI = '__Host-cc_session';

const portBebas = () =>
    new Promise<number>((ok) => {
        const s = createServer().listen(0, '127.0.0.1', () => {
            const { port } = s.address() as { port: number };
            s.close(() => ok(port));
        });
    });

const tidur = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

describe.runIf(diminta)('integrasi proxy S1 (server standalone)', { timeout: 120_000 }, () => {
    let web: ChildProcess;
    let valkey: ChildProcess;
    let base = '';
    let log = '';
    const migrate = new pg.Client({ connectionString: URL_MIGRATE });
    const mentah = async (q: string) => (await migrate.query(q)).rows;
    const jumlahSesi = async () => Number((await mentah(`SELECT count(*) AS n FROM ${SKEMA}.cc_sessions`))[0].n);

    beforeAll(async () => {
        if (!existsSync(path.join(WEB, 'server.js'))) throw new Error('jalankan `npm run build` dulu (.next/standalone/web/server.js tidak ada)');
        // Seperti deploy/next/Dockerfile: berkas publik di samping server standalone.
        cpSync('public', path.join(WEB, 'public'), { recursive: true });
        await migrate.connect();
        await mentah(`DROP SCHEMA IF EXISTS ${SKEMA} CASCADE; DROP SCHEMA IF EXISTS ${SKEMA_BOSS} CASCADE; CREATE SCHEMA ${SKEMA}`);
        // /tentang membaca tickets, categories, channels (StatsService::publicOverview); users untuk sesi login.
        for (const t of ['users', 'tickets', 'categories', 'channels']) {
            await mentah(`CREATE TABLE ${SKEMA}.${t} (LIKE public.${t} INCLUDING ALL);
                CREATE SEQUENCE ${SKEMA}.${t}_id_seq OWNED BY ${SKEMA}.${t}.id;
                ALTER TABLE ${SKEMA}.${t} ALTER id SET DEFAULT nextval('${SKEMA}.${t}_id_seq')`);
        }
        await terapkanMigrasi({ url: URL_MIGRATE, folder: path.resolve('drizzle-cc'), skema: SKEMA, skemaBoss: SKEMA_BOSS });
        await mentah(`GRANT USAGE ON SCHEMA ${SKEMA} TO cc_app;
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${SKEMA} TO cc_app;
            GRANT USAGE ON ALL SEQUENCES IN SCHEMA ${SKEMA} TO cc_app`);

        const portValkey = await portBebas();
        valkey = spawn('valkey-server', ['--port', String(portValkey), '--bind', '127.0.0.1', '--save', '', '--appendonly', 'no'], {
            stdio: 'ignore',
        });
        const port = await portBebas();
        base = `http://127.0.0.1:${port}`;
        web = spawn(process.execPath, [path.join(WEB, 'server.js')], {
            env: {
                PATH: process.env.PATH,
                PORT: String(port),
                HOSTNAME: '127.0.0.1',
                NODE_ENV: 'production',
                APP_URL: base,
                APP_KEY: KUNCI,
                NIK_HASH_KEY: KUNCI,
                DATABASE_URL: `postgres://cc_app@127.0.0.1:5432/contact_center_dev?options=${encodeURIComponent(`-c search_path=${SKEMA}`)}`,
                VALKEY_URL: `redis://127.0.0.1:${portValkey}/0`,
                REALTIME_APP_ID: 'cc',
                REALTIME_APP_KEY: 'kunci-publik',
                REALTIME_APP_SECRET: 'rahasia-uji',
                LOG_LEVEL: 'warn',
                DB_POOL_MAX: '2',
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
        await mentah(`DROP SCHEMA IF EXISTS ${SKEMA} CASCADE; DROP SCHEMA IF EXISTS ${SKEMA_BOSS} CASCADE`).catch(() => {});
        await migrate.end();
    });

    const minta = (jalur: string, init: RequestInit = {}) => fetch(base + jalur, { ...init, redirect: 'manual' });
    const namaCookie = (r: Response) => r.headers.getSetCookie().map((c) => c.slice(0, c.indexOf('=')));

    it('halaman S1 untuk tamu: 200, no-cache private, cookie sesi & XSRF-TOKEN baru', async () => {
        const sebelum = await jumlahSesi();
        const r = await minta('/pedoman-layanan');
        expect(r.status, log).toBe(200);
        expect(r.headers.get('cache-control')).toBe('no-cache, private');
        expect(namaCookie(r).sort()).toEqual([SESI, 'XSRF-TOKEN'].sort());
        expect(await jumlahSesi()).toBe(sebelum + 1);
        expect(await r.text()).toContain('<div id="app"></div>');
    });

    it('redirect lama: 301, Location relatif, query dibuang, tanpa Cache-Control', async () => {
        const r = await minta('/beranda-baru?x=1');
        expect(r.status).toBe(301);
        expect(r.headers.get('location')).toBe('/');
        expect(r.headers.get('cache-control')).toBeNull();
        // Isi: Next.js mengirim teks URL, Laravel halaman "Redirecting to /" (perbedaan yang diketahui, lihat redirect-lama.ts).
        expect(await r.text()).toBe('/');
    });

    it('x-cc-url dari klien diabaikan: url objek halaman /tentang tetap dari URL permintaan', async () => {
        const r = await minta('/tentang', { headers: { 'x-cc-url': '/evil' } });
        expect(r.status, log).toBe(200);
        const html = await r.text();
        // Objek halaman ada di payload RSC (string JSON di dalam skrip, kutip di-escape).
        expect(html).toMatch(/\\"component\\":\\"public\/tentang\\"/);
        expect(html).toMatch(/\\"url\\":\\"\/tentang\\"/);
        expect(html).not.toContain('/evil');
    });

    it('berkas publik tanpa sesi: robots.txt & gambar tanpa Set-Cookie dan tanpa baris cc_sessions baru', async () => {
        const sebelum = await jumlahSesi();
        for (const jalur of ['/robots.txt', '/images/tara/avatar.webp']) {
            const r = await minta(jalur);
            expect(r.status, jalur).toBe(200);
            expect(r.headers.getSetCookie(), jalur).toEqual([]);
            await r.arrayBuffer();
        }
        expect((await minta('/images/tara/avatar.webp')).headers.get('cache-control')).toBe('public, max-age=604800');
        expect(await jumlahSesi()).toBe(sebelum);
    });
});
