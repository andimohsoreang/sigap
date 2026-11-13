// Membangun CSS aplikasi di luar Turbopack dengan pipeline yang sama dengan Vite Laravel (sigap/vite.config.js):
// Tailwind 4.0.8 memindai sigap/ → url() @fontsource ditulis ulang ke aset ber-hash → minify esbuild seperti Vite 6.4.4.
// Hasil: public/_cc/app-<sha8>.css + public/_cc/media/*. href-nya dicatat di src/app/aset-css.json (di-commit);
// skrip gagal bila hash berubah tanpa memperbarui manifest (`node scripts/css-statis.mjs --tulis`).
// Catatan: CSS Leaflet (MapContainer di Laravel) akan menjadi entri kedua saat halaman peta di-port.
import tailwind from '@tailwindcss/postcss';
import esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import postcss from 'postcss';

const web = path.resolve(import.meta.dirname, '..');
const sigap = path.resolve(web, '../sigap');
const sumber = path.join(web, 'src/app/globals.css');
const keluaran = path.join(web, 'public/_cc');
const manifest = path.join(web, 'src/app/aset-css.json');

// Target build default Vite ('modules'), dipakai minifyCSS() Vite untuk esbuild.
const VITE_CSS_TARGET = ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'];

if (!fs.existsSync(path.join(sigap, 'resources'))) throw new Error(`sigap/ tidak ditemukan di ${sigap}: Tailwind harus memindai template Laravel`);

const sha8 = (isi) => createHash('sha256').update(isi).digest('hex').slice(0, 8);

const akarFontsource = path.dirname(path.dirname(createRequire(import.meta.url).resolve('@fontsource/inter/package.json')));
const folderFont = fs.readdirSync(akarFontsource).map((p) => path.join(akarFontsource, p, 'files'));

// @tailwindcss/postcss 4.0.8 menyisipkan CSS @fontsource tanpa menulis ulang url() relatifnya (plugin Vite memakai
// shouldRewriteUrls), jadi `url(./files/<nama>)` dicari di paket @fontsource lalu disalin sebagai aset ber-hash.
function salinFont(nama) {
    const cocok = folderFont.map((dir) => path.join(dir, nama)).filter((f) => fs.existsSync(f));
    if (cocok.length !== 1) throw new Error(`url(./files/${nama}) cocok dengan ${cocok.length} berkas @fontsource`);
    const isi = fs.readFileSync(cocok[0]);
    const { name, ext } = path.parse(nama);
    const berkas = `${name}-${sha8(isi)}${ext}`;
    fs.writeFileSync(path.join(keluaran, 'media', berkas), isi);
    return `/_cc/media/${berkas}`;
}

const sepertiVite = () => ({
    postcssPlugin: 'cc-seperti-vite',
    OnceExit(root, { result }) {
        root.walkDecls((decl) => {
            decl.value = decl.value.replace(/url\(\.\/files\/([^)]+)\)/g, (_, nama) => `url(${salinFont(nama)})`);
        });
        const { code } = esbuild.transformSync(root.toString(), { loader: 'css', target: VITE_CSS_TARGET, charset: 'utf8', minify: true });
        result.root = postcss.parse(code, { from: result.opts.from });
    },
});

fs.rmSync(keluaran, { recursive: true, force: true });
fs.mkdirSync(path.join(keluaran, 'media'), { recursive: true });

// optimize eksplisit: dev & produksi menghasilkan CSS yang sama (default plugin bergantung NODE_ENV).
const { css } = await postcss([tailwind({ base: sigap, optimize: true }), sepertiVite()]).process(fs.readFileSync(sumber, 'utf8'), { from: sumber });
const href = `/_cc/app-${sha8(css)}.css`;
fs.writeFileSync(path.join(web, 'public', href), css);

const tercatat = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')).href : null;
if (process.argv.includes('--tulis')) {
    fs.writeFileSync(manifest, `${JSON.stringify({ href }, null, 4)}\n`);
    console.log(`css-statis: ${href} dicatat di src/app/aset-css.json`);
} else if (tercatat !== href) {
    console.error(
        `css-statis: hash CSS berubah (${tercatat} → ${href}). Jalankan \`node scripts/css-statis.mjs --tulis\` lalu commit src/app/aset-css.json.`,
    );
    process.exit(1);
} else {
    console.log(`css-statis: ${href}`);
}
