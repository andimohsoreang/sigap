import 'server-only';

import type { InferSelectModel, SQL } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import pg from 'pg';

import { env } from '@/server/env';
import { log } from '@/server/log';

import { petakanGalatDb } from './galat';
import * as schema from './schema';

export { GalatDb, GalatUnik, petakanGalatDb } from './galat';

// Aman untuk PgBouncer mode transaksi (deploy/next/pgbouncer/pgbouncer.ini):
// - tanpa state sesi: jangan SET (pakai SET LOCAL di dalam transaksi), LISTEN, advisory lock sesi, atau temp table;
// - query Drizzle memakai prepared statement tanpa nama; `.prepare('nama')` jangan dipakai;
// - statement_timeout & idle_in_transaction_session_timeout TIDAK dikirim sebagai parameter startup (PgBouncer
//   menolak parameter yang tidak dikenal) — diatur per role: ALTER ROLE cc_app SET … (rencana §9.3, wilayah devops).
// Ukuran (DB_POOL_MAX, bawaan 10 = default_pool_size PgBouncer): lebih besar hanya menambah antrean di PgBouncer.
const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: env.DB_POOL_MAX,
    // Batas menunggu koneksi dari pool lokal & membuka koneksi ke PgBouncer. Antrean di dalam PgBouncer (setelah
    // terhubung) dibatasi query_wait_timeout di pgbouncer.ini, bukan di sini.
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    application_name: env.DB_APP_NAME,
});
// Koneksi menganggur yang putus (restart PgBouncer/PG) memancarkan 'error' di pool; tanpa listener proses berhenti.
pool.on('error', (err) => log.warn({ err }, 'koneksi DB menganggur terputus'));

export const db = drizzle({ client: pool, schema });

export type Db = typeof db;
export type Transaksi = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Tutup pool setelah semua query selesai (worker/CLI/test). Web tidak memanggilnya: Next.js keluar sendiri setelah
 * request & `after()` selesai, dan menutup pool lebih awal membuat `after()` yang masih berjalan gagal.
 */
export function tutupDb(): Promise<void> {
    return pool.ended ? Promise.resolve() : pool.end();
}

/** Transaksi READ COMMITTED (sama dengan DB::transaction Laravel); galat DB dipetakan lewat petakanGalatDb. */
export async function transaksi<T>(fn: (tx: Transaksi) => Promise<T>): Promise<T> {
    try {
        return await db.transaction(fn);
    } catch (e) {
        throw petakanGalatDb(e);
    }
}

/**
 * `SELECT … FOR UPDATE` (lockForUpdate Laravel) di dalam transaksi. Mengunci SEMUA baris yang cocok, tanpa LIMIT 1
 * seperti `->first()` Laravel — pakai kondisi yang menyaring ke baris yang dimaksud (mis. per id). Diurutkan per id
 * agar beberapa baris selalu dikunci dengan urutan yang sama (mencegah deadlock). `kondisi` wajib: `and()` kosong
 * atau undefined akan mengunci seluruh tabel.
 */
export async function kunciBaris<T extends PgTable & { id: PgColumn }>(tx: Transaksi, tabel: T, kondisi: SQL) {
    // `from()` tidak menerima tabel generik (tipe kondisional Drizzle), jadi tipe baris dipulihkan lewat InferSelectModel.
    const baris = await tx
        .select()
        .from(tabel as PgTable)
        .where(kondisi)
        .orderBy(tabel.id)
        .for('update');
    return baris as InferSelectModel<T>[];
}
