import { S1_EXTERNAL, S1_PAGES, S1_REDIRECTS } from './s1';
import { expect, test } from './test';

/** Atribut Set-Cookie sebagai himpunan ternormalisasi: huruf kecil, tanpa expires, urut. */
const cookieAttrs = (setCookies: string[], name: string) => {
    const cookie = setCookies.find((c) => c.startsWith(`${name}=`));
    return cookie
        ?.split(';')
        .slice(1)
        .map((a) => a.trim().toLowerCase())
        .filter((a) => a !== '' && !a.startsWith('expires='))
        .sort();
};

/** CSP per direktif: { direktif: sumber[] urut }, nonce dinormalisasi. */
const parseCsp = (header: string) =>
    Object.fromEntries(
        header
            .split(';')
            .map((d) => d.trim())
            .filter(Boolean)
            .map((d) => {
                const [name, ...sources] = d.split(/\s+/);
                return [name.toLowerCase(), sources.map((s) => s.replace(/^'nonce-[^']+'$/, "'nonce-NONCE'")).sort()];
            }),
    );

/** CSP produksi (APP_ENV=production, site key reCAPTCHA terisi); connect-src = Reverb lingkungan paritas. */
const CSP = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'script-src': ["'nonce-NONCE'", "'self'", 'https://www.google.com/recaptcha/', 'https://www.gstatic.com/recaptcha/'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'blob:', 'data:', 'https://*.tile.openstreetmap.org', 'https://www.transmigrasi.go.id'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", 'ws://localhost:8080'],
    'frame-src': ['https://recaptcha.google.com/recaptcha/', 'https://www.google.com/recaptcha/'],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
};

test.describe('S1 halaman statis', () => {
    for (const p of S1_PAGES) {
        test(`${p.path} → 200, judul & isi`, async ({ page, request, diblokir }) => {
            for (const path of [p.path, `${p.path}/`]) {
                const res = await request.get(path, { maxRedirects: 0 });
                expect(res.status(), path).toBe(200);
                expect(res.headers()['content-type'], path).toMatch(/^text\/html/);
            }

            await page.goto(p.path);
            await page.waitForLoadState('networkidle');
            await expect(page).toHaveTitle(p.title);
            await expect(page.locator('html')).toHaveAttribute('lang', 'id');
            await expect(page.locator('body')).toHaveAttribute('class', 'font-sans antialiased');
            await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', p.description);
            await expect(page.locator('h1')).toHaveText([p.h1]);
            await expect(page.locator('main h2')).toHaveText(p.h2);
            // Header tamu: tombol masuk, bukan portal/panel.
            await expect(page.locator('header').first().getByRole('link', { name: 'Masuk', exact: true }).first()).toBeAttached();
            expect(diblokir).toEqual(S1_EXTERNAL[p.path]);
        });
    }
});

test.describe('S1 header keamanan & cookie sesi', () => {
    for (const p of S1_PAGES) {
        test(`${p.path}`, async ({ request }) => {
            const res = await request.get(p.path, { maxRedirects: 0 });
            expect(res.status()).toBe(200);
            const h = res.headers();
            expect(h['x-content-type-options']).toBe('nosniff');
            expect(h['x-frame-options']).toBe('DENY');
            expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
            expect(h['permissions-policy']).toBe('geolocation=(self), camera=(), microphone=()');
            expect(parseCsp(h['content-security-policy'] ?? '')).toEqual(CSP);

            const setCookies = res
                .headersArray()
                .filter((x) => x.name.toLowerCase() === 'set-cookie')
                .map((x) => x.value);
            expect(cookieAttrs(setCookies, 'sigap_session')).toEqual(['httponly', 'max-age=7200', 'path=/', 'samesite=lax']);
            expect(cookieAttrs(setCookies, 'XSRF-TOKEN')).toEqual(['max-age=7200', 'path=/', 'samesite=lax']);
        });
    }
});

test.describe('S1 redirect lama', () => {
    for (const [from, to] of S1_REDIRECTS) {
        test(`${from} → 301 ${to}`, async ({ request }) => {
            const res = await request.get(from, { maxRedirects: 0 });
            expect(res.status()).toBe(301);
            expect(res.headers()['location']).toBe(to);
        });
    }
});
