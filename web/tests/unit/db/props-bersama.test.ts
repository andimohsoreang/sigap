import { spawnSync } from 'node:child_process';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { DIR_SIGAP } from '../legacy/fixture';
import { cekLaravel } from './laravel';

// Props bersama Next.js vs JSON Inertia Laravel asli (HandleInertiaRequests lewat permintaan X-Inertia ke
// Inertia::render, pipa yang sama dengan halaman) untuk data uji yang sama: tamu, flash, warga, admin dengan badge
// chat & rujukan. Skema sementara `cc_uji_props_<pid>` di contact_center_dev, dihapus sesudahnya.

const SKEMA = `cc_uji_props_${process.pid}`;
const URL_MIGRATE = 'postgres://cc_migrate@127.0.0.1:5432/contact_center_dev';
const URL_APP = `postgres://cc_app@127.0.0.1:5432/contact_center_dev?options=${encodeURIComponent(`-c search_path=${SKEMA}`)}`;
const KUNCI = 'base64:' + Buffer.alloc(32, 5).toString('base64');
const SEKARANG = '2026-11-13 10:00:00';
const ENV_SAMA = { RECAPTCHA_SITE_KEY: 'kunci-situs-uji', AI_ENABLED: 'true', AI_SERVICE_LABEL: 'Senin–Jumat, 08.00–16.00 WIB' };

const PHP = String.raw`
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config(['database.connections.pgsql.search_path' => getenv('CC_SKEMA')]);
$hasil = [];
foreach (json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR) as $k) {
    Carbon\Carbon::setTestNow(Carbon\Carbon::parse($k['sekarang'], 'Asia/Jakarta'));
    $req = Illuminate\Http\Request::create('/panduan', 'GET', server: ['HTTP_X_INERTIA' => 'true']);
    $mw = new App\Http\Middleware\HandleInertiaRequests;
    $req->headers->set('X-Inertia-Version', (string) $mw->version($req));
    $sesi = app('session')->driver('array');
    $sesi->flush();
    foreach ($k['sesi'] as $n => $v) $sesi->put($n, $v);
    $req->setLaravelSession($sesi);
    $user = $k['user'] ? App\Models\User::query()->findOrFail($k['user']) : null;
    // instance() dulu: rebinding 'request' memasang ulang resolver pengguna milik Auth.
    app()->instance('request', $req);
    $req->setUserResolver(fn () => $user);
    $r = $mw->handle($req, fn ($rq) => Inertia\Inertia::render('public/panduan')->toResponse($rq));
    // Tanpa assoc: objek kosong tetap {} (errors), bukan [].
    $hasil[] = json_decode($r->getContent())->props;
}
echo "\n", json_encode($hasil, JSON_THROW_ON_ERROR);
`;

function laravel(kasus: { user: number | null; sesi: Record<string, unknown>; sekarang: string }[]) {
    const r = spawnSync('php', ['-r', PHP], {
        cwd: DIR_SIGAP,
        input: JSON.stringify(kasus),
        encoding: 'utf8',
        env: {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
            NODE_ENV: 'production',
            APP_ENV: 'production',
            APP_NAME: 'Contact Center',
            APP_KEY: KUNCI,
            NIK_HASH_KEY: KUNCI,
            APP_TIMEZONE: 'Asia/Jakarta',
            DB_CONNECTION: 'pgsql',
            DB_HOST: '127.0.0.1',
            DB_PORT: '5432',
            DB_DATABASE: 'contact_center_dev',
            DB_USERNAME: 'cc_app',
            DB_PASSWORD: '',
            CC_SKEMA: SKEMA,
            CACHE_STORE: 'array',
            SESSION_DRIVER: 'array',
            LOG_CHANNEL: 'stderr',
            ...ENV_SAMA,
        },
    });
    if (r.status !== 0) throw new Error(`php gagal (${r.status}):\n${r.stderr}\n${r.stdout}`);
    return JSON.parse(r.stdout.trim().split('\n').at(-1) ?? '') as unknown[];
}

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
const alasan = process.env.CC_TEST_DB === '0' ? 'CC_TEST_DB=0' : ((await cekDb()) ?? cekLaravel());

describe.runIf(diminta && alasan)('props bersama vs Laravel (CC_TEST_DB=1)', () => {
    it('membutuhkan PostgreSQL lokal, PHP, dan sigap/vendor', () => expect.fail(`${alasan}`));
});

describe.skipIf(!!alasan)(`props bersama vs JSON Inertia Laravel${alasan ? ` — dilewati: ${alasan}` : ''}`, { timeout: 60_000 }, async () => {
    vi.stubEnv('DATABASE_URL', URL_APP);
    vi.stubEnv('APP_KEY', KUNCI);
    vi.stubEnv('NIK_HASH_KEY', KUNCI);
    for (const [k, v] of Object.entries(ENV_SAMA)) vi.stubEnv(k, v);
    const { tutupDb } = await import('@/server/db/client');
    const { ambilPengguna } = await import('@/server/auth/pengguna');
    const { hitungPropsBersama } = await import('@/server/inertia/props-bersama');
    const { dariWib } = await import('@/server/db/kolom');

    const migrate = new pg.Client({ connectionString: URL_MIGRATE });
    const q = async (sql: string, p: unknown[] = []) => (await migrate.query(sql, p)).rows;

    beforeAll(async () => {
        await migrate.connect();
        await q(`DROP SCHEMA IF EXISTS ${SKEMA} CASCADE; CREATE SCHEMA ${SKEMA}`);
        for (const t of ['users', 'chat_conversations', 'referrals']) {
            await q(`CREATE TABLE ${SKEMA}.${t} (LIKE public.${t} INCLUDING ALL);
                CREATE SEQUENCE ${SKEMA}.${t}_id_seq OWNED BY ${SKEMA}.${t}.id;
                ALTER TABLE ${SKEMA}.${t} ALTER id SET DEFAULT nextval('${SKEMA}.${t}_id_seq')`);
        }
        await q(`GRANT USAGE ON SCHEMA ${SKEMA} TO cc_app;
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${SKEMA} TO cc_app;
            GRANT USAGE ON ALL SEQUENCES IN SCHEMA ${SKEMA} TO cc_app`);
        const w = "'2026-11-01 10:00:00'";
        await q(`INSERT INTO ${SKEMA}.users (id, username, name, role, password, is_active, created_at, updated_at) VALUES
            (1, 'super', 'Super Admin', 'super_admin', 'x', true, ${w}, ${w}),
            (2, NULL, 'Warga Satu', 'warga', 'x', true, ${w}, ${w}),
            (3, 'kawasan', 'Admin Kawasan', 'admin_kawasan', 'x', false, ${w}, ${w}),
            (4, 'pegawai', 'Pegawai', 'pegawai', 'x', true, ${w}, ${w})`);
        // Menunggu petugas: urut COALESCE(handoff_at, last_message_at), maks 5; yang ditutup / ditangani AI / tanpa
        // handoff & tanpa unread tidak ikut.
        await q(`INSERT INTO ${SKEMA}.chat_conversations
            (user_id, guest_name, handled_by, handoff_at, last_message_at, unread_admin, closed_at, ai_summary, created_at, updated_at) VALUES
            (2, 'Abaikan', 'petugas', '2026-11-12 09:00:00', '2026-11-12 09:30:00', 2, NULL, 'Ringkasan "satu"', ${w}, ${w}),
            (NULL, 'Tamu Budi', 'petugas', NULL, '2026-11-11 08:00:00', 3, NULL, NULL, ${w}, ${w}),
            (NULL, NULL, 'petugas', '2026-11-13 07:00:00', NULL, 0, NULL, 'Tanpa nama', ${w}, ${w}),
            (NULL, 'Ditutup', 'petugas', '2026-11-10 07:00:00', NULL, 4, '2026-11-12 00:00:00', NULL, ${w}, ${w}),
            (NULL, 'AI', 'ai', '2026-11-09 07:00:00', NULL, 5, NULL, NULL, ${w}, ${w}),
            (NULL, 'Diam', 'petugas', NULL, '2026-11-08 07:00:00', 0, NULL, NULL, ${w}, ${w}),
            (NULL, 'T4', 'petugas', '2026-11-13 08:00:00', NULL, 0, NULL, NULL, ${w}, ${w}),
            (NULL, 'T5', 'petugas', '2026-11-13 09:00:00', NULL, 0, NULL, NULL, ${w}, ${w}),
            (NULL, 'T6', 'petugas', '2026-11-13 09:30:00', NULL, 0, NULL, NULL, ${w}, ${w})`);
        // Rujukan perlu tindakan milik admin 1: butuh_bantuan, atau terbuka & batas tindak lanjut lewat (WIB).
        await q(`INSERT INTO ${SKEMA}.referrals (token, code, portal_id, status, assigned_to, follow_up_due_at, created_at, updated_at) VALUES
            ('t1', 'R1', 1, 'butuh_bantuan', 1, NULL, ${w}, ${w}),
            ('t2', 'R2', 1, 'dibuka', 1, '2026-11-13 09:59:59', ${w}, ${w}),
            ('t3', 'R3', 1, 'dirujuk', 1, '2026-11-13 10:00:01', ${w}, ${w}),
            ('t4', 'R4', 1, 'berhasil', 1, '2026-11-01 00:00:00', ${w}, ${w}),
            ('t5', 'R5', 1, 'butuh_bantuan', 3, NULL, ${w}, ${w}),
            ('t6', 'R6', 1, 'dirujuk', 1, '2026-11-13 10:00:00', ${w}, ${w})`);
    });

    afterAll(async () => {
        await tutupDb();
        await q(`DROP SCHEMA IF EXISTS ${SKEMA} CASCADE`);
        await migrate.end();
        vi.unstubAllEnvs();
    });

    it('tamu, flash, warga, admin (badge chat & rujukan), admin nonaktif, pegawai', async () => {
        const kasus = [
            { user: null, sesi: {} },
            { user: null, sesi: { success: 'Pengaduan terkirim.', status: 'ok', lain: 'x' } },
            { user: null, sesi: { error: 'Gagal', _flash: { new: [], old: ['error'] } } },
            { user: 2, sesi: {} },
            { user: 1, sesi: {} },
            { user: 3, sesi: {} },
            { user: 4, sesi: { status: 12 } },
        ].map((k) => ({ ...k, sekarang: SEKARANG }));
        const harapan = laravel(kasus);
        const kita = [];
        for (const k of kasus) {
            const p = k.user ? await ambilPengguna(k.user) : null;
            kita.push(await hitungPropsBersama(p, k.sesi, undefined, dariWib(SEKARANG)));
        }
        // JSON.stringify: urutan kunci juga sama dengan Laravel.
        expect(kita.map((x) => JSON.stringify(x))).toEqual(harapan.map((x) => JSON.stringify(x)));
        expect((harapan[4] as { chat_unread: number }).chat_unread).toBe(14);
        expect((harapan[4] as { rujukan_perlu: number }).rujukan_perlu).toBe(2);
    });
});
