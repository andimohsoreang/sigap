// @vitest-environment jsdom
// Halaman jsdom berada di origin server uji (port tetap), sehingga permintaan api same-origin.
// @vitest-environment-options {"url": "http://127.0.0.1:47613/"}
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, galatApi } from '@/lib/api';

import { serverUji } from './server-uji';

const BALASAN: Record<string, [number, object]> = {
    '/validasi': [422, { message: 'Kontak wajib diisi.', errors: { kontak: ['Kontak wajib diisi.'] } }],
    '/batas': [429, { message: 'Too Many Attempts.' }],
    '/rusak': [500, { message: 'Server Error' }],
};

let srv: Awaited<ReturnType<typeof serverUji>>;

beforeAll(async () => {
    srv = await serverUji((req, res) => {
        const [status, body] = BALASAN[req.url ?? ''] ?? [200, { path: req.url }];
        res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
    }, 47613);
});
afterAll(() => srv.tutup());

describe('api (browser)', () => {
    it('URL absolut tetap ke origin sendiri', async () => {
        const res = await api.get('https://contoh.invalid/x');
        expect(res.data).toEqual({ path: '/https://contoh.invalid/x' });
    });

    it('menyertakan X-XSRF-TOKEN dari cookie pada POST same-origin', async () => {
        document.cookie = 'XSRF-TOKEN=abc%3D';
        await api.post('/kirim', { isi: 'halo' });
        const req = srv.permintaan.at(-1)!;
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
