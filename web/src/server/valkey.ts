import 'server-only';

import Redis from 'ioredis';

import { env } from './env';
import { log } from './log';

// Klien Valkey (rencana §9.4) untuk rate limit, cache, dan kunci. ioredis: kompatibel Valkey, murni JS (tanpa binary
// native — server tanpa AVX), dirawat aktif, mendukung keyPrefix yang juga berlaku untuk KEYS skrip Lua.
// Valkey mati TIDAK boleh membuat request menggantung: perintah gagal cepat dengan GalatValkey, pemanggil memilih
// jalur cadangan (rate limit → memori proses, cache → DB).

const BATAS_SAMBUNG_MS = 1_000;
const BATAS_PERINTAH_MS = 500;

/** Valkey tidak tersedia (tidak dikonfigurasi, belum/tidak tersambung, timeout, atau galat perintah). */
export class GalatValkey extends Error {
    override name = 'GalatValkey';
}

let klien: Redis | undefined;
let sehat = true;

function buat(url: string): Redis {
    const r = new Redis(url, {
        keyPrefix: 'cc:',
        lazyConnect: true,
        // Tanpa antrean offline: selama terputus perintah langsung ditolak, bukan ditahan sampai tersambung lagi.
        enableOfflineQueue: false,
        connectTimeout: BATAS_SAMBUNG_MS,
        commandTimeout: BATAS_PERINTAH_MS,
        maxRetriesPerRequest: 1,
        // Sambung ulang di latar belakang, jeda maks 2 dtk.
        retryStrategy: (kali) => Math.min(kali * 200, 2_000),
        connectionName: env.DB_APP_NAME,
    });
    // Tanpa listener, ioredis mencetak "Unhandled error event" setiap percobaan sambung ulang. Dicatat sekali per putus.
    r.on('error', (err) => {
        if (sehat) log.warn({ err }, 'Valkey tidak tersedia; memakai jalur cadangan');
        sehat = false;
    });
    r.on('ready', () => {
        if (!sehat) log.info('Valkey tersambung kembali');
        sehat = true;
    });
    // Web tidak menutup klien lebih awal (request yang masih berjalan memakainya); socket diputus saat proses keluar.
    process.once('exit', () => r.disconnect());
    return r;
}

/** Klien bersama (dibuat saat pertama dipakai). GalatValkey bila VALKEY_URL kosong. */
export function klienValkey(): Redis {
    if (!env.VALKEY_URL) throw new GalatValkey('VALKEY_URL tidak diisi');
    klien ??= buat(env.VALKEY_URL);
    return klien;
}

// Sambungan pertama (lazyConnect) ditunggu sekali; setelah itu status selain 'ready' (mis. 'reconnecting' saat
// Valkey mati) langsung gagal tanpa menunggu.
let sambunganPertama: Promise<void> | undefined;

function tungguPercobaan(r: Redis): Promise<void> {
    return new Promise<void>((ok) => {
        const selesai = () => {
            clearTimeout(t);
            r.off('ready', selesai).off('error', selesai).off('end', selesai);
            ok();
        };
        const t = setTimeout(selesai, BATAS_SAMBUNG_MS);
        r.once('ready', selesai).once('error', selesai).once('end', selesai);
    });
}

async function siap(r: Redis): Promise<void> {
    if (r.status === 'wait') {
        sambunganPertama = tungguPercobaan(r);
        r.connect().catch(() => {}); // galat sambung datang lewat event 'error'
    }
    await sambunganPertama;
    if (r.status !== 'ready') throw new GalatValkey(`Valkey tidak tersambung (${r.status})`);
}

/** Jalankan perintah Valkey; galat apa pun (termasuk timeout) menjadi GalatValkey dengan `cause` aslinya. */
export async function denganValkey<T>(fn: (r: Redis) => Promise<T>): Promise<T> {
    try {
        const r = klienValkey();
        await siap(r);
        return await fn(r);
    } catch (e) {
        if (e instanceof GalatValkey) throw e;
        throw new GalatValkey(`Perintah Valkey gagal: ${(e as Error).message}`, { cause: e });
    }
}

/** Tutup sambungan (worker/CLI/test). QUIT dengan batas waktu, lalu putus paksa. */
export async function tutupValkey(): Promise<void> {
    const r = klien;
    klien = undefined;
    sambunganPertama = undefined;
    if (!r || r.status === 'end' || r.status === 'wait') return r?.disconnect();
    await Promise.race([r.quit().catch(() => {}), new Promise((ok) => setTimeout(ok, BATAS_PERINTAH_MS))]);
    r.disconnect();
}
