import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * E2E SIGAP (TECH-SPEC §10) — alur utama:
 * buat aduan → lacak → admin ubah status → survei.
 *
 * Menjalankan servernya sendiri di port 8123 dengan database terpisah
 * `database/e2e.sqlite` (lihat `sigap:e2e-setup`) agar data dev tidak tersentuh.
 */
const PORT = Number(process.env.E2E_PORT ?? 8123);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_FILE = `${__dirname}/database/e2e.sqlite`;

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30_000,
    expect: { timeout: 10_000 },
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['github'], ['list']] : [['list']],
    use: {
        baseURL: BASE_URL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: [
            // Selalu SQLite terpisah — sigap:e2e-setup menolak DB non-lokal & APP_ENV selain local/testing.
            `DB_CONNECTION=sqlite DB_DATABASE=${DB_FILE} php artisan sigap:e2e-setup`,
            `DB_CONNECTION=sqlite DB_DATABASE=${DB_FILE} APP_URL=${BASE_URL} php artisan serve --host=127.0.0.1 --port=${PORT}`,
        ].join(' && '),
        url: `${BASE_URL}/api/v1/health`,
        reuseExistingServer: false,
        timeout: 120_000,
        env: { DB_CONNECTION: 'sqlite', DB_DATABASE: DB_FILE, APP_URL: BASE_URL },
    },
});
