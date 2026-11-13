import axios, { isAxiosError } from 'axios';

// Klien browser khusus endpoint JSON milik sendiri; URL luar ditolak oleh penjaga di bawah.
export const api = axios.create({
    baseURL: '/',
    allowAbsoluteUrls: false,
    adapter: 'xhr',
    // Nama cookie & header sama dengan Laravel selama kedua aplikasi berjalan berdampingan.
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    // Sama dengan batas server (fastcgi_read_timeout 60s di deploy/docker/nginx.conf).
    timeout: 60_000,
    headers: { Accept: 'application/json' },
});

// Hanya path yang diawali tepat satu '/'. Menolak URL absolut, `//host`, dan varian yang dinormalkan browser menjadi
// `//host`: backslash (`/\\host`) serta tab/baris baru yang dibuang parser URL (`\t//host`, `/\t/host`).
api.interceptors.request.use((config) => {
    const url = config.url ?? '';
    if (!/^\/(?![/\\])/.test(url) || /[\t\n\r]/.test(url)) throw new Error(`api: hanya path same-origin yang diizinkan (${JSON.stringify(url)})`);
    return config;
});

export interface GalatApi {
    status: number | null;
    message: string | null;
    errors: Record<string, string[]>;
}

// Bentuk respons galat Laravel: 422 `{message, errors}`, 419/429/500 `{message}`. Tidak ada pesan pengganti di sini:
// komponen tetap memakai teks cadangannya sendiri, seperti sekarang.
export function galatApi(error: unknown): GalatApi {
    const res = isAxiosError(error) ? error.response : undefined;
    const data: unknown = res?.data;
    const body = typeof data === 'object' && data !== null ? (data as { message?: unknown; errors?: unknown }) : {};
    return {
        status: res?.status ?? null,
        message: typeof body.message === 'string' ? body.message : null,
        errors: typeof body.errors === 'object' && body.errors !== null ? (body.errors as Record<string, string[]>) : {},
    };
}
