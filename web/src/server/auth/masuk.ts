import 'server-only';

import { createHmac, randomBytes } from 'node:crypto';
import { setTimeout as tidur } from 'node:timers/promises';

import { eq, sql } from 'drizzle-orm';

import { db, type Db } from '@/server/db/client';
import { hashNikApp } from '@/server/db/kolom';
import { users } from '@/server/db/schema';
import { env } from '@/server/env';
import { samaWaktuTetap } from '@/server/legacy/laravel-crypt';
import { maskNik, miripNik, trimPhp } from '@/server/legacy/nik';
import { verifikasiSandi } from '@/server/legacy/sandi';

import { catatAudit } from './audit';
import { tarik } from './kilat';
import { ambilPengguna, kolomPengguna } from './pengguna';
import type { Pengguna } from './peran';
import { rotasiSesi, sidikSandi, type MetaPermintaan, type Sesi } from './sesi';

// Login gabungan NIK/username: port sigap/app/Services/AuthService.php (attempt, logout, dummyCheck) dan bagian
// SessionGuard Laravel 12.69.3 yang dipakai (login, logout, recaller "Ingat saya").

export const PESAN_GAGAL_MASUK = 'NIK/username atau kata sandi salah.';

/**
 * Batas waktu minimum percobaan GAGAL (Illuminate\Support\Timebox, bawaan SessionGuard 200.000 µs; config
 * auth.timebox_duration tidak diatur). Catatan: AuthService Laravel memakai Auth::login (tanpa Timebox) + hash
 * tiruan; timebox di sini tambahan yang tak terlihat — bcrypt cost 12 sendiri sudah > 200 ms.
 */
export const TIMEBOX_MS = 200;

/** Hash `$2y$12$` tetap untuk akun yang tidak ada (AuthService::dummyCheck), biaya sama dengan hash asli. */
const HASH_TIRUAN = '$2y$12$GCyoOt1I9x6J/EA2eUP84OcKBPrLBhZ6Kt5qTjSzkweXkjehXUr0u';

export type HasilMasuk = { pengguna: Pengguna } | { galat: string };

/** mb_substr($s, 0, 50). */
const potong50 = (s: string) => Array.from(s).slice(0, 50).join('');

/**
 * AuthService::attempt: 16 digit → NIK (blind index nik_hash), selain itu username. Akun tidak ada → bcrypt
 * terhadap hash tiruan. Gagal (tidak ada / sandi salah / nonaktif) → pesan yang sama + audit auth.login_failed.
 * Galat antrean bcrypt (GalatSandiSibuk) diteruskan ke pemanggil.
 */
export async function cobaMasuk(identifierMentah: string, sandi: string, meta: MetaPermintaan, d: Db = db): Promise<HasilMasuk> {
    const mulai = Date.now();
    const identifier = trimPhp(identifierMentah);
    const lewatNik = miripNik(identifier);
    const [pengguna = null] = await d
        .select(kolomPengguna)
        .from(users)
        .where(lewatNik ? eq(users.nikHash, hashNikApp(identifier)!) : eq(users.username, identifier))
        .limit(1);

    let sah = false;
    if (pengguna) sah = await verifikasiSandi(sandi, pengguna.password);
    else await verifikasiSandi(sandi, HASH_TIRUAN);

    if (!pengguna || !sah || !pengguna.isActive) {
        await catatAudit(
            {
                aksi: 'auth.login_failed',
                pelaku: null,
                subjekPengguna: pengguna,
                deskripsi: 'Login gagal.',
                properti: {
                    identifier: lewatNik ? maskNik(identifier) : potong50(identifier),
                    reason: !pengguna ? 'not_found' : !sah ? 'bad_password' : 'inactive',
                },
                ...meta,
            },
            d,
        );
        const sisa = TIMEBOX_MS - (Date.now() - mulai);
        if (sisa > 0) await tidur(sisa);
        return { galat: PESAN_GAGAL_MASUK };
    }

    await catatAudit({ aksi: 'auth.login', pelaku: pengguna, subjekPengguna: pengguna, deskripsi: `Login berhasil: ${pengguna.name}.`, ...meta }, d);
    return { pengguna };
}

/** Str::random(60) untuk remember_token. */
const tokenIngat = () => randomBytes(45).toString('base64url');

/** EloquentUserProvider::updateRememberToken: tanpa menyentuh updated_at. */
async function gantiTokenIngat(p: Pengguna, d: Db): Promise<string> {
    const token = tokenIngat();
    // SQL mentah: update Drizzle selalu mengisi updated_at lewat $onUpdateFn.
    await d.execute(sql`UPDATE users SET remember_token = ${token} WHERE id = ${p.id}`);
    p.rememberToken = token;
    return token;
}

const macIngat = (isi: string) =>
    createHmac('sha256', env.APP_KEY ?? 'base-key-for-password-hash-mac')
        .update(`cc_ingat|${isi}`)
        .digest('base64url');

/**
 * SessionGuard::login: id pengguna & sidik sandi masuk sesi, id sesi + token CSRF dirotasi (updateSession +
 * regenerate di MasukController). `ingat` → token ingat dipastikan ada; mengembalikan nilai cookie cc_ingat.
 * Isi cookie `id|token|sidik|mac` (Laravel: `id|token|hash` terenkripsi APP_KEY); mac HMAC APP_KEY, jadi bocornya
 * remember_token dari DB saja tidak cukup untuk memalsukan cookie.
 */
export async function masukkan(s: Sesi, p: Pengguna, ingat: boolean, d: Db = db): Promise<string | null> {
    await rotasiSesi(s, false, d);
    s.userId = p.id;
    s.sidikSandi = p.password ? sidikSandi(p.password) : null;
    if (!ingat) return null;
    const token = p.rememberToken || (await gantiTokenIngat(p, d));
    const isi = `${p.id}|${token}|${sidikSandi(p.password)}`;
    return `${isi}|${macIngat(isi)}`;
}

/**
 * SessionGuard::user() lewat cookie ingat (userFromRecaller): mac sah, remember_token cocok, dan sidik sandi di
 * cookie sama dengan sandi sekarang. Lolos → pengguna; pemanggil lalu masuk tanpa audit (updateSession saja).
 */
export async function penggunaDariIngat(nilai: string | null, d: Db = db): Promise<Pengguna | null> {
    const bagian = nilai?.split('|');
    if (!bagian || bagian.length !== 4 || !/^\d{1,15}$/.test(bagian[0])) return null;
    const [id, token, sidik, mac] = bagian;
    if (!samaWaktuTetap(macIngat(`${id}|${token}|${sidik}`), mac)) return null;
    const p = await ambilPengguna(Number(id), d);
    if (!p?.rememberToken || !samaWaktuTetap(p.rememberToken, token)) return null;
    // hash_equals(hashPasswordForCookie($sandi), $hash) || hash_equals($sandi, $hash).
    return samaWaktuTetap(sidikSandi(p.password), sidik) || samaWaktuTetap(p.password, sidik) ? p : null;
}

/**
 * SessionGuard::logout + invalidate() + regenerateToken(): token ingat diganti bila ada (cookie ingat di perangkat
 * lain ikut mati), sesi dikosongkan dengan id & token baru. `audit` = lewat AuthService::logout (POST /keluar);
 * EnsureRole (akun nonaktif) memanggil guard langsung tanpa audit logout. Pemanggil menghapus cookie cc_ingat.
 */
export async function keluarkan(s: Sesi, p: Pengguna | null, meta: MetaPermintaan, audit: boolean, d: Db = db): Promise<void> {
    if (p) {
        if (audit) await catatAudit({ aksi: 'auth.logout', pelaku: p, subjekPengguna: p, deskripsi: `Logout: ${p.name}.`, ...meta }, d);
        if (p.rememberToken) await gantiTokenIngat(p, d);
    }
    await rotasiSesi(s, true, d);
}

/**
 * Tujuan setelah login: `redirect()->intended($bawaan)`; bawaan /admin (admin.dashboard) untuk admin, /portal-warga
 * untuk lainnya. url.intended disimpan sebagai path relatif (lihat guard.ts), jadi tidak bisa membawa ke host lain.
 */
export function tujuanSetelahMasuk(s: Sesi, admin: boolean): string {
    const intended = tarik(s.data, 'url.intended', null);
    if (typeof intended === 'string' && /^\/(?![/\\])/.test(intended) && !/[\x00-\x1f\x7f]/.test(intended)) return intended;
    return admin ? '/admin' : '/portal-warga';
}
