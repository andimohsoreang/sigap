import 'server-only';

import { customType } from 'drizzle-orm/pg-core';

import { env } from '@/server/env';
import { bacaKunci, dekripsi, enkripsi, type KunciLaravel } from '@/server/legacy/laravel-crypt';
import { hashNik, kunciNik } from '@/server/legacy/nik';

const WIB_MS = 7 * 3600 * 1000;
// DateStyle ISO bawaan PostgreSQL untuk timestamp(0): "2026-11-14 10:00:00".
const POLA_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/;

/** Jam dinding WIB dari DB (`timestamp(0) without time zone`, ditulis Laravel dengan APP_TIMEZONE=Asia/Jakarta). */
export function dariWib(nilai: string): Date {
    if (!POLA_TIMESTAMP.test(nilai)) throw new Error(`Format timestamp tidak dikenal: ${nilai}`);
    return new Date(`${nilai.replace(' ', 'T')}+07:00`);
}

/** Date → jam dinding WIB dipotong (bukan dibulatkan) ke detik, seperti Carbon->format('Y-m-d H:i:s'). */
export function keWib(waktu: Date): string {
    const ms = waktu.getTime();
    if (Number.isNaN(ms)) throw new Error('Waktu tidak valid.');
    return new Date(Math.floor(ms / 1000) * 1000 + WIB_MS).toISOString().slice(0, 19).replace('T', ' ');
}

/** Format JSON Laravel (Carbon::toJSON): UTC, 6 digit mikrodetik, mis. `2026-11-14T03:00:00.000000Z`. */
export function keJsonLaravel(waktu: Date | null): string | null {
    return waktu === null ? null : waktu.toISOString().replace(/\.(\d{3})Z$/, '.$1000Z');
}

/**
 * Kolom `timestamp(0) without time zone` berisi jam WIB. Jangan isi dengan `now()`/`CURRENT_TIMESTAMP` di SQL:
 * sesi DB ber-TimeZone UTC, jadi waktu dihitung di aplikasi lalu dikirim sebagai parameter.
 */
export const waktuWib = customType<{ data: Date; driverData: string }>({
    dataType: () => 'timestamp(0) without time zone',
    fromDriver: dariWib,
    toDriver: keWib,
});

let kunciApp: KunciLaravel | undefined;
let kunciHashNik: Buffer | undefined;

function kunci(): KunciLaravel {
    if (!env.APP_KEY) throw new Error('APP_KEY belum diatur.');
    return (kunciApp ??= bacaKunci(env.APP_KEY, env.APP_PREVIOUS_KEYS));
}

/**
 * Cast `encrypted` Laravel (Crypt::encryptString dengan APP_KEY, dekripsi mencoba APP_PREVIOUS_KEYS).
 * Ciphertext ber-IV acak: jangan dipakai di WHERE — cari lewat kolom `*_nik_hash`.
 */
export const terenkripsi = customType<{ data: string; driverData: string }>({
    dataType: () => 'text',
    fromDriver: (nilai) => dekripsi(nilai, kunci()),
    toDriver: (nilai) => enkripsi(nilai, kunci()),
});

/** Nik::hash dengan NIK_HASH_KEY, untuk WHERE `nik_hash`/`reporter_nik_hash`. */
export function hashNikApp(nik: string | null | undefined): string | null {
    if (!env.NIK_HASH_KEY) throw new Error('NIK_HASH_KEY belum diatur.');
    return hashNik(nik, (kunciHashNik ??= kunciNik(env.NIK_HASH_KEY)));
}

// Padanan hook `saving` User & Ticket: hash ditulis ulang setiap kali kolom NIK ikut di-insert/update.

/** Nilai insert/update `users`: isi `nikHash` bila `nik` ada di nilai. */
export function denganNikHash<T extends object>(nilai: T & { nik?: string | null }): T & { nikHash?: string | null } {
    return 'nik' in nilai ? { ...nilai, nikHash: hashNikApp(nilai.nik) } : nilai;
}

/** Nilai insert/update `tickets`: isi `reporterNikHash` bila `reporterNik` ada di nilai. */
export function denganReporterNikHash<T extends object>(nilai: T & { reporterNik?: string | null }): T & { reporterNikHash?: string | null } {
    return 'reporterNik' in nilai ? { ...nilai, reporterNikHash: hashNikApp(nilai.reporterNik) } : nilai;
}
