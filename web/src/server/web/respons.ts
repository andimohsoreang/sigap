import 'server-only';

import { NextResponse } from 'next/server';

import { htmlGalat } from './halaman-galat';

// Respons dengan bentuk persis Laravel 12 (APP_DEBUG=false) untuk galat yang dirender exception handler.

/** Judul bawaan errors::{kode} Laravel (Symfony Response::$statusTexts). */
const JUDUL: Record<number, string> = {
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    419: 'Page Expired',
    429: 'Too Many Requests',
    500: 'Server Error',
    503: 'Service Unavailable',
};

/**
 * HttpException Laravel. JSON: `{"message": …}` ber-JSON_PRETTY_PRINT (indentasi 4 spasi, seperti
 * Handler::prepareJsonResponse). HTML: halaman errors::minimal. Pesan HTML 403 = pesan abort() atau "Forbidden";
 * kode lain memakai judulnya (419 "Page Expired", 429 "Too Many Requests").
 */
export function responsGalat(status: number, json: boolean, pesan?: string, header?: HeadersInit): NextResponse {
    const judul = JUDUL[status] ?? 'Error';
    if (json) {
        // convertExceptionToArray: pesan HttpException apa adanya — tanpa pesan (abort(403), AccessDenied) → "".
        const body = JSON.stringify({ message: pesan ?? '' }, null, 4);
        return new NextResponse(body, { status, headers: { ...Object.fromEntries(new Headers(header)), 'Content-Type': 'application/json' } });
    }
    const isi = htmlGalat(status, judul, status === 403 ? pesan || judul : judul);
    return new NextResponse(isi, { status, headers: { ...Object.fromEntries(new Headers(header)), 'Content-Type': 'text/html; charset=utf-8' } });
}

/** TokenMismatchException → 419 (pesan JSON "CSRF token mismatch."). */
export function respons419(json: boolean): NextResponse {
    return responsGalat(419, json, 'CSRF token mismatch.');
}

/** redirect() Laravel: 302 (atau 303) dengan Location absolut. */
export function redirectLaravel(asal: string, jalur: string, status: 302 | 303 = 302): NextResponse {
    return new NextResponse(null, { status, headers: { Location: new URL(jalur, asal).toString() } });
}

/** `response()->json(...)` biasa (tanpa pretty print), mis. respons EnsureRole & AuthenticationException. */
export function jsonLaravel(body: unknown, status = 200): NextResponse {
    return NextResponse.json(body, { status });
}
