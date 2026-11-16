import { describe, expect, it } from 'vitest';

import { langkahRute } from '@/server/auth/guard';
import { validasiMasuk } from '@/server/auth/permintaan-masuk';
import { batasBody, bodyTerlaluBesar, GalatBodyBesar, HTML_413, MAKS_BODY, MAKS_BODY_KECIL, respons413 } from '@/server/web/batas-body';
import { asalSah, metodeBaca, tokenCocok, tokenDariPermintaan } from '@/server/web/csrf';
import { kebijakanCsp } from '@/server/web/header';
import { bacaInput, inputBoolean, nilaiInput, trimLaravel } from '@/server/web/input';
import { inginJson, ipKlien, jalurAman, jalurTerdekode, responsJson, tipeDiterima } from '@/server/web/permintaan';
import { respons419, responsGalat } from '@/server/web/respons';
import nextConfig from '../../../next.config';

import { alasanLaravel, laravelWeb } from './laravel-web';

const h = (x: Record<string, string>) => new Headers(x);

describe('CSP (SecurityHeaders)', () => {
    it('produksi app2: string persis, termasuk reCAPTCHA & origin WebSocket', () => {
        expect(kebijakanCsp({ nonce: 'N', ketat: true, recaptcha: true, appUrl: 'https://app2.andimohamad.my.id' })).toBe(
            "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; " +
                "script-src 'self' 'nonce-N' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/; " +
                "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://www.transmigrasi.go.id; " +
                "font-src 'self' data:; connect-src 'self' wss://app2.andimohamad.my.id; " +
                'frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/; ' +
                "worker-src 'self' blob:; manifest-src 'self'",
        );
    });

    it('tanpa reCAPTCHA → frame-src none; dev → unsafe-inline/eval tanpa nonce, localhost & 127.0.0.1', () => {
        const dev = kebijakanCsp({ nonce: 'N', ketat: false, recaptcha: false, appUrl: 'http://localhost:3000' });
        expect(dev).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval';");
        expect(dev).toContain("connect-src 'self' ws://localhost:3000 ws://127.0.0.1:3000;");
        expect(dev).toContain("frame-src 'none';");
        expect(kebijakanCsp({ nonce: 'N', ketat: true, recaptcha: false })).toContain("connect-src 'self';");
    });

    it('header statis next.config untuk semua jalur, nilai nginx produksi', async () => {
        const aturan = (await nextConfig.headers!()).find((a) => a.source === '/:path*');
        expect(aturan?.headers).toEqual([
            { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=()' },
        ]);
    });
});

describe('permintaan', () => {
    it('ipKlien hanya mempercayai CF-Connecting-IP (X-Forwarded-For bisa dipalsukan klien)', () => {
        expect(ipKlien(h({ 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '1.1.1.1' }))).toBe('203.0.113.9');
        expect(ipKlien(h({ 'x-forwarded-for': '1.1.1.1' }))).toBe('127.0.0.1');
        expect(ipKlien(h({ 'cf-connecting-ip': 'bukan-ip' }))).toBe('127.0.0.1');
        expect(ipKlien(h({ 'cf-connecting-ip': '2001:db8::1' }))).toBe('2001:db8::1');
    });

    it('expectsJson seperti Laravel', () => {
        expect(tipeDiterima('text/html;q=0.5, application/json')).toEqual(['application/json', 'text/html']);
        expect(inginJson(h({ accept: 'application/json' }))).toBe(true);
        expect(inginJson(h({ accept: 'application/vnd.api+json' }))).toBe(true);
        expect(inginJson(h({ 'x-requested-with': 'XMLHttpRequest' }))).toBe(true);
        expect(inginJson(h({ 'x-requested-with': 'XMLHttpRequest', accept: '*/*' }))).toBe(true);
        // Inertia: ajax tetapi Accept text/html → bukan JSON.
        expect(inginJson(h({ 'x-requested-with': 'XMLHttpRequest', 'x-inertia': 'true', accept: 'text/html, application/xhtml+xml' }))).toBe(false);
        expect(inginJson(h({ 'x-requested-with': 'XMLHttpRequest', 'x-pjax': 'true' }))).toBe(false);
        expect(inginJson(h({ accept: 'text/html' }))).toBe(false);
        expect(responsJson('/api/v1/x', h({}))).toBe(true);
        expect(responsJson('/apix', h({}))).toBe(false);
    });

    it('jalurTerdekode = $request->path() terdekode', () => {
        expect(jalurTerdekode('/')).toBe('/');
        expect(jalurTerdekode('/admin/')).toBe('admin');
        expect(jalurTerdekode('/admin%2Fpetugas')).toBe('admin/petugas');
        expect(jalurTerdekode('/%E0%A4%A')).toBe('%E0%A4%A');
    });

    it('jalurAman menolak open redirect', () => {
        const asal = 'https://cc.test';
        expect(jalurAman('https://cc.test/admin?x=1', asal)).toBe('/admin?x=1');
        expect(jalurAman('/portal-warga', asal)).toBe('/portal-warga');
        for (const buruk of [
            'https://jahat.test/',
            '//jahat.test',
            '/\\jahat.test',
            '\t//jahat.test',
            'javascript:alert(1)',
            'http://cc.test/',
            null,
            '',
        ]) {
            expect(jalurAman(buruk, asal), String(buruk)).toBeNull();
        }
    });
});

describe('input (TrimStrings + ConvertEmptyStringsToNull)', () => {
    it('trim Str::trim termasuk karakter tak terlihat; password tidak di-trim; kosong → null', async () => {
        expect(trimLaravel('​  korban ﻿\t')).toBe('korban');
        const req = new Request('http://x/masuk?identifier=dariquery&q=1', {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: 'identifier=+admin1+&password=+rahasia+&kosong=&daftar[]=a&daftar[]=b&peta[k]=v',
        });
        expect(await bacaInput(req, MAKS_BODY)).toEqual({
            identifier: 'admin1',
            password: ' rahasia ',
            kosong: null,
            daftar: ['a', 'b'],
            peta: { k: 'v' },
            q: '1',
        });
    });

    it('JSON body; JSON rusak → kosong; boolean seperti FILTER_VALIDATE_BOOLEAN', async () => {
        const json = (body: string) => new Request('http://x/', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
        expect(await bacaInput(json('{"identifier":5,"remember":true}'), MAKS_BODY)).toEqual({ identifier: 5, remember: true });
        expect(await bacaInput(json('{rusak'), MAKS_BODY)).toEqual({});
        for (const ya of [true, 1, '1', 'true', 'on', 'YES']) expect(inputBoolean({ r: ya }, 'r')).toBe(true);
        for (const tidak of [false, 0, '0', 'off', 'no', '', null, undefined, 'x']) expect(inputBoolean({ r: tidak }, 'r')).toBe(false);
    });
});

describe('input tidak mencemari prototipe (audit run-2)', () => {
    const cemar = () => [({} as Record<string, unknown>).a, ({} as Record<string, unknown>).keluarkan, ({} as Record<string, unknown>).metode];

    it('query, form, dan JSON dengan __proto__/constructor/prototype: Object.prototype tetap bersih, kunci dibuang', async () => {
        const kueri = await bacaInput(new Request('http://x/broadcasting/auth?__proto__[a]=1&__proto__[keluarkan]=1&x[__proto__]=2&ok=1'), MAKS_BODY);
        const form = await bacaInput(
            new Request('http://x/', {
                method: 'POST',
                headers: { 'content-type': 'application/x-www-form-urlencoded' },
                body: '__proto__[a]=1&constructor[prototype][a]=1&prototype[a]=1&__proto__=1&nama=uji',
            }),
            MAKS_BODY,
        );
        const json = await bacaInput(
            new Request('http://x/', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: '{"__proto__":{"a":1},"b":{"constructor":{"prototype":{"a":1}},"c":1}}',
            }),
            MAKS_BODY,
        );
        expect(cemar()).toEqual([undefined, undefined, undefined]);
        expect({ ...kueri }).toEqual({ ok: '1' });
        expect({ ...form }).toEqual({ nama: 'uji' });
        expect(JSON.parse(JSON.stringify(json))).toEqual({ b: { c: 1 } });
        // Objek hasil tanpa prototipe: field yang tidak dikirim tidak pernah "ada" lewat pewarisan.
        expect(Object.getPrototypeOf(kueri)).toBeNull();
        expect(nilaiInput(kueri, 'toString')).toBeUndefined();
    });

    it('larik campuran seperti PHP: a[]=1&a[x]=2 → satu wadah, bukan properti larik (length)', async () => {
        const r = await bacaInput(new Request('http://x/?a[]=1&a[x]=2&b[]=1&b[length]=0'), MAKS_BODY);
        expect(JSON.parse(JSON.stringify(r))).toEqual({ a: { 0: '1', x: '2' }, b: { 0: '1', length: '0' } });
    });

    it('guard tidak terpengaruh walau prototipe sempat tercemar (pertahanan berlapis)', () => {
        const awal = langkahRute('GET', 'admin');
        const proto = Object.prototype as Record<string, unknown>;
        proto.metode = ['X'];
        try {
            expect(langkahRute('GET', 'admin')).toEqual(awal);
            expect(tokenDariPermintaan(h({}), Object.create({ _token: 'warisan' }))).toBeNull();
            expect(validasiMasuk(Object.create({ identifier: 'a', password: 'b' })).ok).toBe(false);
        } finally {
            delete proto.metode;
        }
        expect(awal).toEqual(['masuk', { peran: ['admin_kawasan', 'super_admin'] }]);
    });
});

describe('batas body (client_max_body_size 12m)', () => {
    it('12 MB umum, 64 KB rute auth; Content-Length rusak atau chunked tanpa panjang ditolak', () => {
        expect(batasBody('masuk')).toBe(MAKS_BODY_KECIL);
        expect(batasBody('broadcasting/auth')).toBe(MAKS_BODY_KECIL);
        expect(batasBody('chat/lampiran')).toBe(MAKS_BODY);
        expect(bodyTerlaluBesar(h({ 'content-length': String(MAKS_BODY) }), MAKS_BODY)).toBe(false);
        expect(bodyTerlaluBesar(h({ 'content-length': String(MAKS_BODY + 1) }), MAKS_BODY)).toBe(true);
        expect(bodyTerlaluBesar(h({ 'content-length': '1e9' }), MAKS_BODY)).toBe(true);
        expect(bodyTerlaluBesar(h({ 'transfer-encoding': 'chunked' }), MAKS_BODY)).toBe(true);
        expect(bodyTerlaluBesar(h({}), MAKS_BODY)).toBe(false);
    });

    it('bacaInput menolak sebelum membaca body; 413 berbentuk halaman nginx', async () => {
        const req = new Request('http://x/masuk', { method: 'POST', headers: { 'content-length': String(MAKS_BODY_KECIL + 1) }, body: 'a=1' });
        await expect(bacaInput(req, MAKS_BODY_KECIL)).rejects.toBeInstanceOf(GalatBodyBesar);
        const r = respons413();
        expect([r.status, r.headers.get('content-type'), await r.text()]).toEqual([413, 'text/html', HTML_413]);
    });
});

describe('CSRF', () => {
    it('metode baca tidak dicek', () => {
        expect(['GET', 'HEAD', 'OPTIONS', 'get'].every(metodeBaca)).toBe(true);
        expect(['POST', 'PUT', 'PATCH', 'DELETE'].some(metodeBaca)).toBe(false);
    });

    it('asal: Sec-Fetch-Site diutamakan, lalu Origin; tanpa keduanya lolos ke cek token', () => {
        const asal = 'https://cc.test';
        expect(asalSah(h({ 'sec-fetch-site': 'same-origin' }), asal)).toBe(true);
        expect(asalSah(h({ 'sec-fetch-site': 'none' }), asal)).toBe(true);
        expect(asalSah(h({ 'sec-fetch-site': 'same-site', origin: asal }), asal)).toBe(false);
        expect(asalSah(h({ 'sec-fetch-site': 'cross-site' }), asal)).toBe(false);
        expect(asalSah(h({ origin: 'https://jahat.test' }), asal)).toBe(false);
        expect(asalSah(h({ origin: 'null' }), asal)).toBe(false);
        expect(asalSah(h({ origin: asal }), asal)).toBe(true);
        expect(asalSah(h({}), asal)).toBe(true);
    });

    it('token dari _token → X-CSRF-TOKEN → X-XSRF-TOKEN, dibandingkan dengan token sesi', () => {
        expect(tokenDariPermintaan(h({ 'x-xsrf-token': 'c', 'x-csrf-token': 'b' }), { _token: 'a' })).toBe('a');
        expect(tokenDariPermintaan(h({ 'x-xsrf-token': 'c', 'x-csrf-token': 'b' }), {})).toBe('b');
        expect(tokenDariPermintaan(h({ 'x-xsrf-token': 'c' }), { _token: null })).toBe('c');
        expect(tokenDariPermintaan(h({}), {})).toBeNull();
        expect(tokenCocok('abc', 'abc')).toBe(true);
        expect(tokenCocok('abc', 'abd')).toBe(false);
        expect(tokenCocok('abc', null)).toBe(false);
        expect(tokenCocok('', '')).toBe(false);
        expect(tokenCocok(null, 'abc')).toBe(false);
    });
});

describe('respons galat', () => {
    it('JSON 419/403/429 dengan JSON_PRETTY_PRINT; HTML 419 berjudul Page Expired', async () => {
        const r = respons419(true);
        expect(r.status).toBe(419);
        expect(r.headers.get('content-type')).toBe('application/json');
        expect(await r.text()).toBe('{\n    "message": "CSRF token mismatch."\n}');
        expect(await responsGalat(403, true).text()).toBe('{\n    "message": ""\n}');
        const html = await respons419(false).text();
        expect(html).toContain('<title>Page Expired</title>');
        expect(responsGalat(429, false, 'x', { 'Retry-After': '5' }).headers.get('retry-after')).toBe('5');
    });
});

describe.skipIf(!!alasanLaravel)(
    `dibandingkan dengan Laravel asli${alasanLaravel ? ` — dilewati: ${alasanLaravel}` : ''}`,
    { timeout: 60_000 },
    () => {
        it('halaman & JSON galat sama byte per byte', async () => {
            const html = { accept: 'text/html' };
            const json = { accept: 'application/json' };
            const kasus = [
                { jenis: '419', metode: 'POST', header: html, kita: () => respons419(false) },
                { jenis: '419', metode: 'POST', header: json, kita: () => respons419(true) },
                {
                    jenis: '403',
                    metode: 'GET',
                    header: html,
                    pesan: 'Akses khusus petugas',
                    kita: () => responsGalat(403, false, 'Akses khusus petugas'),
                },
                { jenis: 'akses', metode: 'POST', header: html, kita: () => responsGalat(403, false) },
                { jenis: 'akses', metode: 'POST', header: json, kita: () => responsGalat(403, true) },
                {
                    jenis: '403',
                    metode: 'GET',
                    header: json,
                    pesan: 'Alamat surel Anda belum diverifikasi.',
                    kita: () => responsGalat(403, true, 'Alamat surel Anda belum diverifikasi.'),
                },
                { jenis: '429', metode: 'POST', header: html, kita: () => responsGalat(429, false, 'Too Many Attempts.') },
                { jenis: '429', metode: 'POST', header: json, kita: () => responsGalat(429, true, 'Too Many Attempts.') },
                { jenis: '503', metode: 'POST', header: html, kita: () => responsGalat(503, false) },
                { jenis: '503', metode: 'POST', header: json, kita: () => responsGalat(503, true) },
                { jenis: '500', metode: 'GET', header: html, kita: () => responsGalat(500, false, 'Server Error') },
                { jenis: '500', metode: 'GET', header: json, kita: () => responsGalat(500, true, 'Server Error') },
                { jenis: '401', metode: 'GET', header: json, kita: () => Response.json({ message: 'Unauthenticated.' }, { status: 401 }) },
            ];
            const laravel = laravelWeb<{ status: number; jenis: string; isi: string }>(
                kasus.map((k) => ({ aksi: 'galat', jenis: k.jenis, jalur: '/admin/x', metode: k.metode, header: k.header, pesan: k.pesan })),
            );
            for (const [i, k] of kasus.entries()) {
                const r = k.kita();
                expect({ status: r.status, jenis: r.headers.get('content-type'), isi: await r.text() }, `${k.jenis} ${k.header.accept}`).toEqual(
                    laravel[i],
                );
            }
        });

        it('CSP sama dengan SecurityHeaders produksi (nonce dinormalkan)', () => {
            const kasus = [
                { recaptcha: 'kunci-situs', host: 'app2.andimohamad.my.id', skema: 'https', port: 443, appUrl: 'https://app2.andimohamad.my.id' },
                { recaptcha: null, host: 'cc-uji.andimohamad.my.id', skema: 'https', port: null, appUrl: 'https://cc-uji.andimohamad.my.id' },
                { recaptcha: 'k', host: null, skema: 'https', port: null, appUrl: undefined },
            ];
            const laravel = laravelWeb<{ csp: string; nonce: string }>(
                kasus.map(({ recaptcha, host, skema, port }) => ({ aksi: 'csp', recaptcha, host, skema, port })),
            );
            for (const [i, k] of kasus.entries()) {
                expect(kebijakanCsp({ nonce: laravel[i].nonce, ketat: true, recaptcha: !!k.recaptcha, appUrl: k.appUrl })).toBe(laravel[i].csp);
                expect(laravel[i].nonce).toMatch(/^[A-Za-z0-9]{40}$/);
            }
        });
    },
);
