// Manifest SHA-256 baseline Laravel (visual/manifest.json), per kunci <platform>-<arch>.
//   node scripts/manifest.mjs cek   → gagal bila baseline .baseline/<platform>-<arch> berbeda dari manifest kunci ini
//   node scripts/manifest.mjs tulis → tulis/ganti entri platform ini (hanya bila tampilan Laravel memang berubah)
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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

const browser = await chromium.launch();
const entry = {
    playwright: createRequire(import.meta.url)('@playwright/test/package.json').version,
    chromium: browser.version(),
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
const problems = [];
for (const key of ['playwright', 'chromium']) {
    if (expected[key] !== entry[key]) problems.push(`${key}: manifest ${expected[key]} ≠ sekarang ${entry[key]}`);
}
for (const name of new Set([...Object.keys(expected.files), ...Object.keys(files)])) {
    if (expected.files[name] !== files[name]) {
        problems.push(`${name}: ${expected.files[name] ? (files[name] ? 'hash berbeda' : 'hilang') : 'tidak ada di manifest'}`);
    }
}
if (problems.length) {
    console.error(`baseline Laravel (${platform}) tidak cocok dengan visual/manifest.json:\n- ${problems.join('\n- ')}`);
    process.exit(1);
}
console.log(`manifest ${platform}: ${Object.keys(files).length} berkas cocok`);
