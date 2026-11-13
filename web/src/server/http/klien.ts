import 'server-only';

import axios, { type AxiosInstance } from 'axios';

export interface OpsiKlien {
    baseURL?: string;
    timeoutMs: number;
    maxBytes: number;
}

// Klien HTTP keluar (AI, reCAPTCHA, berita, ingest, cek portal). Tanpa retry: kebijakan retry milik pemanggil.
// Redirect tidak diikuti; pemanggil yang butuh mengikutinya manual per hop agar tiap URL divalidasi ulang (§9.2).
export function buatKlien({ baseURL, timeoutMs, maxBytes }: OpsiKlien): AxiosInstance {
    const klien = axios.create({
        // Adapter Node: adapter fetch mengabaikan maxRedirects: 0 (GHSA-r4gj-5m52-g5wh).
        adapter: 'http',
        baseURL,
        // Dengan baseURL, URL absolut digabung ke baseURL, jadi permintaan tidak pernah keluar dari host itu.
        allowAbsoluteUrls: baseURL === undefined,
        timeout: timeoutMs,
        maxContentLength: maxBytes,
        maxBodyLength: maxBytes,
        maxRedirects: 0,
        proxy: false,
        headers: { 'User-Agent': 'ContactCenter/1.0' },
    });
    // `timeout` axios hanya membatasi jeda tanpa data; batas total ini menghentikan respons yang menetes pelan.
    klien.interceptors.request.use((config) => {
        const batas = AbortSignal.timeout(timeoutMs);
        config.signal = config.signal ? AbortSignal.any([config.signal as AbortSignal, batas]) : batas;
        return config;
    });
    return klien;
}
