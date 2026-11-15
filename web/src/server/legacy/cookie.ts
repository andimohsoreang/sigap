import 'server-only';

import { createHmac } from 'node:crypto';

import { dekripsiByte, enkripsi, GalatDekripsi, type KunciLaravel } from './laravel-crypt';

// Padanan Illuminate\Cookie\Middleware\EncryptCookies + CookieValuePrefix (cookie tidak di-serialize).

const PANJANG_PREFIX = 41; // 40 hex sha1 + "|"
// ignoreBOM: U+FEFF di awal adalah isi data, bukan penanda yang boleh dibuang.
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/** CookieValuePrefix::create: hmac-sha1(nama + "v2", kunci) + "|". */
export function prefixCookie(nama: string, kunci: Buffer): string {
    return (
        createHmac('sha1', kunci)
            .update(nama + 'v2')
            .digest('hex') + '|'
    );
}

/** Nilai cookie terenkripsi seperti EncryptCookies::encrypt (prefix selalu dari kunci sekarang). */
export function enkripsiCookie(nama: string, nilai: string, k: KunciLaravel): string {
    return enkripsi(prefixCookie(nama, k.kunci) + nilai, k);
}

function dekripsiAman(nilai: string, k: KunciLaravel): Buffer | null {
    try {
        return dekripsiByte(nilai, k);
    } catch (e) {
        if (e instanceof GalatDekripsi) return null;
        throw e;
    }
}

function keString(b: Buffer): string | null {
    try {
        return utf8.decode(b);
    } catch {
        return null;
    }
}

/** EncryptCookies::decrypt + CookieValuePrefix::validate: null = cookie dianggap tidak ada (sama dengan Laravel). */
export function dekripsiCookie(nama: string, nilai: string, k: KunciLaravel): string | null {
    const isi = dekripsiAman(nilai, k);
    if (!isi) return null;
    const cocok = [k.kunci, ...k.sebelumnya].some((kunci) => isi.subarray(0, PANJANG_PREFIX).equals(Buffer.from(prefixCookie(nama, kunci))));
    return cocok ? keString(isi.subarray(PANJANG_PREFIX)) : null;
}

/** VerifyCsrfToken::getTokenFromRequest untuk header X-XSRF-TOKEN: prefix dibuang TANPA divalidasi; gagal → ''. */
export function tokenDariHeaderXsrf(header: string, k: KunciLaravel): string {
    const isi = dekripsiAman(header, k);
    return (isi && keString(isi.subarray(PANJANG_PREFIX))) ?? '';
}

/** php_raw_url_decode: %XX di-decode, "+" tetap "+", % yang tidak sah dibiarkan. */
function rawurldecodePhp(s: string): string {
    const byte = Buffer.from(s, 'utf8');
    const out: number[] = [];
    for (let i = 0; i < byte.length; i++) {
        const hex = byte.toString('latin1', i + 1, i + 3);
        if (byte[i] === 0x25 && /^[0-9a-fA-F]{2}$/.test(hex)) {
            out.push(parseInt(hex, 16));
            i += 2;
        } else {
            out.push(byte[i]);
        }
    }
    return Buffer.from(out).toString('utf8');
}

/**
 * Nama variabel PHP (php_register_variable_ex): spasi awal dibuang, "." dan spasi sebelum "[" pertama → "_".
 * `nama[…]` dengan "]" → array; "[" tanpa "]" → "_".
 */
function namaPhp(mentah: string): { nama: string; array: boolean } {
    const n = mentah.replace(/^ +/, '');
    const b = n.indexOf('[');
    const dasar = (b < 0 ? n : n.slice(0, b)).replace(/[. ]/g, '_');
    if (b < 0) return { nama: dasar, array: false };
    if (n.indexOf(']', b) > b) return { nama: dasar, array: true };
    return { nama: `${dasar}_${n.slice(b + 1)}`, array: false };
}

/**
 * Ambil satu cookie dari header Cookie persis seperti PHP 8.4 mengisi $_COOKIE (diuji dengan `php -S`):
 * pemisah ";", nilai rawurldecode, nama dinormalisasi, kemunculan PERTAMA menang, tetapi bentuk array
 * (`nama[x]=…`) menimpa nilai string → null karena Laravel tidak memakai cookie array sebagai string.
 * (Parser cookies() Next.js memakai kemunculan terakhir dan tidak menormalisasi nama.)
 */
export function bacaCookie(header: string | null | undefined, nama: string): string | null {
    if (!header) return null;
    let hasil: string | null = null;
    for (const bagian of header.split(';')) {
        const i = bagian.indexOf('=');
        const n = namaPhp((i < 0 ? bagian : bagian.slice(0, i)).replace(/^[ \t]+/, ''));
        if (n.nama !== nama) continue;
        if (n.array) return null;
        hasil ??= i < 0 ? '' : rawurldecodePhp(bagian.slice(i + 1));
    }
    return hasil;
}
