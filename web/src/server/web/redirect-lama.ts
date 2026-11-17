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
 * RedirectResponse Symfony: Location relatif apa adanya, query dibuang, isi HTML bawaan, tanpa Cache-Control (301).
 * Location ditulis absolut terhadap URL permintaan karena adapter proxy Next.js menolak Location relatif; adapter yang
 * sama menulisnya kembali menjadi relatif (`/katalog`) untuk host yang sama (next/dist/server/web/adapter.js).
 */
export function respons301(ke: string, urlPermintaan: string): NextResponse {
    const e = ke.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const isi = `<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8" />
        <meta http-equiv="refresh" content="0;url='${e}'" />

        <title>Redirecting to ${e}</title>
    </head>
    <body>
        Redirecting to <a href="${e}">${e}</a>.
    </body>
</html>`;
    return new NextResponse(isi, {
        status: 301,
        headers: { Location: new URL(ke, urlPermintaan).toString(), 'Content-Type': 'text/html; charset=utf-8' },
    });
}
