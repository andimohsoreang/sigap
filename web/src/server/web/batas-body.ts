// Batas ukuran body permintaan, ditolak SEBELUM dibaca (proxy.ts & bacaInput): padanan nginx
// `client_max_body_size 12m` produksi (deploy/docker/nginx.conf) — Next.js sendiri menyalin body ke memori untuk proxy.
// Rute auth & /broadcasting/auth hanya menerima formulir kecil: 64 KB (lebih ketat dari Laravel, tak terlihat pengguna).

export const MAKS_BODY = 12 * 1024 * 1024;
export const MAKS_BODY_KECIL = 64 * 1024;

const JALUR_KECIL = new Set(['masuk', 'keluar', 'broadcasting/auth']);

/** Batas untuk `$request->path()` terdekode. */
export const batasBody = (path: string) => (JALUR_KECIL.has(path) ? MAKS_BODY_KECIL : MAKS_BODY);

/**
 * Content-Length melebihi batas atau bukan angka, atau body tanpa Content-Length (Transfer-Encoding chunked: ukurannya
 * baru diketahui setelah dibaca seluruhnya) → true.
 */
export function bodyTerlaluBesar(h: Headers, maks: number): boolean {
    const cl = h.get('content-length');
    if (cl === null) return h.has('transfer-encoding');
    return !/^\d+$/.test(cl.trim()) || Number(cl) > maks;
}

/** Halaman 413 bawaan nginx (server_tokens off), yang dilihat klien produksi untuk body > 12 MB. */
export const HTML_413 =
    '<html>\r\n<head><title>413 Request Entity Too Large</title></head>\r\n<body>\r\n' +
    '<center><h1>413 Request Entity Too Large</h1></center>\r\n<hr><center>nginx</center>\r\n</body>\r\n</html>\r\n';

export function respons413(): Response {
    return new Response(HTML_413, { status: 413, headers: { 'Content-Type': 'text/html', Connection: 'close' } });
}

export class GalatBodyBesar extends Error {
    override name = 'GalatBodyBesar';
}
