import 'server-only';

import axios, { type AxiosInstance } from 'axios';

export interface OpsiKlien {
    baseURL?: string;
    timeoutMs: number;
    maxBytes: number;
    ikutiRedirect?: boolean;
}

// Klien HTTP keluar (AI, reCAPTCHA, berita, ingest, cek portal). Tanpa interceptor & retry: kebijakan retry milik pemanggil.
export function buatKlien({ baseURL, timeoutMs, maxBytes, ikutiRedirect = false }: OpsiKlien): AxiosInstance {
    return axios.create({
        // Adapter Node: adapter fetch mengabaikan maxRedirects: 0 (GHSA-r4gj-5m52-g5wh).
        adapter: 'http',
        baseURL,
        // Dengan baseURL, URL absolut digabung ke baseURL, jadi permintaan tidak pernah keluar dari host itu.
        allowAbsoluteUrls: baseURL === undefined,
        timeout: timeoutMs,
        maxContentLength: maxBytes,
        maxBodyLength: maxBytes,
        // Default tidak mengikuti redirect agar tiap hop divalidasi ulang oleh pemanggil; 5 = batas default Guzzle di Laravel.
        maxRedirects: ikutiRedirect ? 5 : 0,
        proxy: false,
        headers: { 'User-Agent': 'ContactCenter/1.0' },
    });
}
