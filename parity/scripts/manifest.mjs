// Manifest SHA-256 baseline Laravel (visual/manifest.json), per kunci <platform>-<arch>.
//   node scripts/manifest.mjs cek   → gagal bila baseline .baseline/<platform>-<arch> berbeda dari manifest kunci ini.
//                                     Hash hanya dibandingkan bila sidik mesin (CPU, fitur SIMD, Playwright, Chromium)
//                                     sama dengan entri; mesin lain → hanya daftar nama berkas (rasterisasi Skia di CPU
//                                     memilih jalur SIMD berbeda, jadi antialias berbeda antar-mesin).
//   node scripts/manifest.mjs tulis → tulis/ganti entri platform ini (hanya bila tampilan Laravel memang berubah)
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const platform = `${process.platform}-${process.arch}`;
const dir = path.join(root, '.baseline', platform);
const file = path.join(root, 'visual', 'manifest.json');
const mode = process.argv[2];

if (!['cek', 'tulis'].includes(mode)) throw new Error('pemakaian: manifest.mjs cek|tulis');
if (!existsSync(dir)) throw new Error(`baseline belum ada: ${dir} (jalankan npm run baseline)`);

const files = {};
for (const rel of readdirSync(dir, { recursive: true }).map(String).sort()) {
    const abs = path.join(dir, rel);
    if (!/\.(png|html)$/.test(rel)) continue;
    files[rel.split(path.sep).join('/')] = createHash('sha256').update(readFileSync(abs)).digest('hex');
}

/** Model CPU + fitur SIMD yang memengaruhi jalur rasterisasi Skia. */
function machine() {
    if (process.platform === 'linux') {
        const info = readFileSync('/proc/cpuinfo', 'utf8');
        const field = (name) => info.match(new RegExp(`^${name}\\s*:\\s*(.*)$`, 'm'))?.[1].trim() ?? '';
        const flags = field('flags')
            .split(/\s+/)
            .filter((f) => /^(ssse3|sse4_[12]|avx.*|fma|f16c|bmi[12])$/.test(f))
            .sort();
        return { cpu: field('model name') || os.cpus()[0]?.model, flags };
    }
    if (process.platform === 'darwin') {
        const sysctl = (key) => {
            try {
                return execFileSync('sysctl', ['-n', key], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
            } catch {
                return '';
            }
        };
        const flags = `${sysctl('machdep.cpu.features')} ${sysctl('machdep.cpu.leaf7_features')}`.toLowerCase().split(/\s+/).filter(Boolean).sort();
        return { cpu: sysctl('machdep.cpu.brand_string'), model: sysctl('hw.model'), flags };
    }
    return { cpu: os.cpus()[0]?.model ?? '', flags: [] };
}

const browser = await chromium.launch();
const entry = {
    playwright: createRequire(import.meta.url)('@playwright/test/package.json').version,
    chromium: browser.version(),
    mesin: machine(),
    files,
};
await browser.close();

const manifest = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};

if (mode === 'tulis') {
    mkdirSync(path.dirname(file), { recursive: true });
    manifest[platform] = entry;
    const sorted = Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]]));
    writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n');
    console.log(`manifest ${platform}: ${Object.keys(files).length} berkas ditulis`);
    process.exit(0);
}

const expected = manifest[platform];
if (!expected) {
    console.error(`manifest tidak punya entri untuk ${platform}. Bila ini platform baru, jalankan 'npm run manifest:tulis' lalu commit.`);
    process.exit(1);
}
const fingerprint = (e) => JSON.stringify([e.playwright, e.chromium, e.mesin ?? null]);
const sameMachine = fingerprint(expected) === fingerprint(entry);
if (!sameMachine) {
    console.log(
        `mesin berbeda: hanya daftar berkas yang dicek; paritas Laravel↔Next tetap dibandingkan di mesin yang sama.\n` +
            `  manifest: ${fingerprint(expected)}\n  sekarang: ${fingerprint(entry)}`,
    );
}
const problems = [];
for (const name of new Set([...Object.keys(expected.files), ...Object.keys(files)])) {
    if (!expected.files[name]) problems.push(`${name}: tidak ada di manifest`);
    else if (!files[name]) problems.push(`${name}: hilang`);
    else if (sameMachine && expected.files[name] !== files[name]) problems.push(`${name}: hash berbeda`);
}
if (problems.length) {
    console.error(`baseline Laravel (${platform}) tidak cocok dengan visual/manifest.json:\n- ${problems.join('\n- ')}`);
    process.exit(1);
}
console.log(`manifest ${platform}: ${Object.keys(files).length} berkas cocok (${sameMachine ? 'nama + hash' : 'nama saja'})`);
