import { expect, test, type Page } from '@playwright/test';

import { S1_PAGES } from './s1';

/** Jam beku (WIB Jumat siang) — sama untuk semua target. */
const FROZEN = new Date('2026-11-13T10:00:00+07:00');

const THEMES = { terang: null, gelap: 'dark' } as const;

/** Tema via kunci localStorage yang dibaca skrip inline app.blade.php sebelum paint. */
async function open(page: Page, path: string, theme: string | null) {
    await page.clock.setFixedTime(FROZEN);
    await page.addInitScript((t) => {
        localStorage.removeItem('cc-a11y');
        if (t) localStorage.setItem('cc-theme', t);
        else localStorage.removeItem('cc-theme');
    }, theme);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    // Gambar lazy di luar layar tidak dimuat saat capture full page; paksa muat lalu tunggu semuanya siap.
    await page.evaluate(async () => {
        document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => (img.loading = 'eager'));
        await Promise.all(
            Array.from(document.images).map((img) =>
                img.complete
                    ? img.decode().catch(() => undefined)
                    : new Promise((r) => {
                          img.addEventListener('load', r);
                          img.addEventListener('error', r);
                      }),
            ),
        );
        await document.fonts.ready;
    });
    await page.waitForLoadState('networkidle');
}

for (const [themeName, theme] of Object.entries(THEMES)) {
    test.describe(`tema ${themeName}`, () => {
        for (const p of S1_PAGES) {
            test(`${p.path}`, async ({ page }) => {
                await open(page, p.path, theme);
                await expect(page).toHaveScreenshot(`${p.path.slice(1)}-${themeName}.png`, { fullPage: true });
            });
        }

        test('header tamu', async ({ page }) => {
            await open(page, '/panduan', theme);
            await expect(page.locator('header').first()).toHaveScreenshot(`header-tamu-${themeName}.png`);
        });
    });
}
