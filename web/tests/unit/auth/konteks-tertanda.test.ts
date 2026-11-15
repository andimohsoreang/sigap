import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

// Konteks auth bertanda tangan dari proxy ke rute (optimasi O1): hanya diterima dalam permintaan yang sama.
vi.stubEnv('APP_KEY', 'base64:' + Buffer.alloc(32, 4).toString('base64'));
const { bacaKonteks, HEADER_KONTEKS, tandaiKonteks } = await import('@/server/auth/konteks-tertanda');
const { hashId, sidikSandi } = await import('@/server/auth/sesi');
afterAll(() => vi.unstubAllEnvs());
afterEach(() => vi.useRealTimers());

const sesi = () => ({
    id: 'a'.repeat(43),
    ada: true,
    userId: 7,
    csrf: 'token',
    sidikSandi: sidikSandi('$2y$04$hash'),
    data: { _old_input: { identifier: '3171010101010077' } },
    terakhirAktif: new Date('2026-11-16T01:00:00Z'),
});
const pengguna = () => ({
    id: 7,
    name: 'Admin',
    username: 'admin',
    role: 'super_admin',
    isActive: true,
    password: '$2y$04$hash',
    emailVerifiedAt: null,
    registeredBy: null,
    regionId: null,
    rememberToken: null,
});
const minta = (nilai: string | null, nonce: string | null) => {
    const h = new Headers();
    if (nilai !== null) h.set(HEADER_KONTEKS, nilai);
    if (nonce !== null) h.set('x-nonce', nonce);
    return h;
};

describe('konteks bertanda tangan', () => {
    it('sah di permintaan yang sama; isi header minimal (tanpa NIK/hash sandi/token)', () => {
        const nilai = tandaiKonteks('nonce-A', sesi(), pengguna())!;
        const [versi, rid, sid, uid, sidik] = nilai.split('.');
        expect([versi, sid, uid, sidik]).toEqual(['v1', hashId('a'.repeat(43)), '7', sidikSandi('$2y$04$hash')]);
        expect(rid).toMatch(/^[A-Za-z0-9_-]{22}$/);
        for (const rahasia of ['3171010101010077', '$2y$04$hash', 'token', 'a'.repeat(43)]) expect(nilai).not.toContain(rahasia);
        expect(bacaKonteks(minta(nilai, 'nonce-A'))).toEqual({ sesi: sesi(), pengguna: pengguna() });
    });

    it('tamu tanpa sesi juga bertanda tangan', () => {
        const nilai = tandaiKonteks('n', null, null)!;
        expect(nilai.split('.').slice(2, 5)).toEqual(['-', '-', '-']);
        expect(bacaKonteks(minta(nilai, 'n'))).toEqual({ sesi: null, pengguna: null });
    });

    it('disalin ke permintaan lain (nonce beda) → tidak sah', () => {
        const nilai = tandaiKonteks('nonce-A', sesi(), pengguna())!;
        expect(bacaKonteks(minta(nilai, 'nonce-B'))).toBe('tidak-sah');
        expect(bacaKonteks(minta(nilai, null))).toBe('tidak-sah');
    });

    it('palsu, diubah, atau tidak ada → tidak sah / tidak ada', () => {
        const nilai = tandaiKonteks('n', sesi(), pengguna())!;
        const b = nilai.split('.');
        expect(bacaKonteks(minta([b[0], b[1], b[2], '1', b[4], b[5]].join('.'), 'n'))).toBe('tidak-sah'); // id pengguna lain
        expect(bacaKonteks(minta('v1.x.y.1.z.palsu', 'n'))).toBe('tidak-sah');
        expect(bacaKonteks(minta('v2.' + b.slice(1).join('.'), 'n'))).toBe('tidak-sah');
        expect(bacaKonteks(minta(null, 'n'))).toBe('tidak-ada');
    });

    it('kedaluwarsa (entri memori dibuang) → tidak sah; salinan tidak berbagi objek', () => {
        vi.useFakeTimers({ now: Date.now() });
        const nilai = tandaiKonteks('n', sesi(), pengguna())!;
        const k = bacaKonteks(minta(nilai, 'n'));
        if (typeof k !== 'object') throw new Error('harus sah');
        k.sesi!.data.ubah = true;
        expect(bacaKonteks(minta(nilai, 'n'))).toMatchObject({ sesi: { data: { _old_input: {} } } });
        expect((bacaKonteks(minta(nilai, 'n')) as { sesi: { data: object } }).sesi.data).not.toHaveProperty('ubah');
        vi.advanceTimersByTime(61_000);
        tandaiKonteks('n', null, null); // memicu pembersihan
        expect(bacaKonteks(minta(nilai, 'n'))).toBe('tidak-sah');
    });
});
