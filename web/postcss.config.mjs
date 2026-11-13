import path from 'node:path';

const config = {
    plugins: {
        // shortcut: Tailwind memindai sigap/ (folder yang sama dengan build Vite Laravel, tanpa @source) supaya globals.css
        // tetap byte-identik dan utilitas yang dihasilkan sama; hapus `base` (kembali memindai web/) sebelum sigap/ dihapus di S17.
        // process.cwd() = web/ (Turbopack membundel file ini, jadi import.meta.url tidak bisa dipakai).
        '@tailwindcss/postcss': { base: path.resolve(process.cwd(), '../sigap') },
        [path.resolve(process.cwd(), 'postcss-seperti-vite.mjs')]: {},
    },
};

export default config;
