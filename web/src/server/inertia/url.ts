import { rawurlencode } from '@/lib/ziggy';

// `url` objek halaman Inertia (inertia-laravel 2.0.28 Response::getUrl): path + query dari $request->fullUrl()
// (garis miring akhir dibuang, query dinormalkan Symfony: kunci diurutkan, RFC 3986), lalu garis miring akhir
// dikembalikan bila URI mentah memilikinya. Dihitung proxy.ts dari URL permintaan asli dan diteruskan lewat header
// internal (selalu ditimpa proxy; nilai dari klien dibuang).

export const HEADER_URL = 'x-cc-url';

/**
 * Request::normalizeQueryString: parse_str → ksort → http_build_query(RFC3986). Pasangan terakhir menang.
 * shortcut: kunci larik PHP (`a[]=1`, `a[b]=1`) dan urutan ksort numerik tidak ditiru — query apa adanya dipakai
 * bila ada `[`; ganti dengan parser PHP penuh bila halaman yang dipindah membaca usePage().url dengan query larik.
 */
function normalisasiQuery(search: string): string {
    const qs = search.replace(/^\?/, '');
    if (qs === '') return '';
    if (qs.includes('[') || qs.includes('%5B')) return qs;
    const nilai = new Map<string, string>();
    for (const bagian of qs.split('&')) {
        if (bagian === '') continue;
        const i = bagian.indexOf('=');
        const dek = (s: string) => {
            try {
                return decodeURIComponent(s.replace(/\+/g, ' '));
            } catch {
                return s;
            }
        };
        const k = dek(i < 0 ? bagian : bagian.slice(0, i));
        if (k === '') continue;
        nilai.set(k, i < 0 ? '' : dek(bagian.slice(i + 1)));
    }
    return [...nilai.keys()]
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        .map((k) => `${rawurlencode(k)}=${rawurlencode(nilai.get(k)!)}`)
        .join('&');
}

export function urlInertia(pathname: string, search: string): string {
    const path = pathname.replace(/\/+$/, '');
    const qs = normalisasiQuery(search);
    const url = (path === '' ? '/' : path) + (qs ? `?${qs}` : '');
    if (!pathname.endsWith('/') || pathname === '/') return url;
    // finishUrlWithTrailingSlash
    const [p, ...q] = url.split('?');
    return (p.endsWith('/') ? p : `${p}/`) + (q.length ? `?${q.join('?')}` : '');
}
