// Bundel proses non-Next ke dist/: worker.mjs (pg-boss + dispatcher outbox) dan migrate.mjs (migrasi cc_* + skema
// pg-boss). Semua dependensi ikut dibundel: node_modules standalone Next hanya berisi paket yang dilacak dari
// server Next (pg-boss tidak). Dijalankan setelah `next build` (npm run build); image menyalin dist/ & drizzle-cc/.
import esbuild from 'esbuild';
import path from 'node:path';

const web = path.resolve(import.meta.dirname, '..');

const { metafile } = await esbuild.build({
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
    minify: true,
    // Nama kelas/fungsi asli tetap: log pino memakai err.constructor.name (`type`), pesan galat menyebut nama kelas.
    keepNames: true,
    // Stack trace terbaca lewat `node --enable-source-maps` (command worker & migrate di compose.yml). Peta tanpa isi
    // sumber (sourcesContent: false) cukup untuk berkas:baris asli dan jauh lebih kecil untuk dimuat saat start.
    sourcemap: 'linked',
    sourcesContent: false,
    legalComments: 'none',
    metafile: true,
    logLevel: 'warning',
});

// Worker tidak memakai Valkey; impor tidak langsung ke src/server/valkey.ts menarik ioredis (±1 MB) ke bundel.
const masukanWorker = Object.keys(metafile.outputs['dist/worker.mjs'].inputs);
const terlarang = masukanWorker.filter((m) => m.endsWith('src/server/valkey.ts') || m.includes('node_modules/ioredis/'));
if (terlarang.length) throw new Error(`dist/worker.mjs tidak boleh memuat Valkey/ioredis:\n${terlarang.slice(0, 5).join('\n')}`);

for (const [berkas, { bytes }] of Object.entries(metafile.outputs)) {
    if (!berkas.endsWith('.map')) console.log(`${berkas} ${(bytes / 1024).toFixed(0)} KB`);
}
