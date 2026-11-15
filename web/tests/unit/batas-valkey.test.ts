import { createConnection } from 'node:net';
import { afterAll, describe, expect, it, vi } from 'vitest';

// Integrasi dengan Valkey sungguhan (lokal: brew valkey; CI: service valkey di web.yml, CC_TEST_VALKEY=1 → wajib).
// Tanpa Valkey di 127.0.0.1:6379 → dilewati. Kunci memakai prefix cc:batas:<md5> (md5 dari nama unik per proses).

const URL_VALKEY = process.env.CC_TEST_VALKEY_URL ?? 'redis://127.0.0.1:6379/15';

function terjangkau(url: string): Promise<boolean> {
    const u = new URL(url);
    return new Promise((ok) => {
        const s = createConnection({ host: u.hostname, port: Number(u.port || 6379), timeout: 500 });
        s.once('connect', () => (s.destroy(), ok(true)));
        s.once('error', () => ok(false));
        s.once('timeout', () => (s.destroy(), ok(false)));
    });
}

const ada = await terjangkau(URL_VALKEY);
const diminta = process.env.CC_TEST_VALKEY === '1';

describe.runIf(diminta && !ada)('Valkey (CC_TEST_VALKEY=1)', () => {
    it('membutuhkan Valkey', () => expect.fail(`Valkey ${URL_VALKEY} tidak terjangkau`));
});

describe.skipIf(!ada)(`rate limit di Valkey${ada ? '' : ' — dilewati: Valkey lokal tidak terjangkau'}`, async () => {
    vi.stubEnv('VALKEY_URL', URL_VALKEY);
    vi.resetModules();
    const { cobaBatas } = await import('@/server/batas/inti');
    const { klienValkey, tutupValkey } = await import('@/server/valkey');
    const nama = `uji-${process.pid}-${Date.now()}`;
    afterAll(async () => {
        await tutupValkey();
        vi.unstubAllEnvs();
    });

    it('skrip Lua sama dengan semantik memori, kunci berprefix cc: dan ber-TTL', async () => {
        const now = Math.floor(Date.now() / 1000);
        const limit = [{ kunci: 'a', maks: 2, detik: 30 }];
        expect(await cobaBatas(nama, limit, now)).toMatchObject({ lolos: true, sumber: 'valkey', header: { 'X-RateLimit-Remaining': '1' } });
        expect(await cobaBatas(nama, limit, now)).toMatchObject({ lolos: true, header: { 'X-RateLimit-Remaining': '0' } });
        const tolak = await cobaBatas(nama, limit, now + 10);
        expect(tolak).toMatchObject({ lolos: false, retryAfter: 20, sumber: 'valkey' });

        const { createHash } = await import('node:crypto');
        const md5 = createHash('md5').update(`${nama}a`).digest('hex');
        // Klien sendiri berprefix cc:, jadi kunci di sini tanpa prefix.
        const r = klienValkey();
        expect(await r.get(`batas:${md5}`)).toBe('2');
        expect(await r.get(`batas:${md5}:timer`)).toBe(String(now + 30));
        expect(await r.ttl(`batas:${md5}`)).toBeGreaterThan(0);
        await r.del(`batas:${md5}`, `batas:${md5}:timer`);
    });

    it('Limit pertama di-hit walau Limit kedua menolak (atomik dalam satu skrip)', async () => {
        const now = Math.floor(Date.now() / 1000);
        const limits = [
            { kunci: 'x', maks: 10, detik: 30 },
            { kunci: 'y', maks: 1, detik: 30 },
        ];
        await cobaBatas(nama, limits, now);
        expect((await cobaBatas(nama, limits, now)).lolos).toBe(false);
        expect((await cobaBatas(nama, [limits[0]], now)).header['X-RateLimit-Remaining']).toBe('7');
    });

    it('permintaan serentak tidak melampaui batas', async () => {
        const limit = [{ kunci: 'serentak', maks: 20, detik: 30 }];
        const hasil = await Promise.all(Array.from({ length: 50 }, () => cobaBatas(nama, limit)));
        expect(hasil.filter((h) => h.lolos)).toHaveLength(20);
    });
});

describe('Valkey mati', async () => {
    // Port yang tidak dipakai: ioredis langsung ECONNREFUSED.
    vi.stubEnv('VALKEY_URL', 'redis://127.0.0.1:1/0');
    vi.resetModules();
    const { cobaBatas, resetPemutusValkey } = await import('@/server/batas/inti');
    const { denganValkey, GalatValkey, tutupValkey } = await import('@/server/valkey');
    afterAll(async () => {
        await tutupValkey();
        vi.unstubAllEnvs();
    });

    it('pemanggil langsung mendapat GalatValkey, tidak menggantung', async () => {
        const mulai = Date.now();
        await expect(denganValkey((r) => r.get('x'))).rejects.toBeInstanceOf(GalatValkey);
        // Sambungan berikutnya saat 'reconnecting' gagal seketika.
        await expect(denganValkey((r) => r.get('x'))).rejects.toThrow(/tidak tersambung/);
        expect(Date.now() - mulai).toBeLessThan(1_500);
    });

    it('rate limit tetap jalan memakai memori proses dengan angka yang sama', async () => {
        resetPemutusValkey();
        const limit = [{ kunci: 'mati', maks: 2, detik: 60 }];
        const mulai = Date.now();
        const hasil = [await cobaBatas('uji-mati', limit), await cobaBatas('uji-mati', limit), await cobaBatas('uji-mati', limit)];
        expect(hasil.map((h) => [h.lolos, h.sumber])).toEqual([
            [true, 'memori'],
            [true, 'memori'],
            [false, 'memori'],
        ]);
        expect(Date.now() - mulai).toBeLessThan(1_500);
    });
});
