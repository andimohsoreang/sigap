import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buatKlien } from '@/server/http/klien';

import { serverUji } from './server-uji';

let srv: Awaited<ReturnType<typeof serverUji>>;

beforeAll(async () => {
    srv = await serverUji((req, res) => {
        if (req.url === '/pindah') res.writeHead(302, { Location: '/tujuan' }).end();
        else if (req.url === '/menetes') {
            // Satu byte tiap 100 ms: tidak pernah diam selama `timeout`, tapi tidak pernah selesai.
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            const t = setInterval(() => res.write('.'), 100);
            res.on('close', () => clearInterval(t));
        } else res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ path: req.url }));
    });
});
afterAll(() => srv.tutup());

describe('buatKlien', () => {
    it('memakai default aman', () => {
        const d = buatKlien({ baseURL: srv.url, timeoutMs: 1500, maxBytes: 1024 }).defaults;
        expect(d).toMatchObject({
            adapter: 'http',
            baseURL: srv.url,
            allowAbsoluteUrls: false,
            timeout: 1500,
            maxContentLength: 1024,
            maxBodyLength: 1024,
            maxRedirects: 0,
            proxy: false,
        });
        expect(d.headers['User-Agent']).toBe('ContactCenter/1.0');
        expect(buatKlien({ timeoutMs: 1, maxBytes: 1 }).defaults.allowAbsoluteUrls).toBe(true);
    });

    it('menghentikan respons menetes pada batas waktu total', async () => {
        const mulai = Date.now();
        const galat = await buatKlien({ baseURL: srv.url, timeoutMs: 400, maxBytes: 1024 })
            .get('/menetes')
            .catch((e: unknown) => e);
        expect(galat).toMatchObject({ code: 'ERR_CANCELED' });
        expect(Date.now() - mulai).toBeLessThan(1500);
    });

    it('tetap menghormati signal pemanggil', async () => {
        const galat = await buatKlien({ baseURL: srv.url, timeoutMs: 5000, maxBytes: 1024 })
            .get('/menetes', { signal: AbortSignal.timeout(150) })
            .catch((e: unknown) => e);
        expect(galat).toMatchObject({ code: 'ERR_CANCELED' });
    });

    it('URL absolut tidak keluar dari baseURL', async () => {
        const res = await buatKlien({ baseURL: srv.url, timeoutMs: 2000, maxBytes: 1024 }).get('http://contoh.invalid/rahasia');
        expect(res.data).toEqual({ path: '/http://contoh.invalid/rahasia' });
    });

    it('tidak mengikuti redirect secara default', async () => {
        const sebelum = srv.permintaan.length;
        const galat = await buatKlien({ baseURL: srv.url, timeoutMs: 2000, maxBytes: 1024 })
            .get('/pindah')
            .catch((e: unknown) => e);
        expect(galat).toMatchObject({ response: { status: 302, headers: { location: '/tujuan' } } });
        expect(srv.permintaan.slice(sebelum).map((r) => r.url)).toEqual(['/pindah']);
    });

    it('menolak respons melebihi maxBytes', async () => {
        await expect(buatKlien({ baseURL: srv.url, timeoutMs: 2000, maxBytes: 5 }).get('/besar')).rejects.toThrow(/maxContentLength/);
    });
});
