import axios, { isAxiosError } from 'axios';

// Klien browser untuk endpoint JSON milik sendiri. Bukan untuk URL luar: allowAbsoluteUrls false membuat URL
// absolut digabung ke '/', sehingga permintaan tetap ke origin sendiri.
export const api = axios.create({
    baseURL: '/',
    allowAbsoluteUrls: false,
    adapter: 'xhr',
    withCredentials: false,
    // Nama cookie & header sama dengan Laravel selama kedua aplikasi berjalan berdampingan.
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    // Sama dengan batas server (fastcgi_read_timeout 60s di deploy/docker/nginx.conf).
    timeout: 60_000,
    headers: { Accept: 'application/json' },
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
