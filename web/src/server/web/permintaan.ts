import 'server-only';

import { isIP } from 'node:net';

import { env } from '@/server/env';

// Padanan helper Illuminate\Http\Request yang menentukan bentuk respons Laravel (laravel/framework 12.69.3).
// Fungsi murni atas Headers/URL: dipakai proxy.ts dan route handler.

/**
 * `$request->ip()`. Produksi Laravel: nginx `real_ip_header CF-Connecting-IP` dari cloudflared. Di stack Next.js
 * cc-web hanya terbuka di 127.0.0.1 untuk cloudflared, jadi CF-Connecting-IP selalu dari Cloudflare. X-Forwarded-For
 * TIDAK dipakai: Next.js mempertahankan nilai kiriman klien (`??=`), sehingga bisa dipalsukan untuk lolos rate limit.
 */
export function ipKlien(h: Headers): string {
    const cf = h.get('cf-connecting-ip')?.trim();
    return cf && isIP(cf) ? cf : '127.0.0.1';
}

/** Symfony AcceptHeader: tipe diurutkan menurut q (menurun), urutan asli untuk q sama. */
export function tipeDiterima(accept: string | null): string[] {
    if (!accept) return [];
    return accept
        .split(',')
        .map((bagian, i) => {
            const [nilai, ...atribut] = bagian.split(';').map((s) => s.trim());
            const q = atribut.find((a) => /^q\s*=/i.test(a));
            return { nilai, q: q ? Number.parseFloat(q.split('=')[1]) || 0 : 1, i };
        })
        .filter((x) => x.nilai !== '')
        .sort((a, b) => b.q - a.q || a.i - b.i)
        .map((x) => x.nilai);
}

/** `$request->expectsJson()`: (ajax && !pjax && menerima apa saja) || wantsJson. */
export function inginJson(h: Headers): boolean {
    const diterima = tipeDiterima(h.get('accept'));
    const ajax = h.get('x-requested-with') === 'XMLHttpRequest';
    // `$this->headers->get('X-PJAX') == true`: string tidak kosong selain "0".
    const pjax = !!h.get('x-pjax') && h.get('x-pjax') !== '0';
    const apaSaja = diterima.length === 0 || diterima[0] === '*/*' || diterima[0] === '*';
    const pertama = diterima[0]?.toLowerCase() ?? '';
    return (ajax && !pjax && apaSaja) || pertama.includes('/json') || pertama.includes('+json');
}

/** `$request->path()` setelah rawurldecode (dipakai `is()`): tanpa '/' di awal/akhir, '/' bila kosong. */
export function jalurTerdekode(pathname: string): string {
    let p = pathname;
    try {
        p = decodeURIComponent(pathname);
    } catch {
        // URL tidak bisa didekode: pakai apa adanya, seperti rawurldecode yang tidak pernah gagal.
    }
    p = p.replace(/^\/+|\/+$/g, '');
    return p === '' ? '/' : p;
}

/** shouldRenderJsonWhen di bootstrap/app.php: `is('api/*') || expectsJson()`. */
export function responsJson(pathname: string, h: Headers): boolean {
    return jalurTerdekode(pathname).startsWith('api/') || inginJson(h);
}

/** Origin aplikasi untuk URL absolut (Location Laravel selalu absolut): APP_URL, atau origin permintaan di dev. */
export function asalAplikasi(url: string | URL): string {
    return env.APP_URL ? new URL(env.APP_URL).origin : new URL(url).origin;
}

/**
 * Path + query relatif yang aman dipakai sebagai tujuan redirect (perlindungan open redirect untuk url.intended &
 * Referer). URL absolut hanya diterima bila origin-nya sama dengan aplikasi. Menolak `//host`, `/\host`, dan
 * karakter kontrol yang dibuang parser URL browser.
 */
export function jalurAman(nilai: string | null | undefined, asal: string): string | null {
    if (!nilai || /[\x00-\x1f\x7f]/.test(nilai)) return null;
    let u: URL;
    try {
        u = new URL(nilai, asal);
    } catch {
        return null;
    }
    if (u.origin !== asal) return null;
    const jalur = u.pathname + u.search;
    return /^\/(?![/\\])/.test(jalur) ? jalur : null;
}
