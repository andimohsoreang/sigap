import 'server-only';

import { createHash, createHmac } from 'node:crypto';

import { env } from '@/server/env';
import { buatKlien } from '@/server/http/klien';

import type { Siaran } from './kanal';

// Penerbit server → Sockudo lewat HTTP API Pusher (POST /apps/{id}/events), padanan PusherBroadcaster Laravel.
// Hanya dari jaringan backend (Sockudo tidak membuka HTTP API ke browser). Retry milik pemanggil (dispatcher outbox).

/** Batas payload Sockudo (bawaan app 100 KB) — gagal di sini dengan pesan jelas, bukan 413 dari server. */
const MAKS_DATA_BYTE = 100 * 1024;
/** Batas body permintaan & respons axios: ≥ 2 × MAKS_DATA_BYTE + kanal, jadi data yang lolos cek di atas selalu terkirim. */
const MAKS_BODY_BYTE = 256 * 1024;

const md5 = (s: string) => createHash('md5').update(s).digest('hex');
const hmac = (rahasia: string, s: string) => createHmac('sha256', rahasia).update(s).digest('hex');

function konfigurasi() {
    const { REALTIME_APP_ID: id, REALTIME_APP_KEY: key, REALTIME_APP_SECRET: secret, REALTIME_HOST: host, REALTIME_PORT: port } = env;
    if (!id || !key || !secret) throw new Error('REALTIME_APP_ID/KEY/SECRET belum diisi');
    return { id, key, secret, host, port };
}

/**
 * URL bertanda tangan Pusher HTTP API: auth_signature = HMAC-SHA256(secret, "METHOD\nPATH\nQUERY") dengan QUERY =
 * parameter (tanpa auth_signature) diurutkan per kunci, `k=v` digabung `&`; body_md5 = md5 hex body.
 */
export function urlBertandaTangan(
    metode: string,
    path: string,
    body: string,
    kunci: { key: string; secret: string },
    waktu = Math.floor(Date.now() / 1000),
): string {
    const param: Record<string, string> = {
        auth_key: kunci.key,
        auth_timestamp: String(waktu),
        auth_version: '1.0',
        body_md5: md5(body),
    };
    const query = Object.keys(param)
        .sort()
        .map((k) => `${k}=${param[k]}`)
        .join('&');
    return `${path}?${query}&auth_signature=${hmac(kunci.secret, `${metode}\n${path}\n${query}`)}`;
}

let klien: ReturnType<typeof buatKlien> | undefined;

/**
 * Siarkan satu event. Kanal kosong → tidak ada yang dikirim (BroadcastEvent::handle). Kanal dipecah per 100
 * (batas Pusher, PusherBroadcaster::broadcast). `data` dikirim sebagai string JSON seperti SDK Pusher PHP; isi
 * sama setelah JSON.parse di browser (PHP meng-escape `/` dan Unicode, JS tidak — tidak terlihat oleh klien).
 */
export async function terbitkan(s: Siaran): Promise<void> {
    if (s.kanal.length === 0) return;
    const k = konfigurasi();
    const data = JSON.stringify(s.data);
    if (Buffer.byteLength(data) > MAKS_DATA_BYTE)
        // permanen: dispatcher outbox langsung menyerah (galatPermanen), tidak mencoba 10 kali.
        throw Object.assign(new Error(`Data event ${s.event} melebihi ${MAKS_DATA_BYTE} byte`), { permanen: true });
    // Body = data 100 KB yang di-escape lagi sebagai string JSON (" dan \ menjadi 2 byte) + ≤ 100 nama kanal.
    klien ??= buatKlien({ baseURL: `http://${k.host}:${k.port}`, timeoutMs: 5_000, maxBytes: MAKS_BODY_BYTE });
    for (let i = 0; i < s.kanal.length; i += 100) {
        const body = JSON.stringify({ name: s.event, channels: s.kanal.slice(i, i + 100), data });
        await klien.post(urlBertandaTangan('POST', `/apps/${k.id}/events`, body, k), body, {
            headers: { 'Content-Type': 'application/json' },
            // Body sudah string; jangan diserialisasi ulang (body_md5 harus cocok byte per byte).
            transformRequest: [(d: string) => d],
        });
    }
}

/**
 * Tanda tangan izin kanal privat untuk endpoint /broadcasting/auth (Pusher: auth = "key:HMAC(secret, socket_id:kanal)").
 * Dipakai paket F setelah bolehKanal() lolos.
 */
export function tandaTanganKanal(socketId: string, kanal: string): { auth: string } {
    // Format socket_id Pusher; menolak injeksi ':' / baris baru ke string yang ditandatangani.
    if (!/^\d+\.\d+$/.test(socketId)) throw new Error('socket_id tidak valid');
    const k = konfigurasi();
    return { auth: `${k.key}:${hmac(k.secret, `${socketId}:${kanal}`)}` };
}
