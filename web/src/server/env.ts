import { z } from 'zod';

const wajib = z.string().trim().min(1);

const dasar = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    APP_DEBUG: z.enum(['true', 'false']).default('false'),
    APP_NAME: wajib.default('Contact Center'),
    APP_URL: wajib.optional(),
    APP_LOCALE: wajib.default('id'),
    APP_TIMEZONE: wajib.default('Asia/Jakarta'),
    DATABASE_URL: wajib.optional(),
    RECAPTCHA_SITE_KEY: wajib.optional(),
    // Nama & enkripsi cookie sesi Laravel, dibaca jembatan sesi (S0 gelombang 2).
    SESSION_COOKIE: wajib.optional(),
    SESSION_ENCRYPT: z.enum(['true', 'false']).default('false'),
});

// Produksi menolak start bila kunci wajib kosong atau mode debug aktif (rencana §9.2).
const produksi = dasar.extend({
    APP_DEBUG: z.literal('false', { error: 'APP_DEBUG harus false di produksi' }).default('false'),
    APP_URL: wajib,
    DATABASE_URL: wajib,
});

export type Env = z.infer<typeof dasar>;

export function bacaEnv(sumber: Record<string, string | undefined>): Env {
    // Kunci yang diisi string kosong diperlakukan sama dengan tidak diisi.
    const bersih = Object.fromEntries(Object.entries(sumber).filter(([, v]) => v !== undefined && v.trim() !== ''));
    const hasil = (bersih.NODE_ENV === 'production' ? produksi : dasar).safeParse(bersih);
    if (!hasil.success) throw new Error(`Konfigurasi env tidak valid:\n${z.prettifyError(hasil.error)}`);
    return hasil.data;
}

export const env = bacaEnv(process.env);
