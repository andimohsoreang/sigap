import { afterAll, describe, expect, it, vi } from 'vitest';

// Tanpa VALKEY_URL: cobaBatas memakai memori proses — logika yang sama dengan skrip Lua (diuji di batas-valkey.test.ts).
vi.stubEnv('VALKEY_URL', '');
const { cobaBatas, kunciPenyimpanan, MemoriBatas } = await import('@/server/batas/inti');
const { LIMITER, jalurLaravel } = await import('@/server/batas/limiter');
const { galat429Formulir, headerGagal, respons429Json } = await import('@/server/batas/respons');
afterAll(() => vi.unstubAllEnvs());

const T0 = 1_800_000_000;
let n = 0;
const unik = () => `uji-${process.pid}-${n++}`;

describe('semantik Laravel RateLimiter (memori)', () => {
    it('perMinute(5): 5 lolos, ke-6 ditolak dengan Retry-After sisa jendela, lalu pulih setelah jendela habis', async () => {
        const kunci = unik();
        const limit = [{ kunci, maks: 5, detik: 60 }];
        for (let i = 1; i <= 5; i++) {
            const h = await cobaBatas('uji', limit, T0 + i);
            expect(h).toMatchObject({ lolos: true, sumber: 'memori' });
            expect(h.header).toEqual({ 'X-RateLimit-Limit': '5', 'X-RateLimit-Remaining': String(5 - i) });
        }
        const tolak = await cobaBatas('uji', limit, T0 + 20);
        // Jendela dimulai pada hit pertama (T0+1) → habis T0+61.
        expect(tolak).toMatchObject({ lolos: false, retryAfter: 41 });
        expect(tolak.header).toEqual({
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
            'Retry-After': '41',
            'X-RateLimit-Reset': String(T0 + 61),
        });
        // Penolakan tidak menambah hit dan tidak memperpanjang jendela.
        expect((await cobaBatas('uji', limit, T0 + 61)).header['X-RateLimit-Remaining']).toBe('4');
    });

    it('beberapa Limit: Limit pertama tetap ter-hit walau Limit kedua menolak; header = sisa terkecil', async () => {
        const a = unik();
        const b = unik();
        const limits = [
            { kunci: a, maks: 10, detik: 60 },
            { kunci: b, maks: 2, detik: 60 },
        ];
        expect((await cobaBatas('uji', limits, T0)).header).toEqual({ 'X-RateLimit-Limit': '2', 'X-RateLimit-Remaining': '1' });
        await cobaBatas('uji', limits, T0);
        const tolak = await cobaBatas('uji', limits, T0);
        expect(tolak.lolos).toBe(false);
        expect(tolak.header['X-RateLimit-Limit']).toBe('2');
        // a sudah 3 hit (termasuk request yang ditolak b).
        expect((await cobaBatas('uji', [{ kunci: a, maks: 10, detik: 60 }], T0)).header['X-RateLimit-Remaining']).toBe('6');
    });

    it('header sama sisa: Limit pertama yang dipakai (penimpaan hanya bila sisa lebih kecil)', async () => {
        const h = await cobaBatas('uji', [
            { kunci: unik(), maks: 3, detik: 60 },
            { kunci: unik(), maks: 3, detik: 3600 },
        ]);
        expect(h.header).toEqual({ 'X-RateLimit-Limit': '3', 'X-RateLimit-Remaining': '2' });
    });

    it('memori dibatasi: entri kedaluwarsa dibuang saat penuh', () => {
        const m = new MemoriBatas();
        for (let i = 0; i < 50_000; i++) m.jalankan([{ kunci: `k${i}`, maks: 1, detik: 1 }], T0);
        // Semua sudah kedaluwarsa pada T0+5: entri baru tetap bisa masuk dan k0 dihitung dari nol.
        expect(m.jalankan([{ kunci: 'k0', maks: 1, detik: 60 }], T0 + 5)).toEqual({ gagal: 0, langkah: [{ hits: 1, timer: T0 + 65 }] });
    });
});

describe('kunci & angka limiter Laravel', () => {
    it('kunci bernama = md5(nama . kunci) (vektor dari PHP)', () => {
        // php: md5("login"."login:id:".sha1(mb_strtolower(trim(" Admin@Contoh.ID \xC2\xA0")))."|10.0.0.1")
        const [perAkunIp] = LIMITER.login({ ip: '10.0.0.1', identifier: ' Admin@Contoh.ID  ' });
        expect(perAkunIp.kunci).toBe('login:id:ceddb0ba1cf811628fda7084db90718d245ae1d5|10.0.0.1');
        expect(kunciPenyimpanan('login', perAkunIp.kunci)).toBe('eb42985b7e627b0e5c87f5f720b53bb4');
        expect(kunciPenyimpanan('akun', LIMITER.akun({ ip: '10.0.0.1', path: jalurLaravel('/daftar') })[0].kunci)).toBe(
            'a5925841491a5eaebc762c4d58f77310',
        );
        expect(kunciPenyimpanan(null, 'abc')).toBe('abc');
    });

    it('angka 9 limiter sama dengan AppServiceProvider', () => {
        const k = { ip: '1.2.3.4', identifier: 'x', path: 'daftar', sesi: 7 };
        const ringkas = Object.fromEntries(Object.entries(LIMITER).map(([nama, f]) => [nama, f(k).map((l) => `${l.maks}/${l.detik}s ${l.kunci}`)]));
        const idX = '11f6ad8ec52a2984abaafd7c3b516503785c2072'; // sha1('x')
        expect(ringkas).toEqual({
            login: [`5/60s login:id:${idX}|1.2.3.4`, '20/60s login:ip:1.2.3.4', `30/3600s login:id:${idX}`],
            chat: ['20/60s chat:s:7', '60/60s chat:ip:1.2.3.4'],
            'chat-mulai': ['5/600s chat-mulai:1.2.3.4'],
            'chat-baca': ['30/60s chat-baca:s:7', '240/60s chat-baca:ip:1.2.3.4'],
            pengaduan: ['10/600s pengaduan:1.2.3.4'],
            'chat-lampiran': ['6/60s chat-lampiran:m:1.2.3.4', '30/3600s chat-lampiran:h:1.2.3.4'],
            akun: ['5/600s akun:daftar|1.2.3.4', '30/3600s akun:ip:1.2.3.4'],
            lookup: ['30/60s lookup:1.2.3.4'],
            health: ['60/60s health:1.2.3.4'],
        });
    });

    it('identifier non-string mengikuti cast (string) PHP', () => {
        const id = (v: unknown) => LIMITER.login({ ip: 'i', identifier: v })[2].kunci;
        expect(id(undefined)).toBe(id(''));
        expect(id(null)).toBe(id(''));
        expect(id(['a'])).toBe(id('Array'));
        expect(id(12)).toBe(id('12'));
    });

    it('jalurLaravel = $request->path()', () => {
        expect(jalurLaravel('/')).toBe('/');
        expect(jalurLaravel('/atur-ulang-sandi/')).toBe('atur-ulang-sandi');
        expect(jalurLaravel('/verifikasi-email/ganti')).toBe('verifikasi-email/ganti');
    });

    it('limiter berbasis sesi/path gagal jelas bila konteksnya kosong', () => {
        expect(() => LIMITER.chat({ ip: 'i' })).toThrow(/sesi/);
        expect(() => LIMITER.akun({ ip: 'i' })).toThrow(/path/);
    });
});

describe('respons 429', () => {
    it('JSON Laravel + header', async () => {
        const r = respons429Json(headerGagal(5, 30, T0));
        expect(r.status).toBe(429);
        expect(await r.json()).toEqual({ message: 'Too Many Attempts.' });
        expect(r.headers.get('Retry-After')).toBe('30');
        expect(r.headers.get('X-RateLimit-Reset')).toBe(String(T0 + 30));
    });

    it('pesan formulir sama dengan bootstrap/app.php', () => {
        expect(galat429Formulir(42, true)).toEqual({ field: 'identifier', pesan: 'Terlalu banyak percobaan. Silakan coba lagi dalam 42 detik.' });
        expect(galat429Formulir(1, false).field).toBe('throttle');
    });
});
