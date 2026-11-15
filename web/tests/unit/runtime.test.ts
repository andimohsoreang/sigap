import { AxiosError, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';

import { JADWAL } from '@/server/antrean';
import { hashPermintaan, kunciIdempotensi } from '@/server/idempotensi';
import { galatPermanen, idJobOutbox } from '@/server/outbox';

// Bagian murni runtime; perilaku DB-nya di tests/unit/db/runtime.test.ts (npm run test:db).

describe('kunciIdempotensi', () => {
    it('menerima 1–255 karakter ASCII tampak, selain itu null (diproses tanpa idempotensi)', () => {
        expect(kunciIdempotensi(' 7f1c-uuid ')).toBe('7f1c-uuid');
        expect(kunciIdempotensi('a'.repeat(255))).toHaveLength(255);
        for (const salah of [null, undefined, '', '   ', 'a'.repeat(256), 'ada spasi', 'ñ']) expect(kunciIdempotensi(salah)).toBeNull();
    });
});

describe('hashPermintaan', () => {
    it('menolak objek bukan JSON biasa (isi berbeda tidak boleh ber-hash sama)', () => {
        for (const v of [new Blob(['a']), new Map([['a', 1]]), new FormData(), new Date(0), new (class Lampiran {})()]) {
            expect(() => hashPermintaan({ lampiran: v })).toThrow(TypeError);
        }
        // Lampiran diringkas pemanggil.
        expect(hashPermintaan({ lampiran: { nama: 'a.pdf', ukuran: 10, sha256: 'ab' } })).toMatch(/^[0-9a-f]{64}$/);
        expect(hashPermintaan(Object.assign(Object.create(null), { a: 1 }))).toBe(hashPermintaan({ a: 1 }));
    });
});

describe('outbox', () => {
    it('galat permanen: 4xx selain 408/429, antrean pg-boss tidak ada, atau ditandai penerbit', () => {
        const http = (status: number) => new AxiosError('x', 'ERR_BAD_REQUEST', undefined, undefined, { status } as AxiosResponse);
        expect([400, 401, 404, 413].map((s) => galatPermanen(http(s)))).toEqual([true, true, true, true]);
        expect([408, 429, 500, 503].map((s) => galatPermanen(http(s)))).toEqual([false, false, false, false]);
        expect(galatPermanen(new AxiosError('timeout', 'ECONNABORTED'))).toBe(false);
        expect(galatPermanen(Object.assign(new Error('q'), { code: 'PGBOSS_QUEUE_NOT_FOUND' }))).toBe(true);
        expect(galatPermanen(Object.assign(new Error('besar'), { permanen: true }))).toBe(true);
        expect(galatPermanen(new Error('ECONNREFUSED'))).toBe(false);
    });

    it('id job pg-boss = UUID tetap per baris outbox', () => {
        expect(idJobOutbox(1)).toBe('00000000-0000-4000-8000-000000000001');
        expect(idJobOutbox(2 ** 40)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    });
});

describe('jadwal Laravel', () => {
    it('9 entri bootstrap/app.php, masing-masing cron atau setiapDetik', () => {
        expect(JADWAL).toHaveLength(9);
        for (const j of JADWAL) expect(Boolean(j.cron) !== Boolean(j.setiapDetik)).toBe(true);
        expect(JADWAL.find((j) => j.nama === 'ai-macet')?.setiapDetik).toBe(15);
    });
});
