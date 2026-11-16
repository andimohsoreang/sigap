import { NextRequest } from 'next/server';
import { afterAll, describe, expect, it, vi } from 'vitest';

// NV-C (audit run-2): galat di route handler auth (mis. DB mati) dicatat lewat pino tanpa parameter query lalu dijawab
// 500 Laravel — bukan dicetak Next.js apa adanya (console.error) dengan csrf_token/IP/UA.
vi.stubEnv('DATABASE_URL', 'postgres://cc_app@127.0.0.1:1/tidak_ada');
vi.stubEnv('APP_KEY', 'base64:' + Buffer.alloc(32, 2).toString('base64'));
vi.stubEnv('LOG_LEVEL', 'silent');
const { prosesIzinKanal, prosesKeluar, prosesMasuk } = await import('@/server/auth/rute');
const { log } = await import('@/server/log');
const { tutupDb } = await import('@/server/db/client');
const { COOKIE_SESI } = await import('@/server/auth/cookie');
afterAll(async () => {
    await tutupDb();
    vi.unstubAllEnvs();
});

describe('galat rute auth', () => {
    it('DB mati → 500 halaman/JSON Laravel, tercatat lewat pino, tidak lewat console.error', async () => {
        const catat = vi.spyOn(log, 'error');
        const konsol = vi.spyOn(console, 'error');
        const cookie = `${COOKIE_SESI}=${'a'.repeat(43)}`;
        const form = {
            method: 'POST',
            headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
            body: '_token=t&identifier=x&password=y',
        };
        for (const [fn, url] of [
            [prosesMasuk, 'http://cc.test/masuk'],
            [prosesKeluar, 'http://cc.test/keluar'],
            [prosesIzinKanal, 'http://cc.test/broadcasting/auth'],
        ] as const) {
            const r = await fn(new NextRequest(url, form));
            expect(r.status, url).toBe(500);
            expect(await r.text()).toContain('<title>Server Error</title>');
        }
        const json = await prosesMasuk(
            new NextRequest('http://cc.test/masuk', { ...form, headers: { ...form.headers, accept: 'application/json' } }),
        );
        expect(await json.text()).toBe('{\n    "message": "Server Error"\n}');
        expect(catat).toHaveBeenCalledTimes(4);
        expect(konsol).not.toHaveBeenCalled();
    });
});
