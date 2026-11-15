import type { NextRequest } from 'next/server';

import { teruskanApiLuar, tumpukanWeb } from '@/server/auth/tumpukan';
import { env } from '@/server/env';
import { log } from '@/server/log';
import { batasBody, bodyTerlaluBesar, respons413 } from '@/server/web/batas-body';
import { asalSah, metodeBaca } from '@/server/web/csrf';
import { buatNonce, kebijakanCsp } from '@/server/web/header';
import { asalAplikasi, jalurTerdekode, responsJson } from '@/server/web/permintaan';
import { respons419, responsGalat } from '@/server/web/respons';

// Next.js 16: `middleware` berganti nama menjadi `proxy` dan SELALU berjalan di runtime Node.js (opsi runtime
// dilarang di berkas ini). Karena itu proxy boleh memakai DB: ia menjalankan tumpukan middleware `web` Laravel
// (sesi, cookie ingat, sidik sandi, guard rute) — satu-satunya tempat Set-Cookie bisa dipasang untuk respons halaman
// (Server Component tidak bisa) dan status redirect/403 bisa dibuat persis Laravel (302, halaman galat Laravel).
// Halaman, route handler, dan Server Action tetap memeriksa pengguna sendiri bila butuh (pertahanan berlapis).
//
// Tidak dilewati proxy (matcher): aset /_next/static & /_next/image, CSS/font /_cc, healthcheck /up, dan WebSocket
// /_realtime (upgrade diteruskan rewrite next.config.ts tanpa melewati proxy). Header keamanan statis untuk semua
// jalur dipasang next.config.ts.

export async function proxy(req: NextRequest) {
    const nonce = buatNonce();
    const csp = kebijakanCsp({ nonce, ketat: env.NODE_ENV === 'production', recaptcha: !!env.RECAPTCHA_SITE_KEY, appUrl: env.APP_URL });
    // Next.js membaca nonce dari header CSP permintaan dan memasangnya pada skrip framework; x-nonce untuk layout.
    const teruskan = new Headers(req.headers);
    teruskan.set('x-nonce', nonce);
    teruskan.set('content-security-policy', csp);
    const json = responsJson(req.nextUrl.pathname, req.headers);

    let res: Response;
    try {
        // Urutan: nginx (ukuran body) → API tanpa sesi → asal permintaan → tumpukan web.
        if (bodyTerlaluBesar(req.headers, batasBody(jalurTerdekode(req.nextUrl.pathname)))) return respons413();
        res =
            teruskanApiLuar(req, teruskan) ??
            (!metodeBaca(req.method) && !asalSah(req.headers, asalAplikasi(req.url)) ? respons419(json) : await tumpukanWeb(req, teruskan));
    } catch (err) {
        // Galat tak terduga (mis. DB mati): halaman/JSON 500 Laravel, tanpa detail; galat DB dibersihkan serializer log.
        log.error({ err }, 'proxy gagal');
        res = responsGalat(500, json, 'Server Error');
    }
    res.headers.set('Content-Security-Policy', csp);
    return res;
}

export const config = {
    matcher: ['/((?!_next/static/|_next/image|_cc/|_realtime/|up$|favicon\\.ico$).*)'],
};
