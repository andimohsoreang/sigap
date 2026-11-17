// Web vitals lab LOKAL (indikatif, bukan Lighthouse): per halaman S1 × viewport, median dari ULANG muat dingin (konteks
// baru, tanpa cache) di Chromium Playwright. Ponsel: CPU diperlambat 4× (setara profil seluler Lighthouse), jaringan
// lokal tanpa throttling. Metrik: TTFB & FCP (Navigation/Paint Timing), LCP (entri terakhir sebelum interaksi), CLS
// (jumlah layout-shift tanpa input baru), INP-proksi = durasi event terlama saat membuka (klik) & menutup (Escape) panel Aksesibilitas
// (halaman statis tidak punya interaksi lain; INP sebenarnya hanya dari data lapangan).
//   BASE_URL=http://127.0.0.1:3124 node perf/vitals.ts      (ULANG=5)
import { chromium, type Page } from '@playwright/test';

import { S1_PAGES } from '../tests/s1.ts';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:3124';
const ULANG = Number(process.env.ULANG ?? 5);
const VIEWPORT = [
    { nama: 'desktop', width: 1440, height: 900, cpu: 1 },
    { nama: 'ponsel', width: 375, height: 812, cpu: 4 },
];

const OBSERVER = () => {
    const w = window as unknown as { __v: { lcp: number; cls: number; inp: number } };
    w.__v = { lcp: 0, cls: 0, inp: 0 };
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__v.lcp = e.startTime))).observe({
        type: 'largest-contentful-paint',
        buffered: true,
    });
    new PerformanceObserver((l) =>
        l.getEntries().forEach((e) => {
            const s = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
            if (!s.hadRecentInput) w.__v.cls += s.value;
        }),
    ).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__v.inp = Math.max(w.__v.inp, e.duration)))).observe({
        type: 'event',
        durationThreshold: 16,
        buffered: true,
    } as PerformanceObserverInit);
};

type Hasil = { ttfb: number; fcp: number; lcp: number; cls: number; inp: number };

async function ukur(page: Page, path: string): Promise<Hasil> {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    // Buka panel Aksesibilitas (tombol ada di semua viewport) lalu tutup lagi dengan Escape.
    await page.locator('button[title="Aksesibilitas"]').click();
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    return page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? NaN;
        const v = (window as unknown as { __v: { lcp: number; cls: number; inp: number } }).__v;
        return { ttfb: nav.responseStart - nav.startTime, fcp, lcp: v.lcp, cls: v.cls, inp: v.inp };
    });
}

const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const browser = await chromium.launch();
console.log(`target ${base}, median ${ULANG} muat dingin`);
console.log('viewport halaman              TTFB ms  FCP ms  LCP ms   CLS    INP-proksi ms');
for (const vp of VIEWPORT) {
    for (const { path } of S1_PAGES) {
        const hasil: Hasil[] = [];
        for (let i = 0; i < ULANG; i++) {
            const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'id-ID' });
            // Tanpa jaringan luar (reCAPTCHA dsb.), sama dengan suite paritas.
            await ctx.route(
                (u) => u.origin !== new URL(base).origin,
                (r) => r.abort('blockedbyclient'),
            );
            await ctx.addInitScript(OBSERVER);
            const page = await ctx.newPage();
            if (vp.cpu > 1) {
                const cdp = await ctx.newCDPSession(page);
                await cdp.send('Emulation.setCPUThrottlingRate', { rate: vp.cpu });
            }
            hasil.push(await ukur(page, path));
            await ctx.close();
        }
        const m = (k: keyof Hasil) => median(hasil.map((h) => h[k]));
        console.log(
            `${vp.nama.padEnd(8)} ${path.padEnd(20)} ${m('ttfb').toFixed(0).padStart(7)} ${m('fcp').toFixed(0).padStart(7)} ${m('lcp').toFixed(0).padStart(7)} ${m('cls').toFixed(3).padStart(6)} ${m('inp').toFixed(0).padStart(8)}`,
        );
    }
}
await browser.close();
