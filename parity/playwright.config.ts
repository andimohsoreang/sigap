import { defineConfig, devices } from '@playwright/test';

import { BASE_URL as baseURL, PORT, TARGET } from './tests/target';

/**
 * Suite paritas Contact Center (docs/RENCANA-REWRITE-NEXTJS.md §8.3).
 * TARGET=laravel (bawaan) + BASE_URL kosong → boot Laravel lokal (scripts/laravel.sh) sebagai acuan.
 * TARGET=next + BASE_URL kosong → build & boot Next.js standalone lokal (scripts/next.sh) dengan data seed yang sama.
 * BASE_URL diisi → jalankan suite ke server yang sudah hidup; TARGET tetap menentukan perbedaan yang disengaja.
 */

const viewport = (name: string, width: number, height: number) => ({
    name,
    testMatch: /visual\.spec\.ts/,
    dependencies: ['login'],
    use: { ...devices['Desktop Chrome'], viewport: { width, height }, deviceScaleFactor: 1 },
});

export default defineConfig({
    testDir: './tests',
    // Baseline = tampilan & DOM Laravel, dibuat lokal oleh `npm run baseline` (tidak di-commit; hash di visual/manifest.json).
    snapshotPathTemplate: `{testDir}/../.baseline/${process.platform}-${process.arch}/{projectName}/{arg}{ext}`,
    // Baseline hanya ditulis lewat `npm run baseline` (--update-snapshots=all), tidak pernah diam-diam dari target lain.
    updateSnapshots: 'none',
    fullyParallel: true,
    workers: 4,
    retries: 0,
    reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
    expect: {
        // Halaman panjang (/panduan fullPage) bisa butuh > 5 dtk untuk dua tangkapan stabil di runner 4 worker;
        // timeout bawaan 5 dtk membuat CI merah acak (rewrite/s0 52181d8). Toleransi piksel tetap 0.
        timeout: 20_000,
        toHaveScreenshot: {
            maxDiffPixels: 0,
            threshold: 0,
            animations: 'disabled',
            caret: 'hide',
            scale: 'css',
            stylePath: './tests/screenshot.css',
        },
    },
    use: {
        baseURL,
        locale: 'id-ID',
        timezoneId: 'Asia/Jakarta',
        colorScheme: 'light',
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'login', testMatch: /login\.setup\.ts/, use: { ...devices['Desktop Chrome'] } },
        { name: 'http', testMatch: /http\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
        viewport('desktop', 1440, 900),
        viewport('tablet', 768, 1024),
        viewport('mobile', 375, 812),
    ],
    webServer: process.env.BASE_URL
        ? undefined
        : {
              command: `bash scripts/${TARGET}.sh ${PORT}`,
              url: TARGET === 'laravel' ? `${baseURL}/api/v1/health` : `${baseURL}/up`,
              reuseExistingServer: false,
              // next.sh menjalankan `npm run build` (± 2–4 menit) sebelum server hidup.
              timeout: TARGET === 'laravel' ? 180_000 : 600_000,
              // Keluaran skrip target tampil di log (CI tidak bisa di-debug tanpanya).
              stdout: 'pipe',
              stderr: 'pipe',
          },
});
