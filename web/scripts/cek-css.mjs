// Bukti CSS identik (docs/slices/S0.md A.5): build CSS Laravel (Vite) dan Next.js, normalisasi, lalu diff.
// Keluar 0 bila identik, 1 bila ada selisih (diff ditulis ke stdout, salinan ternormalisasi di web/.cek-css/).
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { sumberSigap } from './sumber-sigap.mjs';

const web = path.resolve(import.meta.dirname, '..');
const jalankan = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });

// CSS pembanding dibangun Vite dari salinan sigap/ yang sama bersihnya dengan sumber css-statis.
const sigap = sumberSigap();
let isiLaravel;
try {
    jalankan('npm ci --no-audit --no-fund', sigap.dir);
    jalankan('npx vite build', sigap.dir);
    const manifest = JSON.parse(fs.readFileSync(path.join(sigap.dir, 'public/build/manifest.json'), 'utf8'));
    isiLaravel = fs.readFileSync(path.join(sigap.dir, 'public/build', manifest['resources/css/app.css'].file), 'utf8');
} finally {
    sigap.hapus();
}

jalankan('npm run build', web);
// CSS aplikasi harus datang dari scripts/css-statis.mjs; CSS apa pun hasil Turbopack berarti ada import CSS yang lolos.
const chunks = path.join(web, '.next/static/chunks');
const cssTurbopack = fs.readdirSync(chunks).filter((f) => f.endsWith('.css'));
if (cssTurbopack.length > 0) throw new Error(`CSS diproses Turbopack (harus lewat css-statis): ${cssTurbopack.join(', ')}`);
const statis = path.join(web, 'public/_cc');
const cssNext = fs.readdirSync(statis).filter((f) => /^app-\w{8}\.css$/.test(f));
if (cssNext.length !== 1) throw new Error(`Diharapkan 1 berkas public/_cc/app-*.css, ditemukan ${cssNext.length}`);
if (spawnSync('git', ['diff', '--quiet', '--exit-code', '--', 'src/app/aset-css.json'], { cwd: web }).status !== 0) {
    throw new Error('src/app/aset-css.json berubah setelah build: commit manifest CSS yang baru.');
}

function normalisasi(css) {
    return (
        css
            .replace(/\/\*[\s\S]*?\*\//g, '')
            // Nama aset ber-hash: Vite `/build/assets/<nama>-<8 karakter>.<ext>`, css-statis `/_cc/media/<nama>-<sha8>.<ext>`.
            .replace(
                /url\(\s*["']?([^)"']*)["']?\s*\)/g,
                (_, u) =>
                    `url(${u
                        .split('/')
                        .pop()
                        .replace(/-[\w-]{8}(\.\w+)$/, '$1')})`,
            )
            .replace(/\s+/g, ' ')
            .replace(/\s*([{};,>])\s*/g, '$1')
            .replace(/:\s+/g, ':')
            .replace(/@(media|container|supports) \(/g, '@$1(')
            // Satu aturan/deklarasi per baris agar diff mudah dibaca; urutan tidak diubah.
            .replace(/([{};])/g, '$1\n')
    );
}

const keluaran = path.join(web, '.cek-css');
fs.mkdirSync(keluaran, { recursive: true });
const a = path.join(keluaran, 'laravel.css');
const b = path.join(keluaran, 'next.css');
fs.writeFileSync(a, normalisasi(isiLaravel));
fs.writeFileSync(b, normalisasi(fs.readFileSync(path.join(statis, cssNext[0]), 'utf8')));

const diff = spawnSync('diff', ['-u', a, b], { encoding: 'utf8' });
if (diff.status === 0) {
    console.log(`\ncek:css IDENTIK: build Vite sigap/ (berkas terlacak) = public/_cc/${cssNext[0]}`);
} else {
    process.stdout.write(diff.stdout);
    const baris = diff.stdout.split('\n').filter((l) => /^[-+]/.test(l) && !/^(---|\+\+\+) /.test(l)).length;
    console.error(`\ncek:css BERBEDA: ${baris} baris berbeda (lihat ${path.relative(web, keluaran)}/)`);
    process.exitCode = 1;
}
