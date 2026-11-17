// Daftar rute Ziggy per grup (sigap/config/ziggy.php) dari Laravel asli: `php artisan ziggy:generate --group=<g>`.
//   node scripts/rute-ziggy.mjs        → tulis src/server/inertia/ziggy-rute.json (di-commit; butuh PHP + sigap/vendor)
//   ruteZiggyLaravel()                 → dipakai test untuk memastikan berkas JSON masih sama dengan Laravel
// Rute Next.js yang dipindah tetap memakai nama & URI Laravel, jadi daftar ini berlaku sampai S17.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const web = path.resolve(import.meta.dirname, '..');
const sigap = path.resolve(web, '../sigap');
export const BERKAS = path.join(web, 'src/server/inertia/ziggy-rute.json');
export const GRUP = ['public', 'warga', 'admin'];

export function ruteZiggyLaravel() {
    const hasil = {};
    for (const g of GRUP) {
        // storage/ diabaikan git sigap; jalur relatif terhadap base_path().
        const rel = `storage/framework/cache/cc-ziggy-${g}.js`;
        execFileSync('php', ['artisan', 'ziggy:generate', rel, `--group=${g}`], {
            cwd: sigap,
            env: { PATH: process.env.PATH, HOME: process.env.HOME, APP_URL: 'http://localhost', APP_ENV: 'production', CACHE_STORE: 'array' },
            stdio: 'pipe',
        });
        const js = fs.readFileSync(path.join(sigap, rel), 'utf8');
        fs.rmSync(path.join(sigap, rel));
        const m = js.match(/^const Ziggy = (\{.*\});$/m);
        if (!m) throw new Error(`keluaran ziggy:generate grup ${g} tidak dikenali`);
        hasil[g] = JSON.parse(m[1]).routes;
    }
    return hasil;
}

if (process.argv[1] === import.meta.filename) {
    fs.writeFileSync(BERKAS, `${JSON.stringify(ruteZiggyLaravel(), null, 4)}\n`);
    console.log(`rute-ziggy: ${path.relative(web, BERKAS)}`);
}
