import 'server-only';

import type { NextResponse } from 'next/server';

import { env } from '@/server/env';

// Cookie sesi milik Next.js (rencana §10.1 `cc_session`, §9.6 `__Host-`).
//
// Prefix `__Host-` dipakai di produksi (Secure): browser menolak cookie ber-prefix ini bila diset dengan Domain atau
// dari http, sehingga subdomain lain di andimohamad.my.id (banyak aplikasi lain di server yang sama) tidak bisa
// menanam/menimpa cookie sesi (cookie tossing → login CSRF / fiksasi). Di dev (http) prefix itu ditolak browser,
// jadi namanya `cc_session` tanpa prefix. XSRF-TOKEN tetap tanpa prefix: namanya dibaca axios (src/lib/api.ts) dan
// cookie tiruan hanya membuat permintaan gagal 419, bukan lolos.

/** Secure seperti `session.secure` Laravel (bawaan: APP_ENV production). */
export const COOKIE_AMAN = env.NODE_ENV === 'production';
export const COOKIE_SESI = COOKIE_AMAN ? '__Host-cc_session' : 'cc_session';
/** Padanan cookie `remember_web_*` Laravel ("Ingat saya"). */
export const COOKIE_INGAT = COOKIE_AMAN ? '__Host-cc_ingat' : 'cc_ingat';
export const COOKIE_XSRF = 'XSRF-TOKEN';
/** SessionGuard::$rememberDuration = 576000 menit (400 hari). */
export const UMUR_INGAT_DETIK = 576_000 * 60;

/**
 * Nilai cookie `nama` dari header Cookie. Lebih dari satu cookie bernama sama (mis. ditanam subdomain lain dengan
 * Domain berbeda) → 'ganda': pemanggil memperlakukannya sebagai tanpa sesi, tidak menebak mana yang asli.
 */
export function bacaCookie(header: string | null, nama: string): string | null | 'ganda' {
    let nilai: string | null = null;
    for (const bagian of (header ?? '').split(';')) {
        const i = bagian.indexOf('=');
        if (i < 0 || bagian.slice(0, i).trim() !== nama) continue;
        if (nilai !== null) return 'ganda';
        nilai = bagian.slice(i + 1).trim();
    }
    return nilai;
}

/** Header Cookie dengan cookie `nama` diganti `nilai` (atau dibuang bila null), untuk diteruskan proxy ke rute. */
export function gantiCookie(header: string | null, nama: string, nilai: string | null): string {
    const sisa = (header ?? '')
        .split(';')
        .map((b) => b.trim())
        .filter((b) => b !== '' && b.slice(0, Math.max(0, b.indexOf('='))).trim() !== nama);
    if (nilai !== null) sisa.push(`${nama}=${nilai}`);
    return sisa.join('; ');
}

type Opsi = { httpOnly: boolean; umurDetik: number };

function pasang(res: NextResponse, nama: string, nilai: string, { httpOnly, umurDetik }: Opsi) {
    // Laravel mengirim expires + Max-Age; path=/; samesite=lax (config/session.php).
    res.cookies.set({
        name: nama,
        value: nilai,
        path: '/',
        httpOnly,
        secure: COOKIE_AMAN,
        sameSite: 'lax',
        maxAge: umurDetik,
        expires: umurDetik > 0 ? new Date(Date.now() + umurDetik * 1000) : new Date(0),
    });
}

/**
 * Cookie sesi + XSRF-TOKEN pada respons, Max-Age = SESSION_LIFETIME (diperbarui tiap respons: idle-based,
 * `expire_on_close` false seperti Laravel). XSRF-TOKEN tidak HttpOnly (dibaca axios), isinya token CSRF sesi.
 */
export function pasangCookieSesi(res: NextResponse, idSesi: string, csrf: string): void {
    const umurDetik = env.SESSION_LIFETIME * 60;
    pasang(res, COOKIE_SESI, idSesi, { httpOnly: true, umurDetik });
    pasang(res, COOKIE_XSRF, csrf, { httpOnly: false, umurDetik });
}

export function pasangCookieIngat(res: NextResponse, nilai: string | null): void {
    pasang(res, COOKIE_INGAT, nilai ?? '', { httpOnly: true, umurDetik: nilai === null ? 0 : UMUR_INGAT_DETIK });
}
