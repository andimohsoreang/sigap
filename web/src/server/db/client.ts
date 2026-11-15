import 'server-only';

import { DrizzleQueryError, type InferSelectModel, type SQL } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import pg from 'pg';

import { env } from '@/server/env';
import { log } from '@/server/log';

import * as schema from './schema';

// Aman untuk PgBouncer mode transaksi (deploy/next/pgbouncer/pgbouncer.ini):
// - tanpa state sesi: jangan SET (pakai SET LOCAL di dalam transaksi), LISTEN, advisory lock sesi, atau temp table;
// - query Drizzle memakai prepared statement tanpa nama; `.prepare('nama')` jangan dipakai;
// - statement_timeout & idle_in_transaction_session_timeout TIDAK dikirim sebagai parameter startup (PgBouncer
//   menolak parameter yang tidak dikenal) — diatur per role: ALTER ROLE cc_app SET … (rencana §9.3, wilayah devops).
// Ukuran: 10 = default_pool_size PgBouncer; lebih besar hanya menambah antrean di PgBouncer.
const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    // Pool penuh/PgBouncer tidak terjangkau → galat setelah 5 dtk, bukan request menggantung.
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    application_name: 'contact-center-web',
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

/** Galat query tanpa nilai parameter (DrizzleQueryError memuat params — NIK hash, surel, telepon — di pesannya). */
export class GalatDb extends Error {
    override name = 'GalatDb';

    constructor(
        pesan: string,
        readonly kode?: string,
        readonly constraint?: string,
        readonly query?: string,
    ) {
        super(pesan);
    }
}

/** 23505 unique_violation, mis. nomor tiket bertabrakan → ulangi transaksi dengan nomor baru. */
export class GalatUnik extends GalatDb {
    override name = 'GalatUnik';
}

/** Ubah galat dari pg/Drizzle menjadi GalatDb/GalatUnik; galat lain (domain, rollback) dikembalikan apa adanya. */
export function petakanGalatDb(e: unknown): unknown {
    const query = e instanceof DrizzleQueryError ? e.query : undefined;
    const sebab = e instanceof DrizzleQueryError ? e.cause : e;
    if (sebab instanceof pg.DatabaseError) {
        // Pesan PG bisa memuat nilai input (mis. "invalid input syntax … \"abc\""), jadi hanya kode & constraint.
        const Kelas = sebab.code === '23505' ? GalatUnik : GalatDb;
        return new Kelas(`Query database gagal (SQLSTATE ${sebab.code})`, sebab.code, sebab.constraint, query);
    }
    // Galat koneksi dari driver (timeout, socket putus) tidak memuat data.
    if (e instanceof DrizzleQueryError)
        return new GalatDb(`Query database gagal: ${(sebab as Error | undefined)?.message}`, undefined, undefined, query);
    return e;
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
 * `SELECT … FOR UPDATE` (lockForUpdate Laravel) di dalam transaksi; mengunci semua baris yang cocok. Diurutkan per id
 * agar beberapa baris selalu dikunci dengan urutan yang sama (mencegah deadlock).
 */
export async function kunciBaris<T extends PgTable & { id: PgColumn }>(tx: Transaksi, tabel: T, kondisi: SQL | undefined) {
    // `from()` tidak menerima tabel generik (tipe kondisional Drizzle), jadi tipe baris dipulihkan lewat InferSelectModel.
    const baris = await tx
        .select()
        .from(tabel as PgTable)
        .where(kondisi)
        .orderBy(tabel.id)
        .for('update');
    return baris as InferSelectModel<T>[];
}
