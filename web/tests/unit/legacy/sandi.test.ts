import { afterAll, describe, expect, it } from 'vitest';

import { hashSandi, tutupPoolSandi, verifikasiSandi } from '@/server/legacy/sandi';

import { fixture, type FixtureSandi } from './fixture';

const f = fixture<FixtureSandi>('sandi.json');
const LAMBAT = 60_000; // bcrypt cost 12 di bcryptjs ±0,2–0,4 dtk per cek

afterAll(() => tutupPoolSandi());

describe('sandi: vektor Hash::make / Hash::check (bcrypt $2y$ cost 12)', () => {
    it.each(f.kasus)(
        'verifikasi hash Laravel untuk $sandi',
        async ({ hash, cek, perlu_rehash }) => {
            expect(hash).toMatch(/^\$2y\$12\$/);
            expect(perlu_rehash).toBe(false);
            for (const c of cek) expect(await verifikasiSandi(c.sandi, hash), c.sandi).toBe(c.hasil);
        },
        LAMBAT,
    );

    it.each(f.negatif)('negatif $label sama dengan Laravel', async ({ hash, galat, hasil }) => {
        if (galat) await expect(verifikasiSandi('rahasia123', hash)).rejects.toThrow(galat.pesan);
        else expect(await verifikasiSandi('rahasia123', hash)).toBe(hasil);
    });

    it(
        'hashSandi menghasilkan $2y$12$ yang terverifikasi',
        async () => {
            const hash = await hashSandi('Sandi Baru ñ 🙂');
            expect(hash).toMatch(/^\$2y\$12\$[./A-Za-z0-9]{53}$/);
            expect(await verifikasiSandi('Sandi Baru ñ 🙂', hash)).toBe(true);
            expect(await verifikasiSandi('Sandi Baru', hash)).toBe(false);
        },
        LAMBAT,
    );

    it('NUL di sandi atau cost di luar 04–31 → false, tidak melempar', async () => {
        const { hash, sandi } = f.kasus[0];
        expect(await verifikasiSandi(sandi + '\0x', hash)).toBe(false);
        expect(await verifikasiSandi(sandi, '$2y$03$' + hash.slice(7))).toBe(false);
        expect(await verifikasiSandi(sandi, '$2y$32$' + hash.slice(7))).toBe(false);
    });

    it('hashSandi menolak NUL seperti Laravel', async () => {
        await expect(hashSandi('a\0b')).rejects.toThrow(f.galat_make_nul!.pesan);
    });
});

describe('sandi: pool worker_threads', () => {
    it(
        'event loop tetap lancar saat 4 verifikasi berjalan bersamaan',
        async () => {
            const { hash } = f.kasus[0];
            await verifikasiSandi('panaskan', hash); // pool sudah punya worker sebelum diukur
            let terakhir = performance.now();
            let geserMaks = 0;
            const timer = setInterval(() => {
                const kini = performance.now();
                geserMaks = Math.max(geserMaks, kini - terakhir - 10);
                terakhir = kini;
            }, 10);
            const hasil = await Promise.all(Array.from({ length: 4 }, (_, i) => verifikasiSandi(i % 2 ? 'salah' : f.kasus[0].sandi, hash)));
            clearInterval(timer);
            expect(hasil).toEqual([true, false, true, false]);
            expect(geserMaks).toBeLessThan(20);
        },
        LAMBAT,
    );

    it(
        'pool dapat ditutup lalu dipakai lagi',
        async () => {
            await tutupPoolSandi();
            expect(await verifikasiSandi(f.kasus[0].sandi, f.kasus[0].hash)).toBe(true);
        },
        LAMBAT,
    );
});
