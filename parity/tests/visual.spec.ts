import type { Page } from '@playwright/test';

import { AUTH, S1_EXTERNAL, S1_PAGES } from './s1';
import { expect, test } from './test';

/** Jam beku (WIB Jumat siang) — sama untuk semua target. */
const FROZEN = new Date('2026-11-13T10:00:00+07:00');

/** Mask yang diizinkan §8.3 dan relevan di S1: hanya badge reCAPTCHA (site key terisi seperti produksi). */
const masks = (page: Page) => [page.locator('.grecaptcha-badge')];

/** Kombinasi aksesibilitas §8.3: teks besar (130%) + kontras + disleksia (kunci cc-a11y, lib/preferences.ts). */
const A11Y = { text: 2, contrast: true, links: false, dyslexia: true, motion: false, focus: false, gray: false };

const VARIANTS = [
    { name: 'terang', theme: null, a11y: null, auth: null },
    { name: 'gelap', theme: 'dark', a11y: null, auth: null },
    { name: 'aksesibilitas', theme: null, a11y: A11Y, auth: null },
    { name: 'warga', theme: null, a11y: null, auth: AUTH.warga },
    { name: 'admin', theme: null, a11y: null, auth: AUTH.admin },
] as const;

/** HTML <main> ternormalisasi: tanpa nonce, data-page, id acak React/Radix; satu tag per baris agar diff terbaca. */
const normalizeDom = (html: string) =>
    html
        .replace(/\s(nonce|data-page)="[^"]*"/g, '')
        .replace(/(radix-)?[«:]r[0-9a-z]+[»:]/g, 'ID')
        .replace(/></g, '>\n<');

/** Tema & aksesibilitas via kunci localStorage yang dibaca skrip inline app.blade.php sebelum paint. Mengembalikan DOM <main>. */
async function open(page: Page, path: string, theme: string | null, a11y: object | null) {
    await page.clock.setFixedTime(FROZEN);
    await page.addInitScript(
        ([t, a]) => {
            if (t) localStorage.setItem('cc-theme', t);
            else localStorage.removeItem('cc-theme');
            if (a) localStorage.setItem('cc-a11y', a);
            else localStorage.removeItem('cc-a11y');
        },
        [theme, a11y ? JSON.stringify(a11y) : null] as const,
    );
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    const dom = normalizeDom(await page.locator('main').evaluate((el) => el.outerHTML));

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
    return dom;
}

for (const v of VARIANTS) {
    test.describe(`varian ${v.name}`, () => {
        if (v.auth) test.use({ storageState: v.auth });

        for (const p of S1_PAGES) {
            test(`${p.path}`, async ({ page, diblokir }) => {
                const dom = await open(page, p.path, v.theme, v.a11y);
                const name = `${p.path.slice(1)}-${v.name}`;
                // Lebar capture = lebar viewport. Konten yang meluap ke kanan (mis. header admin di 375 px) hanya
                // terlihat dengan gulir horizontal dan dirasterisasi Chromium tidak deterministik di luar viewport;
                // luapannya tetap dibandingkan lewat ukuran gulir di snapshot DOM.
                const { scrollWidth, scrollHeight } = await page.evaluate(() => ({
                    scrollWidth: document.documentElement.scrollWidth,
                    scrollHeight: document.documentElement.scrollHeight,
                }));
                const clip = { x: 0, y: 0, width: page.viewportSize()!.width, height: scrollHeight };
                await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, clip, mask: masks(page) });
                expect(`<!-- gulir ${scrollWidth}x${scrollHeight} -->\n${dom}`).toMatchSnapshot(`${name}.html`);
                expect(diblokir).toEqual(S1_EXTERNAL[p.path]);
            });
        }

        test('header', async ({ page }) => {
            await open(page, '/panduan', v.theme, v.a11y);
            await expect(page.locator('header').first()).toHaveScreenshot(`header-${v.auth ? v.name : `tamu-${v.name}`}.png`, { mask: masks(page) });
        });
    });
}
