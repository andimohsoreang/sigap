import 'server-only';

import { createHmac } from 'node:crypto';

import { base64Ketat } from './laravel-crypt';

// Padanan sigap/app/Support/Nik.php.

/** trim() PHP: hanya " \t\n\r\0\x0B" (bukan spasi Unicode seperti String.prototype.trim). */
export function trimPhp(nilai: string): string {
    return nilai.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '');
}

function normalisasi(nik: string | null | undefined): string | null {
    if (nik === null || nik === undefined) return null;
    const t = trimPhp(nik);
    return t === '' ? null : t;
}

/** Nik::key dengan NIK_HASH_KEY terisi: `base64:` yang sah di-decode, selain itu string literal. */
export function kunciNik(nikHashKey: string): Buffer {
    const k = trimPhp(nikHashKey);
    // Produksi tanpa NIK_HASH_KEY melempar di Laravel; jatuh ke APP_KEY hanya untuk local/testing.
    if (k === '') throw new Error('NIK_HASH_KEY belum diatur.');
    return (k.startsWith('base64:') && base64Ketat(k.slice(7))) || Buffer.from(k, 'utf8');
}

/** Nik::hash: blind index HMAC-SHA256 hex; null bila kosong. */
export function hashNik(nik: string | null | undefined, kunci: Buffer): string | null {
    const n = normalisasi(nik);
    return n === null ? null : createHmac('sha256', kunci).update(n, 'utf8').digest('hex');
}

/** Nik::mask: 4 byte awal + 8 bintang + 4 byte akhir; < 8 byte → bintang semua. */
export function maskNik(nik: string | null | undefined): string | null {
    const n = normalisasi(nik);
    if (n === null) return null;
    const b = Buffer.from(n, 'utf8');
    if (b.length < 8) return '*'.repeat(b.length);
    // shortcut: potong per byte seperti substr PHP; NIK selalu ASCII, input multibyte bisa terpotong di tengah karakter.
    return b.subarray(0, 4).toString('utf8') + '********' + b.subarray(-4).toString('utf8');
}

/** Nik::looksLikeNik. */
export function miripNik(nilai: string): boolean {
    return /^\d{16}$/.test(trimPhp(nilai));
}
