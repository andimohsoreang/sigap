import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            // Penanda `server-only` melempar galat di luar kondisi react-server; test berjalan di Node.
            'server-only': fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)),
        },
    },
    test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
