// Pengganti `@inertiajs/react` untuk komponen yang disalin dari sigap/resources/js (scripts/salinan-sigap.mjs menulis
// ulang impornya ke modul ini). Hanya bagian yang dipakai halaman yang sudah pindah; yang lain sengaja tidak
// diekspor (galat kompilasi lebih jelas daripada perilaku diam-diam berbeda). Arsitektur: docs/slices/S1.md.
export { usePage, type Page, type PageProps } from './halaman';
export { Head } from './head';
export { Link, type LinkProps } from './link';
export { router } from './router';
