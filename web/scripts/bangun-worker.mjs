// Bundel proses non-Next ke dist/: worker.js (pg-boss + dispatcher outbox) dan migrate.js (migrasi cc_* + skema
// pg-boss). Semua dependensi ikut dibundel: node_modules standalone Next hanya berisi paket yang dilacak dari
// server Next (pg-boss tidak). Dijalankan setelah `next build` (npm run build); image menyalin dist/ & drizzle-cc/.
import esbuild from 'esbuild';
import path from 'node:path';

const web = path.resolve(import.meta.dirname, '..');

await esbuild.build({
    absWorkingDir: web,
    entryPoints: { worker: 'src/worker/main.ts', migrate: 'src/cli/migrate.ts' },
    outdir: 'dist',
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'esm',
    outExtension: { '.js': '.mjs' },
    // Paket CJS di dalam bundel ESM memanggil require().
    banner: { js: "import { createRequire as __ccRequire } from 'node:module'; const require = __ccRequire(import.meta.url);" },
    // Di luar Next tidak ada kondisi react-server: penanda server-only diganti modul kosong (sama dengan vitest).
    alias: { 'server-only': path.join(web, 'node_modules/server-only/empty.js') },
    // pg mencoba pg-native secara opsional; tidak dipakai.
    external: ['pg-native'],
    sourcemap: 'linked',
    legalComments: 'none',
    logLevel: 'warning',
});
