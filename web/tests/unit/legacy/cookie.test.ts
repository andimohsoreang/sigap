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

// Hasil `php -S` PHP 8.4.10 dengan header Cookie apa adanya (var_dump $_COOKIE), 15 Nov 2026.
const PROBE_PHP: [string, string, string | null][] = [
    ['a=a+b%2Bc', 'a', 'a+b+c'],
    ['a=%ZZ%4%41', 'a', '%ZZ%4A'],
    ['a=1; a=2', 'a', '1'],
    ['sigap_session=a;sigap_session=b', 'sigap_session', 'a'],
    ['sigap.session=x; sigap_session=y', 'sigap_session', 'x'],
    ['sigap session=x', 'sigap_session', 'x'],
    ['sigap_session=y; sigap.session=x', 'sigap_session', 'y'],
    ['sigap_session[a]=x; sigap_session=y', 'sigap_session', null],
    ['sigap_session=y; sigap_session[a]=x', 'sigap_session', null],
    ['sigap_session[]=x', 'sigap_session', null],
    ['sigap_session[=x', 'sigap_session_', 'x'],
    ['sigap_session[=x', 'sigap_session', null],
    ['sigap_session]=x', 'sigap_session]', 'x'],
    [' \t sp=ok', 'sp', 'ok'],
    ['sp=ok ; b=2', 'sp', 'ok '],
    ['sp=ok ; b=2', 'b', '2'],
    ['%73igap_session=x', 'sigap_session', null],
    ['a="quoted"', 'a', '"quoted"'],
    ['a=b=c', 'a', 'b=c'],
    ['noeq; a=1', 'noeq', ''],
    ['a=', 'a', ''],
    ['a=1,b=2', 'a', '1,b=2'],
    ['a=1,b=2', 'b', null],
    ['.a=1', '_a', '1'],
    [' a b=1', 'a_b', '1'],
    ['a =1', 'a_', '1'],
    ['a= 1', 'a', ' 1'],
    ['a b.c=1', 'a_b_c', '1'],
    ['a\tb=1', 'a\tb', '1'],
    ['a.b[c.d]=1', 'a_b', null],
    ['a[b=1', 'a_b', '1'],
    ['a%5Bb%5D=1', 'a%5Bb%5D', '1'],
    [';;a=1', 'a', '1'],
    ['s=%00x', 's', '\0x'],
];

describe('cookie: bacaCookie seperti $_COOKIE PHP 8.4', () => {
    it.each(PROBE_PHP)('%j → %s = %j', (header, nama, harapan) => {
        expect(bacaCookie(header, nama)).toBe(harapan);
    });

    it('header kosong', () => {
        expect(bacaCookie(null, 'a')).toBeNull();
        expect(bacaCookie('', 'a')).toBeNull();
    });
});
