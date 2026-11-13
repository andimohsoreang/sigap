// Menyamakan CSS Next.js dengan pipeline Vite Laravel setelah Tailwind (sigap/vite.config.js):
// 1. @tailwindcss/postcss 4.0.8 menyisipkan CSS @fontsource tanpa menulis ulang url() relatifnya (plugin Vite memakai
//    shouldRewriteUrls). `url(./files/<nama>)` ditulis ulang ke berkas @fontsource yang sebenarnya, relatif terhadap CSS ini.
// 2. Vite 6 meminifikasi CSS dengan esbuild (target build default 'modules'); opsi di bawah salinan minifyCSS() Vite 6.4.4.
import esbuild from 'esbuild';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const VITE_CSS_TARGET = ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'];

const akar = path.dirname(path.dirname(createRequire(import.meta.url).resolve('@fontsource/inter/package.json')));
const paket = fs.readdirSync(akar).map((p) => path.join(akar, p, 'files'));

function cari(nama) {
    const hasil = paket.map((dir) => path.join(dir, nama)).filter((f) => fs.existsSync(f));
    if (hasil.length !== 1) throw new Error(`url(./files/${nama}) cocok dengan ${hasil.length} berkas @fontsource`);
    return hasil[0];
}

const plugin = () => ({
    postcssPlugin: 'cc-seperti-vite',
    OnceExit(root, { result, postcss }) {
        const dari = path.dirname(result.opts.from);
        root.walkDecls((decl) => {
            decl.value = decl.value.replace(
                /url\(\.\/files\/([^)]+)\)/g,
                (_, nama) => `url(${path.relative(dari, cari(nama)).split(path.sep).join('/')})`,
            );
        });
        const { code } = esbuild.transformSync(root.toString(), { loader: 'css', target: VITE_CSS_TARGET, charset: 'utf8', minify: true });
        result.root = postcss.parse(code, { from: result.opts.from });
    },
});
plugin.postcss = true;

export default plugin;
