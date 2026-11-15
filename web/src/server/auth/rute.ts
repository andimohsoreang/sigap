import 'server-only';

import { and, eq } from 'drizzle-orm';
import type { NextRequest, NextResponse } from 'next/server';

import { batasi } from '@/server/batas/limiter';
import { pasangHeaderBatas } from '@/server/batas/respons';
import { db } from '@/server/db/client';
import { chatConversations } from '@/server/db/schema';
import { GalatSandiSibuk } from '@/server/legacy/sandi';
import { bolehKanal } from '@/server/realtime/kanal';
import { tandaTanganKanal } from '@/server/realtime/penerbit';
import { GalatBodyBesar, MAKS_BODY_KECIL, respons413 } from '@/server/web/batas-body';
import { tokenCocok, tokenDariPermintaan } from '@/server/web/csrf';
import { bacaInput, inputBoolean } from '@/server/web/input';
import { asalAplikasi, inginJson, ipKlien, jalurAman, responsJson } from '@/server/web/permintaan';
import { jsonLaravel, redirectLaravel, respons419, responsGalat } from '@/server/web/respons';

import { bacaCookie, COOKIE_INGAT, pasangCookieIngat, pasangCookieSesi } from './cookie';
import { wajibMasuk } from './guard';
import { kilatkan, reflash } from './kilat';
import { penggunaDariSesi, sesiDariHeader } from './konteks';
import { cobaMasuk, keluarkan, masukkan, tujuanSetelahMasuk } from './masuk';
import { adalahAdmin } from './peran';
import { ringkasGalat, validasiMasuk, type GalatValidasi } from './permintaan-masuk';
import { simpanSesi, type MetaPermintaan, type Sesi } from './sesi';
import { konteksGuard } from './tumpukan';

// Route handler auth: MasukController (store, destroy) dan BroadcastController::authenticate. Urutan pemeriksaan
// sama dengan pipeline Laravel: VerifyCsrfToken → middleware rute (guest/auth, throttle) → validasi → controller.

/** TrimStrings/handler `dontFlash`: tidak pernah masuk _old_input. */
const JANGAN_FLASH = ['current_password', 'password', 'password_confirmation'];

const tanpa = (input: Record<string, unknown>, kunci: string[]) => Object.fromEntries(Object.entries(input).filter(([k]) => !kunci.includes(k)));

function konteks(req: NextRequest) {
    const h = req.headers;
    const meta: MetaPermintaan = { ip: ipKlien(h), userAgent: h.get('user-agent') };
    return { h, asal: asalAplikasi(req.url), json: responsJson(req.nextUrl.pathname, h), meta };
}

/** `back()`: Referer situs sendiri, selain itu '/'. */
const kembali = (h: Headers, asal: string) => jalurAman(h.get('referer'), asal) ?? '/';

/** `->withErrors($galat)->withInput($input)` lalu redirect kembali. */
async function kembaliDenganGalat(
    sesi: Sesi,
    meta: MetaPermintaan,
    asal: string,
    h: Headers,
    galat: GalatValidasi,
    input: Record<string, unknown>,
    status: 302 | 303 = 302,
): Promise<NextResponse> {
    kilatkan(sesi.data, 'errors', galat);
    kilatkan(sesi.data, '_old_input', input);
    await simpanSesi(sesi, meta);
    return redirectLaravel(asal, kembali(h, asal), status);
}

/** POST /masuk. */
async function masuk(req: NextRequest): Promise<Response> {
    const { h, asal, json, meta } = konteks(req);
    const input = await bacaInput(req, MAKS_BODY_KECIL);
    const sesi = await sesiDariHeader(h);
    if (!sesi || !tokenCocok(sesi.csrf, tokenDariPermintaan(h, input))) return respons419(json);
    // guest (proxy.ts sudah memeriksa; diulang di sini sebagai pertahanan berlapis).
    if (await penggunaDariSesi(sesi)) return redirectLaravel(asal, '/');

    const batas = await batasi('login', { ip: meta.ip, identifier: input.identifier });
    if (!batas.lolos) {
        // bootstrap/app.php:93-105: formulir Inertia (non-GET) → 303 kembali dengan pesan validasi, bukan 429.
        if (h.get('x-inertia')) {
            const field = 'identifier' in input ? 'identifier' : 'throttle';
            const res = await kembaliDenganGalat(
                sesi,
                meta,
                asal,
                h,
                { [field]: [`Terlalu banyak percobaan. Silakan coba lagi dalam ${batas.retryAfter ?? 60} detik.`] },
                tanpa(input, ['password', 'password_confirmation', 'attachment', 'recaptcha_token']),
                303,
            );
            return pasangHeaderBatas(res, batas.header) as NextResponse;
        }
        return responsGalat(429, json, 'Too Many Attempts.', batas.header);
    }

    const valid = validasiMasuk(input);
    let res: NextResponse;
    if (!valid.ok) {
        // FormRequest::failedValidation → ValidationException: 422 JSON bila expectsJson, selain itu kembali.
        res = inginJson(h)
            ? jsonLaravel({ message: ringkasGalat(valid.galat), errors: valid.galat }, 422)
            : await kembaliDenganGalat(sesi, meta, asal, h, valid.galat, tanpa(input, JANGAN_FLASH));
        return pasangHeaderBatas(res, batas.header) as NextResponse;
    }

    let hasil;
    try {
        hasil = await cobaMasuk(valid.identifier, valid.password, meta);
    } catch (e) {
        // Antrean bcrypt penuh (tidak ada padanan Laravel; PHP-FPM mengantre): 503, klien boleh mencoba lagi.
        if (e instanceof GalatSandiSibuk) return responsGalat(503, json, undefined, { 'Retry-After': '1' });
        throw e;
    }

    if ('galat' in hasil) {
        // back()->withErrors($e->errors())->onlyInput('identifier')
        res = await kembaliDenganGalat(
            sesi,
            meta,
            asal,
            h,
            { identifier: [hasil.galat] },
            'identifier' in input ? { identifier: input.identifier } : {},
        );
        return pasangHeaderBatas(res, batas.header) as NextResponse;
    }

    const ingat = await masukkan(sesi, hasil.pengguna, inputBoolean(input, 'remember'));
    const tujuan = tujuanSetelahMasuk(sesi, adalahAdmin(hasil.pengguna));
    await simpanSesi(sesi, meta);
    res = redirectLaravel(asal, tujuan);
    pasangCookieSesi(res, sesi.id, sesi.csrf);
    if (ingat) pasangCookieIngat(res, ingat);
    return pasangHeaderBatas(res, batas.header) as NextResponse;
}

/** POST /keluar. */
async function keluar(req: NextRequest): Promise<Response> {
    const { h, asal, json, meta } = konteks(req);
    const input = await bacaInput(req, MAKS_BODY_KECIL);
    const sesi = await sesiDariHeader(h);
    if (!sesi || !tokenCocok(sesi.csrf, tokenDariPermintaan(h, input))) return respons419(json);
    const pengguna = await penggunaDariSesi(sesi);
    if (!pengguna) {
        // Middleware `auth` (biasanya sudah ditangani proxy.ts).
        const k = wajibMasuk(konteksGuard(req, asal), null);
        if (k.jenis === 'json') return jsonLaravel(k.body, k.status);
        if (k.jenis === 'redirect' && k.intended !== undefined) {
            sesi.data['url.intended'] = jalurAman(k.intended, asal) ?? '/';
            await simpanSesi(sesi, meta);
        }
        return redirectLaravel(asal, '/masuk');
    }
    await keluarkan(sesi, pengguna, meta, true);
    await simpanSesi(sesi, meta);
    const res = redirectLaravel(asal, '/');
    pasangCookieSesi(res, sesi.id, sesi.csrf);
    // clearUserDataFromStorage: cookie ingat dihapus bila permintaan membawanya.
    if (bacaCookie(h.get('cookie'), COOKIE_INGAT) !== null) pasangCookieIngat(res, null);
    return res;
}

/** channels.php:21 — ChatConversation where id & user_id exists. */
async function pemilikChat(conversationId: number, userId: number): Promise<boolean> {
    const [r] = await db
        .select({ id: chatConversations.id })
        .from(chatConversations)
        .where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)))
        .limit(1);
    return !!r;
}

/** Pusher::validate_channel. */
const KANAL_SAH = /^#?[-a-zA-Z0-9_=@,.;]+$/;

/** BroadcastController::authenticate → PusherBroadcaster::auth. */
async function izinKanal(req: NextRequest): Promise<Response> {
    const { h, json, meta } = konteks(req);
    const input = await bacaInput(req, MAKS_BODY_KECIL);
    const sesi = await sesiDariHeader(h);
    if (sesi && '_flash' in sesi.data) {
        reflash(sesi.data);
        await simpanSesi(sesi, meta);
    }
    const kanal = typeof input.channel_name === 'string' ? input.channel_name : '';
    const socketId = typeof input.socket_id === 'string' ? input.socket_id : '';
    const pengguna = await penggunaDariSesi(sesi);
    // AccessDeniedHttpException tanpa pesan → 403 "Forbidden".
    const izin = kanal !== '' && (await bolehKanal(kanal, pengguna ? { id: pengguna.id, admin: adalahAdmin(pengguna) } : null, pemilikChat));
    if (!izin) return responsGalat(403, json);
    // Pusher::authorizeChannel melempar PusherException (500) untuk nama kanal / socket_id yang tidak sah.
    if (!KANAL_SAH.test(kanal)) throw new Error('Invalid channel name');
    return jsonLaravel(tandaTanganKanal(socketId, kanal));
}

/** Body terlalu besar (GalatBodyBesar dari bacaInput) → 413 seperti nginx. */
const dengan413 =
    (fn: (req: NextRequest) => Promise<Response>) =>
    async (req: NextRequest): Promise<Response> => {
        try {
            return await fn(req);
        } catch (e) {
            if (e instanceof GalatBodyBesar) return respons413();
            throw e;
        }
    };

/** POST /masuk. */
export const prosesMasuk = dengan413(masuk);
/** POST /keluar. */
export const prosesKeluar = dengan413(keluar);
/** GET/POST /broadcasting/auth. */
export const prosesIzinKanal = dengan413(izinKanal);
