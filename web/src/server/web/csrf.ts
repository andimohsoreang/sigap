// Perlindungan CSRF, dua lapis:
// 1. Asal permintaan (proxy.ts, semua metode yang mengubah data): Sec-Fetch-Site / Origin harus situs sendiri.
//    Laravel tidak punya lapis ini; permintaan lintas situs di Laravel tetap gagal 419 karena tidak membawa token,
//    jadi penolakannya juga 419.
// 2. Token sesi (route handler, padanan VerifyCsrfToken::tokensMatch): `_token` input, X-CSRF-TOKEN, atau
//    X-XSRF-TOKEN (dikirim axios `api` dari cookie XSRF-TOKEN) dibandingkan constant-time dengan token CSRF SESI —
//    bukan id sesi. Cookie XSRF-TOKEN berisi token apa adanya (Laravel mengenkripsinya; tidak menambah keamanan
//    karena cookie itu memang dibaca JavaScript).
// Server Actions (S15 dst.) tidak membawa token: dilindungi lapis 1 plus pemeriksaan Origin bawaan Next.js
// (action-handler membandingkan Origin dengan Host/X-Forwarded-Host) dan id aksi yang tidak bisa ditebak.

import { samaWaktuTetap } from '@/server/legacy/laravel-crypt';

const METODE_BACA = new Set(['GET', 'HEAD', 'OPTIONS']);

/** VerifyCsrfToken::isReading. */
export const metodeBaca = (metode: string) => METODE_BACA.has(metode.toUpperCase());

/**
 * Permintaan pengubah data berasal dari situs sendiri? Sec-Fetch-Site (browser modern) diutamakan: hanya
 * `same-origin` atau `none` (dibuka langsung pengguna). Tanpa header itu, Origin (bila ada) harus sama persis.
 * Keduanya tidak ada (klien non-browser) → lolos ke pemeriksaan token.
 */
export function asalSah(h: Headers, asal: string): boolean {
    const situs = h.get('sec-fetch-site');
    if (situs) return situs === 'same-origin' || situs === 'none';
    const origin = h.get('origin');
    return origin === null || origin === asal;
}

/** VerifyCsrfToken::getTokenFromRequest: `_token` → X-CSRF-TOKEN → X-XSRF-TOKEN. */
export function tokenDariPermintaan(h: Headers, input: Record<string, unknown>): string | null {
    const dariInput = input._token;
    if (typeof dariInput === 'string' && dariInput !== '') return dariInput;
    return h.get('x-csrf-token') || h.get('x-xsrf-token') || null;
}

/** VerifyCsrfToken::tokensMatch terhadap token CSRF sesi (hash_equals). */
export function tokenCocok(tokenSesi: string | null | undefined, token: string | null): boolean {
    return typeof tokenSesi === 'string' && tokenSesi !== '' && typeof token === 'string' && samaWaktuTetap(tokenSesi, token);
}
