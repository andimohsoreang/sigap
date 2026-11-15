import 'server-only';

import { z } from 'zod';

import { bacaKunci } from './legacy/laravel-crypt';
import { kunciNik } from './legacy/nik';

const wajib = z.string().trim().min(1);

// Kunci salah format gagal saat start, bukan saat baris terenkripsi pertama dibaca. Pesan tanpa nilai kunci.
const lolos = (cek: (v: string) => unknown) => (v: string) => {
    try {
        cek(v);
        return true;
    } catch {
        return false;
    }
};
const kunciApp = wajib.refine(lolos(bacaKunci), 'harus 32 byte (format base64:… seperti Laravel)');
// Format APP_PREVIOUS_KEYS persis config/app.php: dipisah koma, tanpa trim.
const kunciLama = z.string().refine(
    lolos((v) => v.split(',').forEach((k) => k !== '' && k !== '0' && bacaKunci(k))),
    'setiap kunci harus 32 byte (format base64:… seperti Laravel)',
);
// Harus cocok dengan pola rewrite /_realtime/app/:key di next.config.ts.
const kunciRealtime = wajib.regex(/^[A-Za-z0-9_-]+$/, 'hanya huruf, angka, _ dan -');
const kunciHashNik = wajib.refine(lolos(kunciNik), 'minimal 32 byte dan bukan nilai kosong/sentinel');

const dasar = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    APP_DEBUG: z.enum(['true', 'false']).default('false'),
    APP_URL: wajib.optional(),
    DATABASE_URL: wajib.optional(),
    // Worker (paket G) memakai pool sendiri: DB_POOL_MAX=3 ke alias PgBouncer terpisah.
    DB_POOL_MAX: z.coerce.number().int().min(1).max(20).default(10),
    DB_APP_NAME: wajib.default('cc-web'),
    // Nama layanan di log (rencana §10.1); compose mengisi contact-center-worker untuk worker.
    OTEL_SERVICE_NAME: wajib.default('contact-center-web'),
    // Sama dengan Laravel: data uji bersama (NIK/kontak terenkripsi, hash NIK) dibaca kedua aplikasi.
    APP_KEY: kunciApp.optional(),
    APP_PREVIOUS_KEYS: kunciLama.default(''),
    NIK_HASH_KEY: kunciHashNik.optional(),
    // Valkey (rencana §9.4): rate limit, cache, kunci. Kosong di dev/test → rate limit memakai memori proses.
    VALKEY_URL: z.url({ protocol: /^rediss?$/ }).optional(),
    // Realtime berprotokol Pusher (Sockudo). Server → Sockudo lewat HTTP di jaringan backend; APP_KEY publik.
    REALTIME_APP_ID: wajib.optional(),
    REALTIME_APP_KEY: kunciRealtime.optional(),
    REALTIME_APP_SECRET: wajib.optional(),
    REALTIME_HOST: wajib.default('sockudo'),
    REALTIME_PORT: z.coerce.number().int().min(1).max(65535).default(6001),
});

// Produksi menolak start bila kunci wajib kosong atau mode debug aktif (rencana §9.2).
const produksi = dasar.extend({
    APP_DEBUG: z.literal('false', { error: 'APP_DEBUG harus false di produksi' }).default('false'),
    APP_URL: wajib,
    DATABASE_URL: wajib,
    APP_KEY: kunciApp,
    NIK_HASH_KEY: kunciHashNik,
    VALKEY_URL: z.url({ protocol: /^rediss?$/ }),
    REALTIME_APP_ID: wajib,
    REALTIME_APP_KEY: kunciRealtime,
    REALTIME_APP_SECRET: wajib,
});

export type Env = z.infer<typeof dasar>;

export function bacaEnv(sumber: Record<string, string | undefined>): Env {
    // Kunci yang diisi string kosong diperlakukan sama dengan tidak diisi.
    const bersih = Object.fromEntries(Object.entries(sumber).filter(([, v]) => v !== undefined && v.trim() !== ''));
    // `next build` berjalan dengan NODE_ENV=production tanpa rahasia runtime; validasi produksi terjadi saat server start.
    const skema = bersih.NODE_ENV === 'production' && bersih.NEXT_PHASE !== 'phase-production-build' ? produksi : dasar;
    const hasil = skema.safeParse(bersih);
    if (!hasil.success) throw new Error(`Konfigurasi env tidak valid:\n${z.prettifyError(hasil.error)}`);
    return hasil.data;
}

export const env = bacaEnv(process.env);
