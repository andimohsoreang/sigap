import { readFileSync } from 'node:fs';

import { AUTH, CREDENTIALS } from './s1';
import { TARGET } from './target';
import { expect, test as setup } from './test';

/**
 * Masuk sebagai akun uji dari `sigap:e2e-setup` (kata sandi acak per run, dibaca dari berkas kredensial
 * target) lalu simpan storageState untuk varian visual login.
 *
 * Laravel: lewat formulir /masuk. Next.js: halaman /masuk baru ada di S15, jadi formulir yang sama dikirim langsung
 * (`POST /masuk`, nama field sama, CSRF dari cookie XSRF-TOKEN → header X-XSRF-TOKEN seperti axios, Origin
 * sama) dan tujuannya harus redirect bawaan per peran (MasukController: admin → /admin, warga → /portal-warga).
 * Cara yang sama dipakai pemilik proyek di UAT S1 (docs/slices/S1-uat.md bagian 3, cara B).
 */
const creds = JSON.parse(readFileSync(CREDENTIALS, 'utf8')) as { username: string; password: string; warga_nik: string; warga_password: string };

const ACCOUNTS = [
    { name: 'warga', id: creds.warga_nik, password: creds.warga_password, home: '/portal-warga' },
    { name: 'admin', id: creds.username, password: creds.password, home: '/admin' },
] as const;

for (const a of ACCOUNTS) {
    setup(`masuk ${a.name}`, async ({ page }) => {
        if (TARGET === 'laravel') {
            await page.goto('/masuk');
            await page.locator('#identifier').fill(a.id);
            await page.locator('#password').fill(a.password);
            await page.locator('button[type="submit"]').click();
            await page.waitForURL((url) => url.pathname !== '/masuk');
        } else {
            // Dari dalam halaman (fetch browser), bukan page.request: cookie `__Host-cc_session` ber-Secure hanya dikirim
            // Chromium ke http://127.0.0.1 (origin tepercaya), tidak oleh klien HTTP Playwright. Browser mengisi Origin.
            await page.goto('/panduan');
            const hasil = await page.evaluate(
                async ({ id, password }) => {
                    const xsrf = decodeURIComponent(document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)?.[1] ?? '');
                    const res = await fetch('/masuk', {
                        method: 'POST',
                        headers: { 'X-XSRF-TOKEN': xsrf },
                        body: new URLSearchParams({ identifier: id, password }),
                    });
                    return { redirected: res.redirected, path: new URL(res.url).pathname };
                },
                { id: a.id, password: a.password },
            );
            // MasukController: redirect()->intended(bawaan per peran). Halaman tujuan belum pindah (404), cukup alamatnya.
            expect(hasil).toEqual({ redirected: true, path: a.home });
        }
        await page.context().storageState({ path: AUTH[a.name] });
    });
}
