import { describe, expect, it } from 'vitest';

import { bacaRecaller, NAMA_COOKIE_REMEMBER, parseRecaller } from '@/server/legacy/recaller';

import { fixture, kunciUji, type FixtureCookie } from './fixture';

const f = fixture<FixtureCookie>('cookie.json');
const kunci = kunciUji(f);

describe('recaller: vektor SessionGuard::user() lewat cookie remember-me', () => {
    it('nama cookie sama dengan getRecallerName()', () => {
        expect(f.nama_remember).toBe(NAMA_COOKIE_REMEMBER);
    });

    it.each(f.remember)('$label → user $user_id', async ({ terenkripsi, user_id }) => {
        const r = await bacaRecaller({
            cookieHeader: `${NAMA_COOKIE_REMEMBER}=${encodeURIComponent(terenkripsi)}`,
            kunci,
            muat: async (id) => f.pengguna.find((p) => String(p.id) === id) ?? null,
        });
        expect(r ? Number(r.id) : null).toBe(user_id);
    });

    it('tanpa cookie atau cookie kosong → null tanpa memanggil loader', async () => {
        const muat = async () => {
            throw new Error('tidak boleh dipanggil');
        };
        expect(await bacaRecaller({ cookieHeader: null, kunci, muat })).toBeNull();
        expect(await bacaRecaller({ cookieHeader: `${NAMA_COOKIE_REMEMBER}=sampah`, kunci, muat })).toBeNull();
    });
});

describe('recaller: Recaller::valid()', () => {
    it.each([
        ['1|t|h', { id: '1', token: 't', hash: 'h' }],
        ['1|t|h|x', { id: '1', token: 't', hash: 'h' }],
        ['1|t|', { id: '1', token: 't', hash: '' }],
        ['s:5:"1|t|h";', { id: '1', token: 't', hash: 'h' }],
        ['1|t', null],
        ['\t|t|h', null],
        ['1| |h', null],
        ['i:0;', null],
        ['O:8:"stdClass":0:{}', null],
    ])('%j', (nilai, harapan) => {
        expect(parseRecaller(nilai)).toEqual(harapan);
    });
});
