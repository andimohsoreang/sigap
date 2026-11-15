import 'server-only';

import { createHmac } from 'node:crypto';

import { dekripsiByte, enkripsi, GalatDekripsi, type KunciLaravel } from './laravel-crypt';

// Padanan Illuminate\Cookie\Middleware\EncryptCookies + CookieValuePrefix (cookie tidak di-serialize).

const PANJANG_PREFIX = 41; // 40 hex sha1 + "|"
const utf8 = new TextDecoder('utf-8', { fatal: true });

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

/** urldecode() PHP: "+" menjadi spasi, %XX di-decode, % yang tidak sah dibiarkan. */
function urldecodePhp(s: string): string {
    const byte = Buffer.from(s.replace(/\+/g, ' '), 'utf8');
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
 * Ambil satu cookie dari header Cookie seperti PHP mengisi $_COOKIE: nilai di-urldecode dan
 * kemunculan PERTAMA yang dipakai (parser cookies() Next.js memakai yang terakhir).
 */
export function bacaCookie(header: string | null | undefined, nama: string): string | null {
    if (!header) return null;
    for (const bagian of header.split(';')) {
        const i = bagian.indexOf('=');
        // shortcut: nama dicocokkan persis; PHP juga mengubah "." dan spasi pada nama menjadi "_".
        if (i >= 0 && bagian.slice(0, i).replace(/^[ \t]+/, '') === nama) return urldecodePhp(bagian.slice(i + 1));
    }
    return null;
}
