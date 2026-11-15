// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type * as ModulApi from '@/lib/api';

import { serverUji } from './server-uji';

declare const jsdom: { reconfigure(opsi: { url: string }): void; window: { _origin: string } };

const BALASAN: Record<string, [number, object]> = {
    '/validasi': [422, { message: 'Kontak wajib diisi.', errors: { kontak: ['Kontak wajib diisi.'] } }],
    '/batas': [429, { message: 'Too Many Attempts.' }],
    '/rusak': [500, { message: 'Server Error' }],
};

let srv: Awaited<ReturnType<typeof serverUji>>;
let api: typeof ModulApi.api;
let galatApi: typeof ModulApi.galatApi;

beforeAll(async () => {
    srv = await serverUji((req, res) => {
        const [status, body] = BALASAN[req.url ?? ''] ?? [200, { path: req.url }];
        res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
    });
    // Halaman jsdom dipindah ke origin server uji, sehingga permintaan api same-origin. reconfigure() tidak memperbarui
    // origin yang dipakai XHR jsdom (window._origin, diisi sekali saat window dibuat), jadi disetel manual.
    jsdom.reconfigure({ url: `${srv.url}/` });
    jsdom.window._origin = srv.url;
    // axios membaca origin halaman saat modulnya dimuat (cek same-origin XSRF), jadi api diimpor setelah origin dipindah.
    ({ api, galatApi } = await import('@/lib/api'));
});
afterAll(() => srv.tutup());

describe('api (browser)', () => {
    it.each([
        'https://contoh.invalid/x',
        '//contoh.invalid/x',
        '/\\contoh.invalid/x',
        '\\\\contoh.invalid/x',
        '\t//contoh.invalid',
        '/\t/contoh.invalid',
        'relatif',
    ])('menolak %j tanpa mengirim permintaan', async (url) => {
        const sebelum = srv.permintaan.length;
        await expect(api.get(url)).rejects.toThrow(/same-origin/);
        expect(srv.permintaan.length).toBe(sebelum);
    });

    it('menyertakan X-XSRF-TOKEN dari cookie pada POST same-origin', async () => {
        document.cookie = 'XSRF-TOKEN=abc%3D';
        await api.post('/kirim', { isi: 'halo' });
        const req = srv.permintaan.at(-1)!;
        expect(req.url).toBe('/kirim');
        expect(req.headers['x-xsrf-token']).toBe('abc=');
        expect(req.headers.accept).toBe('application/json');
    });
});

describe('galatApi', () => {
    const galat = (url: string) => api.get(url).catch((e: unknown) => galatApi(e));

    it('memetakan 422 validasi Laravel', async () => {
        expect(await galat('/validasi')).toEqual({ status: 422, message: 'Kontak wajib diisi.', errors: { kontak: ['Kontak wajib diisi.'] } });
    });

    it('memetakan 429 dan 500', async () => {
        expect(await galat('/batas')).toEqual({ status: 429, message: 'Too Many Attempts.', errors: {} });
        expect(await galat('/rusak')).toEqual({ status: 500, message: 'Server Error', errors: {} });
    });

    it('galat jaringan tanpa respons', () => {
        expect(galatApi(new Error('putus'))).toEqual({ status: null, message: null, errors: {} });
    });
});
