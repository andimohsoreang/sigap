import type { Options } from 'pusher-js';

// Opsi klien pusher-js 8.6.0 untuk Sockudo lewat jalur same-origin /_realtime (rewrite di next.config.ts). Hanya
// kunci PUBLIK (REALTIME_APP_KEY) yang boleh sampai ke browser; nilainya dikirim server ke komponen klien, bukan
// ditanam saat build, jadi satu image dipakai di semua lingkungan. Impor tipe saja: tidak menambah bundle.

/** Padanan reverbClientOptions Laravel: kunci kosong → null (realtime dilewati, halaman kembali ke polling). */
export function opsiRealtime(kunci: string | null | undefined, host = typeof window === 'undefined' ? '' : window.location.hostname) {
    const key = (kunci ?? '').trim();
    if (!key || !host) return null;
    const options: Options = {
        // Wajib di tipe pusher-js 8; diabaikan karena wsHost diisi.
        cluster: '',
        wsHost: host,
        wsPath: '/_realtime',
        forceTLS: true,
        enabledTransports: ['ws', 'wss'],
        // Endpoint izin kanal privat bawaan Laravel Echo; dilayani Next.js (paket F).
        channelAuthorization: { endpoint: '/broadcasting/auth', transport: 'ajax' },
    };
    return { key, options };
}
