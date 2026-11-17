// Salinan komponen React & berkas publik Laravel di web/ (arsitektur kompatibilitas Inertia, docs/slices/S1.md).
// Satu sumber aturan untuk dua hal:
//   node scripts/salinan-sigap.mjs salin   → salin ulang semua berkas di SALINAN dari sigap/ (setelah menambah entri)
//   tests/unit/inertia/salinan.test.ts     → gagal bila salinan berbeda dari sigap/ selain penulisan ulang impor di bawah
// Isi JSX & className tidak pernah diubah: Tailwind tetap memindai sigap/ (css-statis), jadi kelas di salinan harus sama.
// Dihapus di S17 bersama sigap/ (sejak itu web/ menjadi sumber dan Tailwind memindai web/src).
import fs from 'node:fs';
import path from 'node:path';

const web = path.resolve(import.meta.dirname, '..');
const sigap = path.resolve(web, '../sigap');

/** Berkas sigap/resources/js yang dipakai halaman yang sudah pindah (relatif ke resources/js). */
export const SALINAN = [
    'components/sigap/accessibility.tsx',
    'components/sigap/tara-form.tsx',
    'components/sigap/tara-shell.tsx',
    'components/sigap/transi-header.tsx',
    'components/ui/button.tsx',
    'lib/chat-transition.ts',
    'lib/preferences.ts',
    'lib/sigap.ts',
    'lib/utils.ts',
    'pages/public/kebijakan-privasi.tsx',
    'pages/public/panduan.tsx',
    'pages/public/pedoman-layanan.tsx',
    'pages/public/static-shell.tsx',
    'pages/public/syarat-ketentuan.tsx',
    'pages/public/tentang-kami.tsx',
    'pages/public/tentang.tsx',
    'types/index.ts',
];

/** Folder sigap/public yang disalin byte-identik ke web/public (§8.1); index.php & build/ tidak. */
export const PUBLIK = ['favicon.ico', 'geo', 'images', 'logo.svg', 'robots.txt'];

/** Jalur web/src untuk berkas sigap/resources/js (nama baru §10.1: components/sigap → components/contact-center). */
export function jalurWeb(rel) {
    return path.join(
        'src',
        rel
            .replace(/^components\/sigap\//, 'components/contact-center/')
            .replace(/^lib\/sigap\.ts$/, 'lib/contact-center.ts')
            .replace(/^pages\//, 'halaman/'),
    );
}

/** Satu-satunya perubahan yang boleh: jalur impor, plus 'use client' di halaman (entri komponen klien). */
export function tulisUlang(isi, rel) {
    const hasil = isi
        .replaceAll("from '@inertiajs/react'", "from '@/lib/inertia'")
        .replaceAll("'@/components/sigap/", "'@/components/contact-center/")
        .replaceAll("'@/lib/sigap'", "'@/lib/contact-center'");
    return rel.startsWith('pages/') ? `'use client';\n\n${hasil}` : hasil;
}

/** Daftar berkas publik (relatif ke public/) dari sigap/public. */
export function berkasPublik() {
    return PUBLIK.flatMap((p) => {
        const sumber = path.join(sigap, 'public', p);
        if (!fs.statSync(sumber).isDirectory()) return [p];
        return fs
            .readdirSync(sumber, { recursive: true })
            .map((f) => path.join(p, f))
            .filter((f) => fs.statSync(path.join(sigap, 'public', f)).isFile());
    });
}

export const DIR = { web, sigap };

if (process.argv[2] === 'salin') {
    for (const rel of SALINAN) {
        const tujuan = path.join(web, jalurWeb(rel));
        fs.mkdirSync(path.dirname(tujuan), { recursive: true });
        fs.writeFileSync(tujuan, tulisUlang(fs.readFileSync(path.join(sigap, 'resources/js', rel), 'utf8'), rel));
    }
    for (const rel of berkasPublik()) {
        const tujuan = path.join(web, 'public', rel);
        fs.mkdirSync(path.dirname(tujuan), { recursive: true });
        fs.copyFileSync(path.join(sigap, 'public', rel), tujuan);
    }
    console.log(`salinan-sigap: ${SALINAN.length} berkas sumber, ${berkasPublik().length} berkas publik`);
}
