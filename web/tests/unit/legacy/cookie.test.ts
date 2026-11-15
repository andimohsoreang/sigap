import { describe, expect, it } from 'vitest';

import { bacaCookie, dekripsiCookie, enkripsiCookie, prefixCookie, tokenDariHeaderXsrf } from '@/server/legacy/cookie';

import { fixture, kunciUji, type FixtureCookie } from './fixture';

const f = fixture<FixtureCookie>('cookie.json');
const kunci = kunciUji(f);

describe('cookie: vektor EncryptCookies', () => {
    it.each(f.kasus)('$nama: prefix & dekripsi', ({ nama, terenkripsi, prefix, hasil_dekripsi, nilai }) => {
        expect(prefixCookie(nama, kunci.kunci)).toBe(prefix);
        expect(hasil_dekripsi).toBe(nilai);
        expect(dekripsiCookie(nama, terenkripsi, kunci)).toBe(hasil_dekripsi);
    });

    it.each(f.kasus)('$nama: header Set-Cookie Laravel terbaca kembali lewat header Cookie', ({ nama, set_cookie, terenkripsi }) => {
        const pasangan = set_cookie.split(';')[0];
        expect(bacaCookie(`lain=1; ${pasangan}`, nama)).toBe(terenkripsi);
    });

    it.each(f.negatif)('negatif $label sama dengan Laravel', ({ nama, terenkripsi, hasil_dekripsi }) => {
        expect(dekripsiCookie(nama, terenkripsi, kunci)).toBe(hasil_dekripsi);
    });

    it.each(f.header_xsrf)('header X-XSRF-TOKEN $label', ({ header, token }) => {
        expect(tokenDariHeaderXsrf(header, kunci)).toBe(token);
    });

    it.each(f.kasus)('enkripsiCookie $nama bolak-balik', ({ nama, nilai }) => {
        const c = enkripsiCookie(nama, nilai, kunci);
        expect(dekripsiCookie(nama, c, kunci)).toBe(nilai);
        expect(dekripsiCookie(nama + 'x', c, kunci)).toBeNull();
    });
});

describe('cookie: bacaCookie seperti $_COOKIE PHP', () => {
    it('kemunculan pertama menang, urldecode dengan "+" menjadi spasi', () => {
        expect(bacaCookie('a=1; a=2', 'a')).toBe('1');
        expect(bacaCookie('x=%2B%2F%3D+b%ZZ', 'x')).toBe('+/= b%ZZ');
        expect(bacaCookie(' \tsp=ok', 'sp')).toBe('ok');
        expect(bacaCookie('sigap_session_x=1', 'sigap_session')).toBeNull();
        expect(bacaCookie(null, 'a')).toBeNull();
    });
});
