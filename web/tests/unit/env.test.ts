import { describe, expect, it } from 'vitest';

import { bacaEnv } from '@/server/env';

const KUNCI = 'base64:' + Buffer.alloc(32, 1).toString('base64');
const prod = {
    NODE_ENV: 'production',
    APP_URL: 'https://contoh.test',
    DATABASE_URL: 'postgres://u@localhost/db',
    APP_KEY: KUNCI,
    NIK_HASH_KEY: KUNCI,
};

describe('bacaEnv', () => {
    it('mengizinkan kunci kosong di luar produksi', () => {
        expect(bacaEnv({ NODE_ENV: 'development' })).toMatchObject({ LOG_LEVEL: 'info', APP_DEBUG: 'false' });
    });

    it('menerima env produksi yang lengkap', () => {
        expect(bacaEnv(prod).DATABASE_URL).toBe(prod.DATABASE_URL);
    });

    it('gagal di produksi bila kunci wajib kosong', () => {
        expect(() => bacaEnv({ ...prod, DATABASE_URL: '  ' })).toThrow(/DATABASE_URL/);
        expect(() => bacaEnv({ NODE_ENV: 'production', DATABASE_URL: prod.DATABASE_URL })).toThrow(/APP_URL/);
    });

    it('gagal di produksi bila APP_DEBUG aktif', () => {
        expect(() => bacaEnv({ ...prod, APP_DEBUG: 'true' })).toThrow(/APP_DEBUG/);
    });

    it('tidak menuntut rahasia saat next build', () => {
        expect(bacaEnv({ NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' })).toMatchObject({ NODE_ENV: 'production' });
    });

    it('gagal di produksi bila kunci enkripsi kosong', () => {
        expect(() => bacaEnv({ ...prod, APP_KEY: '' })).toThrow(/APP_KEY/);
        expect(() => bacaEnv({ ...prod, NIK_HASH_KEY: undefined })).toThrow(/NIK_HASH_KEY/);
    });

    it('menolak kunci yang salah format tanpa menampilkan nilainya', () => {
        const pendek = 'base64:' + Buffer.alloc(16, 7).toString('base64');
        for (const [kunci, nilai] of [
            ['APP_KEY', pendek],
            ['APP_PREVIOUS_KEYS', `${KUNCI},${pendek}`],
            ['NIK_HASH_KEY', 'null'],
        ]) {
            const galat = (() => {
                try {
                    bacaEnv({ NODE_ENV: 'development', [kunci]: nilai });
                } catch (e) {
                    return (e as Error).message;
                }
            })();
            expect(galat).toContain(kunci);
            expect(galat).not.toContain(nilai);
        }
        expect(bacaEnv({ NODE_ENV: 'development', APP_PREVIOUS_KEYS: `${KUNCI},` }).APP_PREVIOUS_KEYS).toBe(`${KUNCI},`);
    });
});
