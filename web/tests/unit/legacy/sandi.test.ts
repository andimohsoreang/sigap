import { availableParallelism } from 'node:os';

import { afterAll, describe, expect, it } from 'vitest';

import { GalatSandiSibuk, hashSandi, MAKS_ANTREAN, tutupPoolSandi, ukuranPool, verifikasiSandi } from '@/server/legacy/sandi';

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

describe('sandi: batas pool dan antrean', () => {
    it('BCRYPT_POOL: bawaan 1, dibatasi [1, availableParallelism()-1]', () => {
        const maks = Math.max(1, availableParallelism() - 1);
        expect(ukuranPool(undefined)).toBe(1);
        expect(ukuranPool('')).toBe(1);
        expect(ukuranPool('abc')).toBe(1);
        expect(ukuranPool('0')).toBe(1);
        expect(ukuranPool('-3')).toBe(1);
        expect(ukuranPool('2')).toBe(Math.min(2, maks));
        expect(ukuranPool('9999')).toBe(maks);
    });

    it(
        `lebih dari ${MAKS_ANTREAN} pekerjaan → GalatSandiSibuk; yang dibatalkan dibuang sebelum berjalan`,
        async () => {
            const { hash, sandi } = f.kasus[0];
            const batal = new AbortController();
            const mulai = performance.now();
            const jalan = Array.from({ length: MAKS_ANTREAN }, () => verifikasiSandi(sandi, hash, batal.signal));
            await expect(verifikasiSandi(sandi, hash)).rejects.toBeInstanceOf(GalatSandiSibuk);
            await expect(hashSandi('x')).rejects.toBeInstanceOf(GalatSandiSibuk);

            batal.abort(new Error('pemanggil menyerah'));
            const hasil = await Promise.allSettled(jalan);
            // Hanya yang sudah berjalan (satu per worker) selesai; sisanya ditolak tanpa menghitung bcrypt.
            const selesai = hasil.filter((h) => h.status === 'fulfilled');
            expect(selesai.length).toBeGreaterThanOrEqual(1);
            expect(selesai.length).toBeLessThanOrEqual(ukuranPool());
            expect(hasil.filter((h) => h.status === 'rejected' && (h.reason as Error).message === 'pemanggil menyerah')).toHaveLength(
                MAKS_ANTREAN - selesai.length,
            );
            expect(performance.now() - mulai).toBeLessThan(5_000); // 32 × ±0,4 dtk bila tidak dibuang

            // Sinyal yang sudah dibatalkan ditolak tanpa masuk antrean; antrean kosong lagi menerima pekerjaan.
            await expect(verifikasiSandi(sandi, hash, batal.signal)).rejects.toThrow('pemanggil menyerah');
            expect(await verifikasiSandi(sandi, hash)).toBe(true);
        },
        LAMBAT,
    );
});
