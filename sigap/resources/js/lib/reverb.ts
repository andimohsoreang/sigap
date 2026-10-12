/**
 * Opsi klien Reverb dari variabel VITE_REVERB_* (N-02).
 *
 * - Key kosong → `null` (realtime dilewati, tanpa crash).
 * - Skema https → koneksi `wss` (forceTLS) ke port 443 secara default;
 *   http → `ws` ke port 80 / port yang ditentukan (lokal: 8080).
 */
export interface ReverbEnv {
    VITE_REVERB_APP_KEY?: string;
    VITE_REVERB_HOST?: string;
    VITE_REVERB_PORT?: string | number;
    VITE_REVERB_SCHEME?: string;
}

export interface ReverbClientOptions {
    key: string;
    wsHost: string;
    wsPort: number;
    wssPort: number;
    forceTLS: boolean;
    enabledTransports: ('ws' | 'wss')[];
}

export function reverbClientOptions(env: ReverbEnv, fallbackHost?: string): ReverbClientOptions | null {
    const key = (env.VITE_REVERB_APP_KEY ?? '').trim();
    if (!key) return null;

    const host = (env.VITE_REVERB_HOST ?? '').trim() || fallbackHost || (typeof window !== 'undefined' ? window.location.hostname : '');
    if (!host) return null;

    const tls = (env.VITE_REVERB_SCHEME ?? 'https').trim().toLowerCase() === 'https';
    const parsedPort = Number(env.VITE_REVERB_PORT);
    const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : tls ? 443 : 80;

    return {
        key,
        wsHost: host,
        wsPort: port,
        wssPort: port,
        forceTLS: tls,
        enabledTransports: tls ? ['wss'] : ['ws'],
    };
}
