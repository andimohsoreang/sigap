import 'server-only';

import { z } from 'zod';

const wajib = z.string().trim().min(1);

const dasar = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    APP_DEBUG: z.enum(['true', 'false']).default('false'),
    APP_URL: wajib.optional(),
    DATABASE_URL: wajib.optional(),
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
    // `next build` berjalan dengan NODE_ENV=production tanpa rahasia runtime; validasi produksi terjadi saat server start.
    const skema = bersih.NODE_ENV === 'production' && bersih.NEXT_PHASE !== 'phase-production-build' ? produksi : dasar;
    const hasil = skema.safeParse(bersih);
    if (!hasil.success) throw new Error(`Konfigurasi env tidak valid:\n${z.prettifyError(hasil.error)}`);
    return hasil.data;
}

export const env = bacaEnv(process.env);
