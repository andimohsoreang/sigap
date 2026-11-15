import 'server-only';

import { bacaCookie, dekripsiCookie } from './cookie';
import { samaWaktuTetap, type KunciLaravel } from './laravel-crypt';
import { trimPhp } from './nik';
import { DesimalPhp, GalatSerial, unserialize, type NilaiPhp } from './php-serial';
import { hashSandiUntukSesi } from './sesi';

// Sisi baca cookie remember-me: Illuminate\Auth\Recaller + SessionGuard::userFromRecaller (SessionGuard.php:215-239).
// Menulis cookie remember tetap di Laravel.

/** SessionGuard::getRecallerName(): 'remember_web_' . sha1(Illuminate\Auth\SessionGuard::class). */
export const NAMA_COOKIE_REMEMBER = 'remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d';

export type Recaller = { id: string; token: string; hash: string };

/** Kolom users yang dibutuhkan; `password` = getAuthPassword(). */
export type PenggunaRecaller = { remember_token: string | null; password: string };

/** Kebenaran nilai PHP untuk operator `?:`. */
function benarPhp(v: NilaiPhp): boolean {
    if (v instanceof Map) return v.size > 0;
    if (v instanceof DesimalPhp) return v.nilai !== 0;
    return v !== null && v !== false && v !== 0 && v !== '' && v !== '0';
}

/** Recaller::__construct (`@unserialize(…) ?: $recaller`) + valid(); null bila tidak sah. */
export function parseRecaller(nilai: string): Recaller | null {
    let r: NilaiPhp = nilai;
    try {
        const u = unserialize(nilai);
        if (benarPhp(u)) r = u;
    } catch (e) {
        // unserialize PHP gagal → false → string mentah dipakai; tipe lain (objek, referensi) bukan string → tidak sah.
        if (!(e instanceof GalatSerial) || e.jenis !== 'rusak') return null;
    }
    if (typeof r !== 'string' || !r.includes('|')) return null;
    const s = r.split('|');
    if (s.length < 3 || trimPhp(s[0]) === '' || trimPhp(s[1]) === '') return null;
    return { id: s[0], token: s[1], hash: s[2] };
}

/**
 * Login dari cookie remember-me, dipakai hanya bila sesi tidak membawa user (SessionGuard::user()).
 * `muat` mencari users berdasarkan id dari cookie: id bukan angka harus dianggap tidak ada (bukan galat SQL).
 * Hasil null = tidak login; bila ada, pemanggil memperlakukannya seperti Laravel (updateSession + viaRemember).
 */
export async function bacaRecaller(opsi: {
    cookieHeader: string | null | undefined;
    kunci: KunciLaravel;
    muat: (id: string) => Promise<PenggunaRecaller | null>;
}): Promise<Recaller | null> {
    const nilai = bacaCookie(opsi.cookieHeader, NAMA_COOKIE_REMEMBER);
    const isi = nilai === null ? null : dekripsiCookie(NAMA_COOKIE_REMEMBER, nilai, opsi.kunci);
    const r = isi ? parseRecaller(isi) : null;
    if (!r) return null;

    const user = await opsi.muat(r.id);
    // EloquentUserProvider::retrieveByToken: token kosong di DB tidak pernah cocok.
    if (!user?.remember_token || !samaWaktuTetap(user.remember_token, r.token)) return null;
    const cocok = samaWaktuTetap(hashSandiUntukSesi(user.password, opsi.kunci), r.hash) || samaWaktuTetap(user.password, r.hash);
    return cocok ? r : null;
}
