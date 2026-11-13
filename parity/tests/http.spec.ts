import { expect, test } from '@playwright/test';

import { S1_PAGES, S1_REDIRECTS } from './s1';

test.describe('S1 halaman statis', () => {
    for (const p of S1_PAGES) {
        test(`${p.path} → 200, judul & isi`, async ({ page }) => {
            const res = await page.goto(p.path);
            expect(res?.status()).toBe(200);
            expect(res?.headers()['content-type']).toMatch(/^text\/html/);

            await expect(page).toHaveTitle(p.title);
            await expect(page.locator('html')).toHaveAttribute('lang', 'en');
            await expect(page.locator('body')).toHaveAttribute('class', 'font-sans antialiased');
            await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', p.description);
            await expect(page.locator('h1')).toHaveText([p.h1]);
            await expect(page.locator('main h2')).toHaveText(p.h2);
            // Header tamu: tombol masuk, bukan portal/panel.
            await expect(page.locator('header').first().getByRole('link', { name: 'Masuk', exact: true }).first()).toBeAttached();
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
