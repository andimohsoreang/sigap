import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Konfigurasi unit test frontend (TECH-SPEC §10 — Vitest).
 * Terpisah dari vite.config.js agar plugin laravel tidak ikut berjalan.
 */
export default defineConfig({
    plugins: [react()],
    esbuild: { jsx: 'automatic' },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'resources/js'),
            'ziggy-js': path.resolve(__dirname, 'vendor/tightenco/ziggy'),
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['resources/js/test/setup.ts'],
        include: ['resources/js/**/*.test.{ts,tsx}'],
        exclude: ['node_modules/**', 'e2e/**'],
    },
});
