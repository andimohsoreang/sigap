import { NextResponse } from 'next/server';
import { describe, expect, it } from 'vitest';

import { bacaCookie, COOKIE_INGAT, COOKIE_SESI, gantiCookie, pasangCookieIngat, pasangCookieSesi } from '@/server/auth/cookie';
import { kilatkan, reflash, tarik, umurkanKilat, type DataSesi } from '@/server/auth/kilat';
import { ringkasGalat, validasiMasuk } from '@/server/auth/permintaan-masuk';
import { periksaSidik, sidikSandi, type Sesi } from '@/server/auth/sesi';

import { alasanLaravel, laravelWeb } from './laravel-web';

describe('flash (Session\\Store)', () => {
    it('tersedia di permintaan berikutnya saja (umur di awal permintaan = Laravel di akhir permintaan)', () => {
        const d: DataSesi = {};
        kilatkan(d, 'error', 'x'); // permintaan N
        expect(d.error).toBe('x');
        umurkanKilat(d); // awal N+1: masih terbaca
        expect(d.error).toBe('x');
        umurkanKilat(d); // awal N+2: hilang
        expect(d).not.toHaveProperty('error');
        expect(umurkanKilat(d)).toBe(false);
    });

    it('reflash mempertahankan satu permintaan lagi; flash ulang kunci lama memindahkan ke new', () => {
        const d: DataSesi = {};
        kilatkan(d, 'status', 'a');
        umurkanKilat(d);
        reflash(d);
        umurkanKilat(d);
        expect(d.status).toBe('a');
        kilatkan(d, 'status', 'b');
        expect(d._flash).toEqual({ new: ['status'], old: [] });
        umurkanKilat(d);
        umurkanKilat(d);
        expect(d).not.toHaveProperty('status');
    });

    it('_flash rusak tidak melempar; tarik() = pull', () => {
        const d: DataSesi = { _flash: 'rusak', a: 1 };
        expect(umurkanKilat(d)).toBe(false);
        expect(tarik(d, 'a', null)).toBe(1);
        expect(tarik(d, 'a', 'bawaan')).toBe('bawaan');
    });
});

describe('cookie', () => {
    it('bacaCookie: cookie ganda ditolak, nama persis', () => {
        expect(bacaCookie('a=1; cc_session=abc; b=2', 'cc_session')).toBe('abc');
        expect(bacaCookie('cc_session=abc; cc_session=def', 'cc_session')).toBe('ganda');
        expect(bacaCookie('xcc_session=abc', 'cc_session')).toBeNull();
        expect(bacaCookie(null, 'cc_session')).toBeNull();
    });

    it('gantiCookie mengganti/menghapus semua salinan', () => {
        expect(gantiCookie('a=1; cc_session=x; cc_session=y', 'cc_session', 'baru')).toBe('a=1; cc_session=baru');
        expect(gantiCookie('a=1; cc_session=x', 'cc_session', null)).toBe('a=1');
    });

    it('atribut: HttpOnly sesi, XSRF-TOKEN terbaca JS, Max-Age 7200, SameSite lax, Path /', () => {
        const res = NextResponse.next();
        pasangCookieSesi(res, 'id', 'token');
        pasangCookieIngat(res, null);
        const sc = res.headers.getSetCookie();
        expect(COOKIE_SESI).toBe('cc_session'); // NODE_ENV test: tanpa prefix __Host-
        expect(sc[0]).toMatch(/^cc_session=id; Path=\/; Expires=.+; Max-Age=7200; HttpOnly; SameSite=lax$/);
        expect(sc[1]).toMatch(/^XSRF-TOKEN=token; Path=\/; Expires=.+; Max-Age=7200; SameSite=lax$/);
        expect(sc[2]).toMatch(new RegExp(`^${COOKIE_INGAT}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=lax$`));
    });
});

describe('sidik sandi (AuthenticateSession)', () => {
    const sesi = (sidik: string | null) => ({ sidikSandi: sidik }) as Sesi;
    it('sama → cocok; beda → beda; belum ada → simpan; sandi DB kosong → selalu cocok (baris 47)', () => {
        expect(periksaSidik(sesi(sidikSandi('$2y$a')), '$2y$a')).toBe('cocok');
        expect(periksaSidik(sesi(sidikSandi('$2y$a')), '$2y$b')).toBe('beda');
        expect(periksaSidik(sesi(null), '$2y$a')).toBe('simpan');
        expect(periksaSidik(sesi('apa saja'), '')).toBe('cocok');
        expect(periksaSidik(sesi('apa saja'), null)).toBe('cocok');
    });
});

describe('validasi LoginRequest', () => {
    const kasus: Record<string, unknown>[] = [
        {},
        { identifier: null, password: null },
        { identifier: 'a'.repeat(151), password: ['x'] },
        { identifier: ['a'], password: 5 },
        { identifier: 'é'.repeat(150), password: 'x' },
        { identifier: 7, password: '   ' },
    ];

    it('pesan & ringkasan', () => {
        expect(validasiMasuk({ identifier: 'admin', password: 'x' })).toEqual({ ok: true, identifier: 'admin', password: 'x' });
        const g = validasiMasuk({});
        expect(g.ok).toBe(false);
        expect(ringkasGalat(!g.ok ? g.galat : {})).toBe('The identifier field is required. (and 1 more error)');
    });

    it.skipIf(!!alasanLaravel)('sama dengan Validator Laravel asli', { timeout: 60_000 }, () => {
        const laravel = laravelWeb(kasus.map((input) => ({ aksi: 'validasi' as const, input })));
        for (const [i, input] of kasus.entries()) {
            const v = validasiMasuk(input);
            // PHP json_encode: objek kosong → [] (larik).
            expect(v.ok ? [] : v.galat, JSON.stringify(input)).toEqual(laravel[i]);
        }
    });
});
