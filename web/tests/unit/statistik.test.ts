import { createConnection } from 'node:net';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { bulatSatuDesimal, jendelaWib, persenSla } from '@/server/statistik/hitung';

// Bagian murni + jalur cache Valkey ambilStatistikPublik (query DB dipalsukan; paritas query: tests/unit/db/statistik.test.ts).

describe('jendelaWib (now()->startOfDay/endOfDay/startOfMonth/endOfMonth, Asia/Jakarta)', () => {
    it('batas hari mengikuti WIB, bukan UTC', () => {
        expect(jendelaWib(new Date('2026-11-16T17:00:00.000Z'))).toEqual({
            sekarang: '2026-11-17 00:00:00',
            awalHari: '2026-11-17 00:00:00',
            akhirHari: '2026-11-17 23:59:59',
            awalBulan: '2026-11-01 00:00:00',
            akhirBulan: '2026-11-30 23:59:59',
        });
        expect(jendelaWib(new Date('2026-11-16T16:59:59.999Z')).awalHari).toBe('2026-11-16 00:00:00');
    });

    it('sekarang dipotong ke detik (format Y-m-d H:i:s), tidak dibulatkan', () => {
        expect(jendelaWib(new Date('2026-11-17T03:20:30.999Z')).sekarang).toBe('2026-11-17 10:20:30');
    });

    it('akhir bulan: Februari kabisat/bukan, pergantian tahun di WIB', () => {
        expect(jendelaWib(new Date('2028-02-29T05:00:00Z')).akhirBulan).toBe('2028-02-29 23:59:59');
        expect(jendelaWib(new Date('2026-02-10T05:00:00Z')).akhirBulan).toBe('2026-02-28 23:59:59');
        // 31 Des 17:00 UTC = 1 Jan 00:00 WIB.
        expect(jendelaWib(new Date('2026-12-31T17:00:00Z'))).toMatchObject({ awalBulan: '2027-01-01 00:00:00', akhirBulan: '2027-01-31 23:59:59' });
    });
});

describe('pembulatan sla_pct (round($x, 1) PHP 8.4)', () => {
    // [tepat, selesai, round(tepat / selesai * 100, 1) dari PHP 8.4.10]. Lima baris pertama: Math.round(v*10)/10 berbeda.
    const VEKTOR_PHP: [number, number, number][] = [
        [9, 2000, 0.4],
        [37, 2000, 1.8],
        [143, 2000, 7.1],
        [1027, 2000, 51.3],
        [1099, 2000, 54.9],
        [1, 3, 33.3],
        [2, 3, 66.7],
        [1, 8, 12.5],
        [0, 5, 0],
        [5, 5, 100],
        [1, 6, 16.7],
        [57, 200, 28.5],
    ];

    it.each(VEKTOR_PHP)('%i/%i → %d', (tepat, selesai, harapan) => {
        expect(persenSla(selesai, tepat)).toBe(harapan);
    });

    it('100 bila belum ada tiket selesai ber-SLA', () => {
        expect(persenSla(0, 0)).toBe(100);
    });

    it('nilai yang tidak terpengaruh: 0, tak hingga, NaN dikembalikan apa adanya', () => {
        expect(bulatSatuDesimal(0)).toBe(0);
        expect(bulatSatuDesimal(Infinity)).toBe(Infinity);
        expect(bulatSatuDesimal(NaN)).toBeNaN();
    });
});

// --- Cache Valkey -------------------------------------------------------------------------------------------------

const repo = vi.hoisted(() => ({
    agregatTiket: vi.fn(),
    kategoriTeratas: vi.fn(),
    semuaKanal: vi.fn(),
    provinsiTeratas: vi.fn(),
}));
vi.mock('@/server/statistik/repo', () => repo);

const HARAPAN =
    '{"total":6,"by_status":{"baru":2,"verifikasi":0,"diproses":1,"selesai":3,"ditolak":0},"by_province":[],"today":1,"this_month":4,' +
    '"by_category":[{"name":"Layanan Data / TIK","total":2}],"by_channel":[{"name":"Web","total":3},{"name":"Surel","total":0}],' +
    '"sla_pct":66.7,"ews":1,"kanal_count":2}';

beforeEach(() => {
    vi.clearAllMocks();
    repo.agregatTiket.mockResolvedValue({
        baru: 2,
        verifikasi: 0,
        diproses: 1,
        selesai: 3,
        ditolak: 0,
        today: 1,
        thisMonth: 4,
        selesaiBerSla: 3,
        tepatWaktu: 2,
        ews: 1,
    });
    repo.kategoriTeratas.mockResolvedValue([{ name: 'Layanan Data / TIK', total: 2 }]);
    repo.semuaKanal.mockResolvedValue([
        { name: 'Web', total: 3 },
        { name: 'Surel', total: 0 },
    ]);
    repo.provinsiTeratas.mockResolvedValue([]);
});

async function muat(urlValkey: string) {
    vi.stubEnv('VALKEY_URL', urlValkey);
    vi.resetModules();
    const statistik = await import('@/server/statistik');
    const valkey = await import('@/server/valkey');
    const { log } = await import('@/server/log');
    return { ...statistik, ...valkey, peringatan: vi.spyOn(log, 'warn') };
}

describe('Valkey mati / tidak dikonfigurasi: halaman tetap mendapat data dari DB', () => {
    afterAll(() => vi.unstubAllEnvs());

    it('Valkey tidak terjangkau → dihitung langsung, tanpa melempar, permintaan berikutnya tidak menunggu', async () => {
        const { ambilStatistikPublik, tutupValkey, peringatan } = await muat('redis://127.0.0.1:1/15');
        expect(JSON.stringify(await ambilStatistikPublik())).toBe(HARAPAN);
        const mulai = performance.now();
        expect(JSON.stringify(await ambilStatistikPublik())).toBe(HARAPAN);
        expect(performance.now() - mulai).toBeLessThan(500);
        expect(repo.agregatTiket).toHaveBeenCalledTimes(2);
        // Dua permintaan, satu peringatan: hanya catatan putus dari valkey.ts, bukan per permintaan.
        expect(peringatan.mock.calls.map(([, pesan]) => pesan)).toEqual(['Valkey tidak tersedia; memakai jalur cadangan']);
        await tutupValkey();
    });

    it('VALKEY_URL kosong → dihitung langsung', async () => {
        const { ambilStatistikPublik, peringatan } = await muat('');
        expect(JSON.stringify(await ambilStatistikPublik())).toBe(HARAPAN);
        expect(repo.agregatTiket).toHaveBeenCalledTimes(1);
        expect(peringatan).not.toHaveBeenCalled();
    });
});

const URL_VALKEY = process.env.CC_TEST_VALKEY_URL ?? 'redis://127.0.0.1:6379/15';
const ada = await new Promise<boolean>((ok) => {
    const u = new URL(URL_VALKEY);
    const s = createConnection({ host: u.hostname, port: Number(u.port || 6379), timeout: 500 });
    s.once('connect', () => (s.destroy(), ok(true)));
    s.once('error', () => ok(false));
    s.once('timeout', () => (s.destroy(), ok(false)));
});

describe.runIf(process.env.CC_TEST_VALKEY === '1' && !ada)('cache statistik di Valkey (CC_TEST_VALKEY=1)', () => {
    it('membutuhkan Valkey', () => expect.fail(`Valkey ${URL_VALKEY} tidak terjangkau`));
});

describe.skipIf(!ada)(`cache statistik di Valkey${ada ? '' : ' — dilewati: Valkey lokal tidak terjangkau'}`, () => {
    afterAll(() => vi.unstubAllEnvs());

    it('Cache::remember: miss → hitung & simpan cc:stats:public-overview TTL 60; hit → tanpa query, JSON sama', async () => {
        const { ambilStatistikPublik, denganValkey, klienValkey, tutupValkey } = await muat(URL_VALKEY);
        await denganValkey((v) => v.del('stats:public-overview'));
        const r = klienValkey();

        expect(JSON.stringify(await ambilStatistikPublik())).toBe(HARAPAN);
        expect(await r.get('stats:public-overview')).toBe(HARAPAN);
        const ttl = await r.ttl('stats:public-overview');
        expect(ttl).toBeGreaterThan(55);
        expect(ttl).toBeLessThanOrEqual(60);

        expect(JSON.stringify(await ambilStatistikPublik())).toBe(HARAPAN);
        expect(repo.agregatTiket).toHaveBeenCalledTimes(1);

        await r.del('stats:public-overview');
        await tutupValkey();
    });

    it('isi cache rusak → dicatat, dihitung dari DB, lalu cache ditimpa hasil baru', async () => {
        const { ambilStatistikPublik, denganValkey, tutupValkey, peringatan } = await muat(URL_VALKEY);
        await denganValkey((v) => v.set('stats:public-overview', '{rusak', 'EX', 60));

        expect(JSON.stringify(await ambilStatistikPublik())).toBe(HARAPAN);
        expect(peringatan).toHaveBeenCalledTimes(1);
        expect(await denganValkey((v) => v.get('stats:public-overview'))).toBe(HARAPAN);

        await denganValkey((v) => v.del('stats:public-overview'));
        await tutupValkey();
    });
});
