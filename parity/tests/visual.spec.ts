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

/**
 * HTML <header>, <main>, <footer> dari CLONE di browser: atribut style ditulis ulang lewat `el.style.cssText`
 * dan node komentar dibuang (SSR vs CSR hanya beda ejaan, mis. `width:0%` vs `width: 0%;`, `<!-- -->`).
 * Lalu tanpa nonce, data-page, id acak React/Radix; satu tag per baris agar diff terbaca.
 */
async function snapshotDom(page: Page) {
    const parts = await page.evaluate(() =>
        ['header', 'main', 'footer'].map((tag) => {
            const el = document.querySelector(tag);
            if (!el) return `<!-- ${tag}: tidak ada -->`;
            const clone = el.cloneNode(true) as Element;
            const walker = document.createTreeWalker(clone, NodeFilter.SHOW_COMMENT);
            const comments: Node[] = [];
            while (walker.nextNode()) comments.push(walker.currentNode);
            comments.forEach((c) => c.parentNode?.removeChild(c));
            for (const node of [clone, ...clone.querySelectorAll('[style]')]) {
                if (node instanceof HTMLElement && node.hasAttribute('style')) node.setAttribute('style', node.style.cssText);
            }
            return clone.outerHTML;
        }),
    );
    return parts
        .join('\n')
        .replace(/\s(nonce|data-page)="[^"]*"/g, '')
        .replace(/(radix-)?(?:[«:][rR][0-9a-zA-Z]+[»:]|_[rR]_[0-9a-zA-Z]+_)/g, 'ID')
        .replace(/></g, '>\n<');
}

/**
 * Ukuran gulir + elemen terluar yang keluar dari viewport (selector & rentang x). Capture dipotong selebar viewport
 * (pengecualian §8.3), jadi luapan dibandingkan lewat baris ini.
 */
async function overflow(page: Page) {
    return page.evaluate(() => {
        const doc = document.documentElement;
        const vw = doc.clientWidth;
        // Kotak ≤ 2×2 px (sr-only, juga saat teks diperbesar) tidak terlihat; elemen di dalam leluhur ber-overflow non-visible yang muat di viewport terpotong.
        const beyond = (r: DOMRect) => (r.width > 2 || r.height > 2) && (r.right > vw + 0.05 || r.left < -0.05);
        const outside = (el: Element) => beyond(el.getBoundingClientRect());
        const clipped = (el: Element) => {
            for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
                if (getComputedStyle(a).overflowX !== 'visible' && !outside(a)) return true;
            }
            return false;
        };
        const selector = (el: Element) => {
            const landmark = el.parentElement?.closest('header, main, footer, nav')?.tagName.toLowerCase() ?? 'body';
            const own = (e: Element) => {
                const tag = e.tagName.toLowerCase();
                if (e.id) return `${tag}#${e.id}`;
                const label = e.getAttribute('aria-label');
                if (label) return `${tag}[aria-label="${label}"]`;
                const same = Array.from(e.parentElement?.children ?? []).filter((x) => x.tagName === e.tagName);
                return same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(e) + 1})` : tag;
            };
            if (el.id || el.getAttribute('aria-label')) return `${landmark} ${own(el)}`;
            const path: string[] = [];
            for (let e: Element | null = el; e && e !== document.body && e.tagName.toLowerCase() !== landmark; e = e.parentElement) path.unshift(own(e));
            return `${landmark} ${path.join(' > ')}`;
        };
        const range = (r: DOMRect) => `${r.left.toFixed(1)}–${r.right.toFixed(1)}`;
        const luap: string[] = [];
        if (doc.scrollWidth > vw) {
            // Elemen terluar yang kotaknya keluar viewport.
            for (const el of Array.from(document.body.querySelectorAll('*'))) {
                const parent = el.parentElement;
                if (outside(el) && !clipped(el) && !(parent && parent !== document.body && outside(parent))) {
                    luap.push(`luap: ${selector(el)} ${range(el.getBoundingClientRect())}`);
                }
            }
            // Teks yang meluap dari kotak elemennya (mis. kata panjang pada teks 130%).
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            const r = document.createRange();
            while (walker.nextNode()) {
                const owner = walker.currentNode.parentElement;
                if (!owner || outside(owner) || clipped(walker.currentNode as unknown as Element)) continue;
                r.selectNodeContents(walker.currentNode);
                const rect = r.getBoundingClientRect();
                if (beyond(rect)) luap.push(`luap: ${selector(owner)} (teks) ${range(rect)}`);
            }
        }
        return { scrollWidth: doc.scrollWidth, scrollHeight: doc.scrollHeight, luap };
    });
}

/** Tema & aksesibilitas via kunci localStorage yang dibaca skrip inline app.blade.php sebelum paint. Mengembalikan snapshot DOM. */
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
    const dom = await snapshotDom(page);

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
                // Lebar capture = lebar viewport (pengecualian §8.3, disetujui pemilik): konten yang meluap ke kanan
                // hanya terlihat dengan gulir horizontal dan dirasterisasi Chromium tidak deterministik di luar
                // viewport. Luapannya dibandingkan lewat ukuran gulir & daftar `luap:` di snapshot DOM.
                const { scrollWidth, scrollHeight, luap } = await overflow(page);
                const clip = { x: 0, y: 0, width: page.viewportSize()!.width, height: scrollHeight };
                await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, clip, mask: masks(page) });
                const head = [`gulir ${scrollWidth}x${scrollHeight}`, ...luap].map((line) => `<!-- ${line} -->`).join('\n');
                expect(`${head}\n${dom}`).toMatchSnapshot(`${name}.html`);
                expect(diblokir).toEqual(S1_EXTERNAL[p.path]);
            });
        }

        // Header tamu sudah ikut di screenshot full page; capture header terpisah hanya untuk varian login.
        if (v.auth) {
            test('header', async ({ page }) => {
                await open(page, '/panduan', v.theme, v.a11y);
                await expect(page.locator('header').first()).toHaveScreenshot(`header-${v.name}.png`, { mask: masks(page) });
            });
        }
    });
}
