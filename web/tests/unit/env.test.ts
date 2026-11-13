import { describe, expect, it } from 'vitest';

import { bacaEnv } from '@/server/env';

const prod = { NODE_ENV: 'production', APP_URL: 'https://contoh.test', DATABASE_URL: 'postgres://u@localhost/db' };

describe('bacaEnv', () => {
    it('mengizinkan kunci kosong di luar produksi', () => {
        expect(bacaEnv({ NODE_ENV: 'development' })).toMatchObject({
            LOG_LEVEL: 'info',
            APP_DEBUG: 'false',
            APP_LOCALE: 'id',
            APP_TIMEZONE: 'Asia/Jakarta',
            SESSION_ENCRYPT: 'false',
        });
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
});
