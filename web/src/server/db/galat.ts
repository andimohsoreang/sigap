import 'server-only';

import { DrizzleQueryError } from 'drizzle-orm';
import pg from 'pg';

// Tanpa pool/env: diimpor juga oleh log.ts (serializer galat) tanpa impor melingkar.

/**
 * Galat query tanpa nilai data. DrizzleQueryError memuat `params` (NIK hash, surel, telepon) di message, stack, dan
 * properti; pg.DatabaseError memuat `detail` ("Key (email)=(…) already exists").
 */
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

/**
 * petakanGalatDb di sepanjang rantai `cause` (untuk log). Galat yang rantainya berubah disalin, bukan diubah, supaya
 * pemanggil yang masih memegang galat asli tidak terpengaruh.
 */
export function bersihkanGalatDb(e: unknown, kedalaman = 0): unknown {
    const p = petakanGalatDb(e);
    if (p !== e || !(e instanceof Error) || e.cause === undefined || kedalaman >= 10) return p;
    const sebab = bersihkanGalatDb(e.cause, kedalaman + 1);
    if (sebab === e.cause) return e;
    const salinan = Object.create(Object.getPrototypeOf(e), Object.getOwnPropertyDescriptors(e)) as Error;
    Object.defineProperty(salinan, 'cause', { ...Object.getOwnPropertyDescriptor(e, 'cause'), value: sebab });
    // `stack` V8 berupa accessor milik objek asli; tanpa ini salinan kehilangan stack.
    Object.defineProperty(salinan, 'stack', { value: e.stack, writable: true, configurable: true });
    return salinan;
}
