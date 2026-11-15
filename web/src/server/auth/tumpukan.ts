import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { metodeBaca, tokenCocok, tokenDariPermintaan } from '@/server/web/csrf';
import { asalAplikasi, inginJson, ipKlien, jalurAman, jalurTerdekode, responsJson } from '@/server/web/permintaan';
import { jsonLaravel, redirectLaravel, respons419, responsGalat } from '@/server/web/respons';

import { catatAudit } from './audit';
import { bacaCookie, COOKIE_INGAT, COOKIE_SESI, gantiCookie, pasangCookieIngat, pasangCookieSesi } from './cookie';
import { jalankanGuard, langkahRute, wajibMasuk, type Keputusan, type KonteksGuard } from './guard';
import { kilatkan, umurkanKilat } from './kilat';
import { keluarkan, penggunaDariIngat } from './masuk';
import { ambilPengguna } from './pengguna';
import type { Pengguna } from './peran';
import { muatSesi, periksaSidik, rotasiSesi, sentuhSesi, sesiBaru, sidikSandi, simpanSesi, tokenAcak, type MetaPermintaan, type Sesi } from './sesi';

// Tumpukan middleware grup `web` Laravel yang dijalankan proxy.ts (runtime Node.js) untuk setiap permintaan dinamis:
// StartSession (muat/buat sesi, umur flash, perbarui cookie), SessionGuard::user (termasuk cookie "Ingat saya"),
// AuthenticateSession (sidik sandi), lalu middleware rute (auth/guest/role/portal.verified, lihat guard.ts).
// Asal permintaan dicek proxy.ts sebelum ini; token CSRF dicek di sini (dan diulang di route handler).

/** EnsureFrontendRequestsAreStateful::fromFrontend: Referer/Origin dari situs sendiri. */
export function dariFrontend(h: Headers, asal: string): boolean {
    const sumber = h.get('referer') || h.get('origin');
    return !!sumber && jalurAman(sumber, asal) !== null;
}

/**
 * /api/* dari klien luar (tanpa Referer/Origin situs sendiri): Sanctum tidak memulai sesi, jadi cookie sesi & ingat
 * dibuang dari permintaan yang diteruskan — rute API (dan penggunaSaatIni) melihat tamu, bukan pengguna cookie.
 * Tanpa cookie, CSRF tidak relevan (CORS Laravel allowed_origins '*'); token Bearer menyusul di S15.
 */
export function teruskanApiLuar(req: NextRequest, headerTeruskan: Headers): NextResponse | null {
    const asal = asalAplikasi(req.url);
    const ctx = konteksGuard(req, asal);
    if (!ctx.path.startsWith('api/') || dariFrontend(req.headers, asal)) return null;
    // Guard rute tetap berlaku sebagai tamu: auth:sanctum tanpa token → 401 {"message":"Unauthenticated."}.
    const keputusan = jalankanGuard(ctx, null, langkahRute(ctx.metode, ctx.path));
    if (keputusan.jenis !== 'lanjut') return keRespons(keputusan, ctx, asal);
    headerTeruskan.set('cookie', gantiCookie(gantiCookie(req.headers.get('cookie'), COOKIE_SESI, null), COOKIE_INGAT, null));
    return NextResponse.next({ request: { headers: headerTeruskan } });
}

/**
 * Token CSRF permintaan: header X-CSRF-TOKEN / X-XSRF-TOKEN, atau `_token` di body x-www-form-urlencoded (dibaca dari
 * salinan; body asli tetap diteruskan ke rute). shortcut: `_token` di multipart tidak dibaca di sini (unggahan bisa
 * besar) — formulir multipart memakai axios `api` yang mengirim X-XSRF-TOKEN; rute tetap memeriksa ulang.
 */
async function tokenCsrf(req: NextRequest): Promise<string | null> {
    const dariHeader = tokenDariPermintaan(req.headers, {});
    if (dariHeader) return dariHeader;
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/x-www-form-urlencoded')) return null;
    const t = new URLSearchParams(await req.clone().text()).get('_token');
    return t || null;
}

export function konteksGuard(req: NextRequest, asal: string): KonteksGuard {
    const { pathname, search } = req.nextUrl;
    return {
        metode: req.method.toUpperCase(),
        jalur: pathname,
        jalurPenuh: pathname + search,
        json: responsJson(pathname, req.headers),
        inginJson: inginJson(req.headers),
        path: jalurTerdekode(pathname),
        sebelumnya: jalurAman(req.headers.get('referer'), asal),
    };
}

/** Ubah keputusan guard menjadi respons Laravel. */
function keRespons(k: Keputusan, ctx: KonteksGuard, asal: string): NextResponse {
    switch (k.jenis) {
        case 'redirect':
            return redirectLaravel(asal, k.ke);
        case 'json':
            return jsonLaravel(k.body, k.status);
        case 'galat':
            return responsGalat(k.status, ctx.json, k.pesan);
        case 'lanjut':
            throw new Error('keputusan lanjut tidak punya respons');
    }
}

export async function tumpukanWeb(req: NextRequest, headerTeruskan: Headers): Promise<NextResponse> {
    const h = req.headers;
    const asal = asalAplikasi(req.url);
    const ctx = konteksGuard(req, asal);
    const meta: MetaPermintaan = { ip: ipKlien(h), userAgent: h.get('user-agent') };
    const baca = ctx.metode === 'GET' || ctx.metode === 'HEAD';
    const cookieSesi = bacaCookie(h.get('cookie'), COOKIE_SESI);
    let sesi: Sesi | null = cookieSesi === 'ganda' ? null : await muatSesi(cookieSesi);
    // Sesi tamu dibuat untuk halaman (GET) agar XSRF-TOKEN ada sebelum POST pertama. POST tanpa sesi tidak membuat
    // sesi di sini (rute menolaknya 419, Laravel juga).
    if (!sesi && baca) sesi = sesiBaru();
    const idAwal = sesi?.ada ? sesi.id : null;
    const csrfAwal = sesi?.csrf;
    let ubah = sesi !== null && umurkanKilat(sesi.data);

    // VerifyCsrfToken ada di grup web SEBELUM AuthenticateSession & middleware rute: token salah → 419 lebih dulu
    // daripada redirect auth/guest. Server Action (header Next-Action) dilindungi pemeriksaan asal; /broadcasting/auth
    // dikecualikan Laravel (withoutMiddleware).
    if (!metodeBaca(ctx.metode) && !h.has('next-action') && ctx.path !== 'broadcasting/auth' && !tokenCocok(sesi?.csrf, await tokenCsrf(req))) {
        if (sesi && ubah) await simpanSesi(sesi, meta);
        return respons419(ctx.json);
    }

    let pengguna: Pengguna | null = sesi?.userId ? await ambilPengguna(sesi.userId) : null;
    const cookieIngat = bacaCookie(h.get('cookie'), COOKIE_INGAT);
    let hapusIngat = false;

    // SessionGuard::user → userFromRecaller → updateSession (rotasi id + token, tanpa audit).
    if (sesi && !pengguna && typeof cookieIngat === 'string' && cookieIngat !== '') {
        const p = await penggunaDariIngat(cookieIngat);
        if (p) {
            await rotasiSesi(sesi, false);
            sesi.userId = p.id;
            pengguna = p;
            ubah = true;
        }
    }

    let keputusan: Keputusan = { jenis: 'lanjut' };
    if (sesi && pengguna) {
        const sidik = periksaSidik(sesi, pengguna.password);
        if (sidik === 'simpan') {
            sesi.sidikSandi = sidikSandi(pengguna.password);
            ubah = true;
        } else if (sidik === 'beda') {
            // AuthenticateSession::logout: logoutCurrentDevice (tanpa ganti remember_token) + session()->flush(),
            // lalu AuthenticationException (JSON 401 / redirect()->guest ke /masuk).
            sesi.userId = null;
            sesi.sidikSandi = null;
            sesi.data = {};
            sesi.csrf = tokenAcak();
            pengguna = null;
            hapusIngat = cookieIngat !== null;
            ubah = true;
            keputusan = wajibMasuk(ctx, null);
        }
    }
    if (keputusan.jenis === 'lanjut') keputusan = jalankanGuard(ctx, pengguna, langkahRute(ctx.metode, ctx.path));

    if (keputusan.jenis !== 'lanjut' && sesi) {
        if ('keluarkan' in keputusan && keputusan.keluarkan && pengguna) {
            // EnsureRole::deactivated: audit, Auth::guard('web')->logout(), invalidate(), regenerateToken().
            await catatAudit({
                aksi: 'auth.blocked_inactive',
                pelaku: pengguna,
                subjekPengguna: pengguna,
                deskripsi: 'Akses akun nonaktif ditolak.',
                ...meta,
            });
            await keluarkan(sesi, pengguna, meta, false);
            hapusIngat = cookieIngat !== null;
            ubah = true;
        }
        if (keputusan.jenis === 'redirect') {
            if (keputusan.intended !== undefined) sesi.data['url.intended'] = jalurAman(keputusan.intended, asal) ?? '/';
            for (const [kunci, nilai] of Object.entries(keputusan.kilat ?? {})) kilatkan(sesi.data, kunci, nilai);
            ubah ||= keputusan.intended !== undefined || keputusan.kilat !== undefined;
        }
    }

    if (sesi && (ubah || !sesi.ada)) await simpanSesi(sesi, meta);
    else if (sesi) await sentuhSesi(sesi);

    const teruskanSesi = sesi?.id ?? null;
    headerTeruskan.set(
        'cookie',
        gantiCookie(
            gantiCookie(h.get('cookie'), COOKIE_SESI, teruskanSesi),
            COOKIE_INGAT,
            hapusIngat ? null : typeof cookieIngat === 'string' ? cookieIngat : null,
        ),
    );
    const res = keputusan.jenis === 'lanjut' ? NextResponse.next({ request: { headers: headerTeruskan } }) : keRespons(keputusan, ctx, asal);
    // Cookie diperbarui di setiap respons halaman (Max-Age idle) dan setiap kali id/token berganti.
    if (sesi && (baca || sesi.id !== idAwal || sesi.csrf !== csrfAwal)) pasangCookieSesi(res, sesi.id, sesi.csrf);
    if (hapusIngat) pasangCookieIngat(res, null);
    return res;
}
