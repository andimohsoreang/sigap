// Salinan sigap/ yang dipindai Tailwind (css-statis) dan dibangun Vite (cek:css): hanya berkas yang dilacak git, supaya
// berkas lokal tak terlacak (mis. sigap/.impeccable/config.json) tidak menambah utilitas ke CSS.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '../..');

export function sumberSigap() {
    if (process.env.CSS_SUMBER) return { dir: path.resolve(process.env.CSS_SUMBER), hapus() {} };
    if (!fs.existsSync(path.join(repo, '.git'))) {
        // Konteks build Docker tanpa .git sudah disaring allowlist deploy/next/Dockerfile.dockerignore.
        console.warn('sumber-sigap: tidak ada .git, memindai ../sigap apa adanya');
        return { dir: path.join(repo, 'sigap'), hapus() {} };
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-sigap-'));
    // ls-files (bukan git archive): sigap/.gitattributes memberi export-ignore pada README.md & CHANGELOG.md.
    const berkas = execFileSync('git', ['ls-files', '-z', '--', 'sigap'], { cwd: repo, encoding: 'utf8' }).split('\0').filter(Boolean);
    for (const f of berkas) {
        fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true });
        fs.copyFileSync(path.join(repo, f), path.join(tmp, f));
    }
    return { dir: path.join(tmp, 'sigap'), hapus: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}
