import { S1_PAGES, S1_REDIRECTS } from './s1';
import { expect, test } from './test';

test.describe('S1 halaman statis', () => {
    for (const p of S1_PAGES) {
        test(`${p.path} → 200, judul & isi`, async ({ page }) => {
            const res = await page.goto(p.path);
            expect(res?.status()).toBe(200);
            expect(res?.headers()['content-type']).toMatch(/^text\/html/);

            await expect(page).toHaveTitle(p.title);
            await expect(page.locator('html')).toHaveAttribute('lang', 'id');
            await expect(page.locator('body')).toHaveAttribute('class', 'font-sans antialiased');
            await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', p.description);
            await expect(page.locator('h1')).toHaveText([p.h1]);
            await expect(page.locator('main h2')).toHaveText(p.h2);
            // Header tamu: tombol masuk, bukan portal/panel.
            await expect(page.locator('header').first().getByRole('link', { name: 'Masuk', exact: true }).first()).toBeAttached();
        });
    }
});

/** CSP produksi (APP_ENV=production, site key reCAPTCHA terisi). connect-src bergantung host Reverb → dicek terpisah. */
const CSP = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self' 'nonce-NONCE' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://www.transmigrasi.go.id",
    "font-src 'self' data:",
    'connect-src *',
    'frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/',
    "worker-src 'self' blob:",
    "manifest-src 'self'",
].join('; ');

test.describe('S1 header keamanan & cookie sesi', () => {
    for (const p of S1_PAGES) {
        test(`${p.path}`, async ({ request }) => {
            const res = await request.get(p.path);
            const h = res.headers();
            expect(h['x-content-type-options']).toBe('nosniff');
            expect(h['x-frame-options']).toBe('DENY');
            expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
            expect(h['permissions-policy']).toBe('geolocation=(self), camera=(), microphone=()');
            const csp = h['content-security-policy'] ?? '';
            expect(csp).toMatch(/connect-src 'self'(?: \S+)*;/);
            expect(csp.replace(/'nonce-[^']+'/, "'nonce-NONCE'").replace(/connect-src [^;]+/, 'connect-src *')).toBe(CSP);

            const cookies = res.headersArray().filter((x) => x.name.toLowerCase() === 'set-cookie').map((x) => x.value);
            const attrs = (name: string) => cookies.find((c) => c.startsWith(`${name}=`))?.replace(/^[^;]+;/, '').replace(/ expires=[^;]+;/, '');
            expect(attrs('sigap_session')).toBe(' Max-Age=7200; path=/; httponly; samesite=lax');
            expect(attrs('XSRF-TOKEN')).toBe(' Max-Age=7200; path=/; samesite=lax');
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
