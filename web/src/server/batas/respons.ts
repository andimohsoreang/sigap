import 'server-only';

// Header & respons 429 persis ThrottleRequests::getHeaders dan penanganan galat Laravel (bootstrap/app.php:93-105).

export type HeaderBatas = Record<string, string>;

/** Header saat lolos: X-RateLimit-Limit & X-RateLimit-Remaining. */
export function headerLolos(maks: number, sisa: number): HeaderBatas {
    return { 'X-RateLimit-Limit': String(maks), 'X-RateLimit-Remaining': String(sisa) };
}

/** Header saat ditolak: sisa 0, Retry-After (detik), X-RateLimit-Reset (detik epoch = sekarang + Retry-After). */
export function headerGagal(maks: number, retryAfter: number, now = Math.floor(Date.now() / 1000)): HeaderBatas {
    return { ...headerLolos(maks, 0), 'Retry-After': String(retryAfter), 'X-RateLimit-Reset': String(now + retryAfter) };
}

/** Pasang header batas ke respons yang sudah ada (jalur lolos). */
export function pasangHeaderBatas(res: Response, header: HeaderBatas): Response {
    for (const [k, v] of Object.entries(header)) res.headers.set(k, v);
    return res;
}

/**
 * 429 untuk API / permintaan JSON (`/api/*` atau expectsJson): ThrottleRequestsException dirender Laravel sebagai
 * `{"message":"Too Many Attempts."}`. Halaman HTML 429 (permintaan non-JSON non-Inertia) belum di-port.
 */
export function respons429Json(header: HeaderBatas): Response {
    return Response.json({ message: 'Too Many Attempts.' }, { status: 429, headers: header });
}

/**
 * Pesan validasi untuk formulir non-GET (Laravel: X-Inertia; di Next: Server Action) — Laravel membalas 303 kembali
 * dengan galat ini pada field `identifier` bila input itu ada, selain itu `throttle`.
 */
export function galat429Formulir(retryAfter: number, punyaIdentifier: boolean): { field: 'identifier' | 'throttle'; pesan: string } {
    return {
        field: punyaIdentifier ? 'identifier' : 'throttle',
        pesan: `Terlalu banyak percobaan. Silakan coba lagi dalam ${retryAfter} detik.`,
    };
}
