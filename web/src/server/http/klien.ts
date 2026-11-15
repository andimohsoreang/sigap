import 'server-only';

import axios, { isAxiosError, type AxiosError, type AxiosInstance } from 'axios';
import { inspect } from 'node:util';

export interface OpsiKlien {
    baseURL?: string;
    timeoutMs: number;
    maxBytes: number;
}

// URL tanpa userinfo, query, dan fragmen (token & data pribadi sering ada di sana).
function urlAman(url?: string, baseURL?: string): string | undefined {
    if (!url) return undefined;
    try {
        const u = new URL(url, baseURL);
        return `${u.origin}${u.pathname}`;
    } catch {
        return url.split(/[?#]/)[0];
    }
}

// AxiosError membawa config (header Authorization, body permintaan) dan toJSON() bawaannya ikut menyertakannya.
// Ringkasan ini dipakai untuk JSON (pino, JSON.stringify) dan util.inspect (console.error Next.js).
function ringkasGalat(e: AxiosError) {
    const ringkas = {
        type: e.name,
        message: e.message,
        code: e.code,
        status: e.response?.status,
        method: e.config?.method?.toUpperCase(),
        url: urlAman(e.config?.url, e.config?.baseURL),
    };
    // toJSON enumerable: redaksi pino menyalin objek per kunci enumerable (prototipe ikut), properti tersembunyi hilang.
    Object.defineProperties(e, { toJSON: { value: () => ringkas, enumerable: true }, [inspect.custom]: { value: () => ringkas } });
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
    // shortcut: signal batas waktu menempel di config, jadi retry wajib membuat config baru (jangan kirim ulang err.config).
    klien.interceptors.request.use((config) => {
        const batas = AbortSignal.timeout(timeoutMs);
        config.signal = config.signal ? AbortSignal.any([config.signal as AbortSignal, batas]) : batas;
        return config;
    });
    klien.interceptors.response.use(undefined, (e: unknown) => {
        if (isAxiosError(e)) ringkasGalat(e);
        throw e;
    });
    return klien;
}
