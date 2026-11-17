import { NextResponse } from 'next/server';

// Route::redirect di sigap/routes/web.php:36-38,45,68,70 (alamat lama → alamat baru, 301). Route::redirect =
// Route::any: semua verb (GET HEAD POST PUT PATCH DELETE OPTIONS), setelah middleware grup web (sesi & CSRF tetap
// berjalan). Pengecualian: POST /pengaduan didaftarkan ulang sebagai pengaduan.store.legacy (web.php:71), yang
// menimpa redirect untuk verb itu — rute tersebut belum ada di Next.js.

const REDIRECT: Record<string, string> = {
    'beranda-baru': '/',
    'beranda-lama': '/',
    'beranda-standar': '/',
    'beranda-absol': '/',
    'katalog/kantor-balai': '/katalog',
    'lacak-tiket': '/lacak',
    pengaduan: '/pengaduan/baru',
};

const VERB = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

/** Tujuan redirect untuk `$request->path()` terdekode, atau null. */
export function redirectLama(metode: string, path: string): string | null {
    if (!VERB.includes(metode) || (metode === 'POST' && path === 'pengaduan')) return null;
    return Object.hasOwn(REDIRECT, path) ? REDIRECT[path] : null;
}

/**
 * RedirectResponse Symfony: 301, Location relatif apa adanya, query dibuang, tanpa Cache-Control.
 * Location ditulis absolut terhadap URL permintaan karena adapter proxy Next.js menolak Location relatif; adapter yang
 * sama menulisnya kembali menjadi relatif (`/katalog`) untuk host yang sama (next/dist/server/web/adapter.js).
 * Isi respons tidak dikirim: server Next.js mengganti isi redirect dari proxy dengan teks URL (perbedaan yang sama
 * dengan 302 di S0; Laravel mengirim halaman "Redirecting to …" yang tidak terlihat karena browser langsung pindah).
 */
export function respons301(ke: string, urlPermintaan: string): NextResponse {
    return new NextResponse(null, { status: 301, headers: { Location: new URL(ke, urlPermintaan).toString() } });
}
