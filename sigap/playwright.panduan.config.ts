import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Tangkapan layar halaman Panduan (/panduan) dari aplikasi yang sedang berjalan:
 *   npx playwright test -c playwright.panduan.config.ts
 *
 * Memakai database SQLite terpisah `database/panduan.sqlite` berisi data contoh
 * (sigap:e2e-setup + sigap:data-contoh + tests/panduan/siapkan-data.php), lalu
 * menyimpan gambar ke public/images/panduan/. Data dev tidak tersentuh.
 */
const PORT = Number(process.env.PANDUAN_PORT ?? 8124);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_FILE = `${__dirname}/database/panduan.sqlite`;
// Penyedia AI diganti nilai contoh: tidak ada panggilan ke penyedia sungguhan dan
// nama penyedia/model asli tidak ikut tampil di tangkapan layar publik.
const ENV = [
    `DB_CONNECTION=sqlite DB_DATABASE="${DB_FILE}" APP_URL=${BASE_URL}`,
    'AI_BASE_URL=https://penyedia-ai.contoh/v1 AI_MODEL=model-tara AI_API_KEY=contoh',
].join(' ');

export default defineConfig({
    testDir: './tests/panduan',
    timeout: 120_000,
    expect: { timeout: 10_000 },
    fullyParallel: false,
    workers: 1,
    reporter: [['list']],
    use: {
        ...devices['Desktop Chrome'],
        baseURL: BASE_URL,
        viewport: { width: 1440, height: 900 },
        locale: 'id-ID',
        timezoneId: 'Asia/Jakarta',
    },
    webServer: {
        command: [
            `touch "${DB_FILE}"`,
            `${ENV} php artisan sigap:e2e-setup`,
            `${ENV} php artisan sigap:data-contoh --force`,
            `${ENV} php artisan tinker --execute="require base_path('tests/panduan/siapkan-data.php');"`,
            `${ENV} php artisan serve --host=127.0.0.1 --port=${PORT}`,
        ].join(' && '),
        url: `${BASE_URL}/api/v1/health`,
        reuseExistingServer: false,
        timeout: 180_000,
    },
});
