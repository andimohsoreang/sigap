import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { fixture, type FixtureEnkripsi, type FixtureNik } from '../legacy/fixture';
import { cekLaravel, laravel, type EnvLaravel } from './laravel';

// Paritas props `stats` /tentang: StatsService::publicOverview Laravel asli vs hitungStatistikPublik, pada data yang
// sama di skema sementara `cc_uji_stat_<pid>` dan "sekarang" yang dibekukan di kedua sisi. Pola sama dengan db.test.ts:
// tanpa DB/PHP → dilewati, kecuali CC_TEST_DB=1 (`npm run test:db`) atau CI=true → wajib.

const SKEMA = `cc_uji_stat_${process.pid}`;
const TABEL = ['tickets', 'categories', 'channels'];
const URL_MIGRATE = 'postgres://cc_migrate@127.0.0.1:5432/contact_center_dev';
const URL_APP = `postgres://cc_app@127.0.0.1:5432/contact_center_dev?options=${encodeURIComponent(`-c search_path=${SKEMA}`)}`;

const envLaravel: EnvLaravel = {
    skema: SKEMA,
    appKey: fixture<FixtureEnkripsi>('enkripsi.json').app_key,
    appPreviousKeys: '',
    nikHashKey: fixture<FixtureNik>('nik.json').kunci_nik.base64,
};

// Untuk tiap "sekarang": props `stats` dari respons Inertia (XHR, X-Inertia: true) controller /tentang, dan json_encode
// publicOverview() tanpa escape `/` & unicode supaya byte-nya bisa dibandingkan dengan JSON.stringify.
const KODE_PHP = String.raw`
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config(['database.connections.pgsql.search_path' => getenv('CC_SKEMA')]);
$in = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
$hasil = [];
foreach ($in['sekarang'] as $s) {
    Carbon\Carbon::setTestNow(Carbon\Carbon::parse($s, 'Asia/Jakarta'));
    Illuminate\Support\Facades\Cache::flush();
    $req = Illuminate\Http\Request::create('/tentang', 'GET', server: ['HTTP_X_INERTIA' => 'true']);
    $app->instance('request', $req);
    $inertia = app(App\Http\Controllers\Web\PublicController::class)->about()->toResponse($req)->getContent();
    $mentah = json_encode(app(App\Services\StatsService::class)->publicOverview(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    $hasil[] = ['inertia' => $inertia, 'mentah' => $mentah];
}
echo "\n", json_encode($hasil, JSON_THROW_ON_ERROR);
`;

type HasilLaravel = { inertia: string; mentah: string }[];

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
const alasan = dimatikan ? 'CC_TEST_DB=0' : ((await cekDb()) ?? cekLaravel());

describe.runIf(diminta && alasan)('paritas statistik publik (CC_TEST_DB=1)', () => {
    it('membutuhkan PostgreSQL lokal, PHP, dan sigap/vendor', () => {
        expect.fail(`${alasan}`);
    });
});

describe.skipIf(!!alasan)(`paritas statistik publik vs Laravel${alasan ? ` — dilewati: ${alasan}` : ''}`, async () => {
    vi.stubEnv('DATABASE_URL', URL_APP);
    vi.stubEnv('VALKEY_URL', '');
    const { tutupDb } = await import('@/server/db/client');
    const { hitungStatistikPublik } = await import('@/server/statistik');

    const migrate = new pg.Client({ connectionString: URL_MIGRATE });
    const mentah = async (teks: string, nilai: unknown[] = []) => (await migrate.query(teks, nilai)).rows;

    beforeAll(async () => {
        await migrate.connect();
        await mentah(`DROP SCHEMA IF EXISTS ${SKEMA} CASCADE; CREATE SCHEMA ${SKEMA}`);
        for (const t of TABEL) {
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

    /** Bandingkan Next vs Laravel untuk setiap "sekarang" (jam dinding WIB). */
    async function bandingkan(daftarSekarang: string[]) {
        const lrv = laravel<HasilLaravel>(envLaravel, { sekarang: daftarSekarang }, KODE_PHP);
        const hasil = [];
        for (const [i, s] of daftarSekarang.entries()) {
            const next = await hitungStatistikPublik(new Date(`${s.replace(' ', 'T')}+07:00`));
            const props = (JSON.parse(lrv[i].inertia) as { component: string; props: { stats: unknown } }).props.stats;
            // Byte demi byte (urutan kunci, angka bulat vs desimal, [] untuk daftar kosong).
            expect(JSON.stringify(next), `sekarang ${s}`).toBe(lrv[i].mentah);
            // Yang benar-benar diterima halaman Inertia (JsonResponse meng-escape `/` & unicode; setelah parse sama).
            expect(JSON.stringify(next), `props Inertia, sekarang ${s}`).toBe(JSON.stringify(props));
            hasil.push(next);
        }
        return hasil;
    }

    it('data kosong: semua status 0, daftar [], sla_pct 100', { timeout: 60_000 }, async () => {
        const [h] = await bandingkan(['2026-11-17 10:20:30.5']);
        expect(JSON.stringify(h)).toBe(
            '{"total":0,"by_status":{"baru":0,"verifikasi":0,"diproses":0,"selesai":0,"ditolak":0},"by_province":[],"today":0,' +
                '"this_month":0,"by_category":[],"by_channel":[],"sla_pct":100,"ews":0,"kanal_count":0}',
        );
    });

    it('data representatif: batas hari/bulan WIB vs UTC, semua status, seri di batas top-N, provinsi kosong', { timeout: 60_000 }, async () => {
        // Urutan insert ≠ urutan id: urutan baris yang totalnya sama mengikuti rencana eksekusi, bukan id.
        const kategori: [number, string][] = [
            [5, 'Layanan Data / TIK'],
            [2, 'Tata Kelola Lahan'],
            [7, 'Bantuan Sosial'],
            [1, 'Infrastruktur Dasar'],
            [3, 'Ekonomi & Usaha'],
            [8, 'Kesehatan — Pendidikan'],
            [4, 'Lainnya'],
            [6, 'Kosong'],
        ];
        for (const [id, nama] of kategori)
            await mentah(`INSERT INTO ${SKEMA}.categories (id, name, slug) VALUES ($1, $2, $3)`, [id, nama, `k-${id}`]);
        const kanal: [number, string][] = [
            [3, 'SP4N-LAPOR!'],
            [1, '@kementrans.ri'],
            [5, 'Surel Pengaduan'],
            [2, 'Kanal Kantor Pemerintahan'],
            [4, 'Whistleblowing System'],
        ];
        for (const [id, nama] of kanal) await mentah(`INSERT INTO ${SKEMA}.channels (id, type, name) VALUES ($1, 'web', $2)`, [id, nama]);

        // Tiket publik: [status, created_at, sla_due_at, resolved_at]. Sekarang utama = 2026-11-17 10:20:30.5 WIB.
        const baris: [string, string, string | null, string | null][] = [
            ['baru', '2026-11-17 00:00:00', '2026-11-17 10:20:29', null], // awal hari; EWS (sla < sekarang)
            ['verifikasi', '2026-11-16 23:59:59', '2026-11-17 10:20:30', null], // kemarin; sla = sekarang terpotong → belum EWS
            ['diproses', '2026-11-17 00:30:00', '2026-11-17 10:20:31', null], // hari ini WIB, masih 16 Nov UTC
            ['baru', '2026-11-17 06:59:59', null, null], // 16 Nov 23:59:59 UTC
            ['selesai', '2026-11-17 07:00:00', '2026-11-10 00:00:00', '2026-11-09 00:00:00'], // tepat waktu
            ['selesai', '2026-11-17 23:59:59', '2026-11-10 00:00:00', '2026-11-10 00:00:00'], // akhir hari; tepat (=)
            ['selesai', '2026-11-18 00:00:00', '2026-11-10 00:00:00', '2026-11-10 00:00:01'], // besok; terlambat
            ['selesai', '2026-11-01 00:00:00', '2026-11-10 00:00:00', null], // awal bulan; selesai tanpa resolved_at
            ['selesai', '2026-10-31 23:59:59', null, '2026-11-09 00:00:00'], // bulan lalu; tanpa SLA → tidak dihitung
            ['ditolak', '2026-11-30 23:59:59', '2026-01-01 00:00:00', null], // akhir bulan; ditolak → bukan EWS
            ['arsip', '2026-12-01 00:00:00', '2026-01-01 00:00:00', null], // status di luar enum; bulan depan
            ['diproses', '2025-11-17 10:00:00', '2026-11-01 00:00:00', null], // bulan sama tahun lalu (D-08); EWS
            ['verifikasi', '2026-11-01 06:59:59', null, null], // 1 Nov WIB = 31 Okt UTC
            ['selesai', '2026-10-31 17:00:00', '2026-11-12 08:00:00', '2026-11-12 08:00:01'], // 1 Nov 00:00 UTC; terlambat
            ['selesai', '2026-11-10 12:00:00', '2026-11-20 00:00:00', '2026-11-15 00:00:00'], // tepat
            ['baru', '2026-11-10 12:00:00', '2027-01-01 00:00:00', null],
            ['ditolak', '2026-02-28 23:59:59', null, null], // akhir Februari
            ['ditolak', '2026-03-01 00:00:00', null, null],
            ['selesai', '2026-11-05 00:00:00', '2026-11-06 00:00:00', '2026-11-07 00:00:00'], // terlambat → 3/7 = 42,857…
        ];
        // Seri di batas top-N: kategori 3,4,5,7 sama-sama 2 (hanya 3 masuk top 5); provinsi bertotal 1 terpotong di 6.
        const kat = [1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 5, 7, 7, null, null, null, null, null];
        const kan = [1, 1, 1, 1, 2, 2, 2, 2, 5, null, null, null, null, null, null, null, null, null, null];
        const prov = [
            'Jawa Barat',
            'Jawa Barat',
            'Jawa Barat',
            'DI Yogyakarta',
            'DI Yogyakarta',
            'Papua Barat Daya',
            'Papua Barat Daya',
            'Aceh',
            'Aceh',
            'Bali',
            'Bali',
            'Maluku',
            'Riau',
            '',
            'Nusa Tenggara Timur',
            null,
            null,
            null,
            null,
        ];
        const tambah = (
            no: string,
            status: string,
            dibuat: string,
            sla: string | null,
            selesai: string | null,
            k: number | null,
            c: number | null,
            p: string | null,
            internal = false,
            dihapus: string | null = null,
        ) =>
            mentah(
                `INSERT INTO ${SKEMA}.tickets (ticket_no, title, description, status, created_at, updated_at, sla_due_at, resolved_at,
                    category_id, channel_id, province, is_internal, deleted_at) VALUES ($1, 'Uji', 'Uji', $2, $3, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [no, status, dibuat, sla, selesai, k, c, p, internal, dihapus],
            );
        for (const [i, [status, dibuat, sla, selesai]] of baris.entries())
            await tambah(`TKT-UJI-${i}`, status, dibuat, sla, selesai, kat[i], kan[i], prov[i]);
        // Bukan publik: internal & terhapus (soft delete) — hari ini, kategori 6, kanal 3, EWS; tidak boleh terhitung.
        await tambah('TKT-UJI-INT', 'baru', '2026-11-17 09:00:00', '2026-11-01 00:00:00', null, 6, 3, 'Bali', true);
        await tambah(
            'TKT-UJI-DEL',
            'selesai',
            '2026-11-17 09:00:00',
            '2026-11-10 00:00:00',
            '2026-11-01 00:00:00',
            6,
            3,
            'Bali',
            false,
            '2026-11-17 09:30:00',
        );
        await mentah(`ANALYZE ${SKEMA}.tickets, ${SKEMA}.categories, ${SKEMA}.channels`);

        const [utama, ...lain] = await bandingkan([
            '2026-11-17 10:20:30.5',
            '2026-11-17 10:20:31', // sla 10:20:30 kini EWS
            '2026-11-16 23:59:59.999', // akhir hari kemarin
            '2026-11-30 23:59:59.999', // akhir bulan
            '2026-12-01 00:00:00', // bulan baru
            '2026-02-10 09:00:00', // Februari (28 hari)
        ]);
        // Nilai yang diharapkan dihitung tangan, agar test juga gagal bila KEDUA sisi salah dengan cara yang sama.
        expect(utama).toMatchObject({
            total: 18,
            by_status: { baru: 3, verifikasi: 2, diproses: 2, selesai: 8, ditolak: 3 },
            today: 5,
            this_month: 13,
            sla_pct: 42.9,
            ews: 2,
            kanal_count: 5,
        });
        expect(utama.by_category.map((k) => k.total)).toEqual([3, 3, 2, 2, 2]);
        expect(utama.by_province.slice(0, 5)).toEqual([
            { name: 'Jawa Barat', total: 3 },
            ...utama.by_province.slice(1, 5).map(() => expect.objectContaining({ total: 2 })),
        ]);
        expect(lain.map((h) => [h.today, h.this_month, h.ews])).toEqual([
            [5, 13, 3],
            [1, 13, 1],
            [1, 13, 4],
            [1, 1, 4],
            [0, 1, 0],
        ]);
    });
});
