import 'server-only';

import { createHash, createHmac, randomBytes } from 'node:crypto';

import { and, eq, gt, lt, sql } from 'drizzle-orm';

import { db, type Db } from '@/server/db/client';
import { ccSessions } from '@/server/db/schema-cc';
import { env } from '@/server/env';
import { bacaKunci, dekripsi, enkripsi, samaWaktuTetap, type KunciLaravel } from '@/server/legacy/laravel-crypt';

import type { DataSesi } from './kilat';

// Penyimpanan sesi cc_session di PostgreSQL (rencana §9.4), padanan DatabaseSessionHandler + Session\Store Laravel:
// - idle-based: baris dengan last_activity lebih tua dari SESSION_LIFETIME menit dianggap tidak ada;
// - tulis-balik HANYA UPDATE untuk baris yang ada saat dibaca (DatabaseSessionHandler::write → performUpdate bila
//   $exists). Baris yang dihapus logout serentak tidak pernah dibuat ulang (temuan audit NV-1);
// - id mentah hanya di cookie; tabel menyimpan sha256-nya.

/** Sesi yang sedang diproses satu permintaan. Diubah di tempat lalu disimpan dengan simpanSesi(). */
export interface Sesi {
    /** Id mentah (nilai cookie). */
    id: string;
    /** Baris sudah ada di DB (dibaca atau sudah di-INSERT). false → simpanSesi melakukan INSERT. */
    ada: boolean;
    userId: number | null;
    csrf: string;
    /** HMAC hash sandi saat login (password_hash_web). */
    sidikSandi: string | null;
    data: DataSesi;
    /** last_activity saat dibaca (null untuk sesi baru). */
    terakhirAktif: Date | null;
}

export interface MetaPermintaan {
    ip: string;
    userAgent: string | null;
}

const POLA_ID = /^[A-Za-z0-9_-]{43}$/;
/** Sentuhan last_activity paling sering sekali per menit: idle 120 mnt ±1 mnt, tanpa UPDATE di setiap permintaan. */
const JEDA_SENTUH_DETIK = 60;

/** 32 byte acak (base64url, 43 karakter); Laravel memakai Str::random(40). */
export const idAcak = () => randomBytes(32).toString('base64url');
/** Token CSRF 40 karakter seperti Str::random(40). */
export const tokenAcak = () => randomBytes(30).toString('base64url');
/** Id sesi internal (kunci baris cc_sessions): sha256 hex id cookie. */
export const hashId = (id: string) => createHash('sha256').update(id).digest('hex');
const batasIdle = () => sql`now() - make_interval(mins => ${env.SESSION_LIFETIME})`;

function dataSah(x: unknown): x is DataSesi {
    return typeof x === 'object' && x !== null && !Array.isArray(x);
}

let kunci: KunciLaravel | undefined;
function kunciSesi(): KunciLaravel {
    if (!env.APP_KEY) throw new Error('APP_KEY belum diatur (data sesi dienkripsi).');
    return (kunci ??= bacaKunci(env.APP_KEY, env.APP_PREVIOUS_KEYS));
}

/** Data sesi terenkripsi (Encrypter Laravel, APP_KEY + APP_PREVIOUS_KEYS); rusak/salah kunci → null. */
function bukaData(payload: string): DataSesi | null {
    try {
        const x: unknown = JSON.parse(dekripsi(payload, kunciSesi()));
        return dataSah(x) ? x : null;
    } catch {
        return null;
    }
}

/**
 * Baca sesi dari id cookie. Id salah format, baris tidak ada/kedaluwarsa, atau isi rusak → null (tanpa sesi,
 * pemanggil membuat sesi baru) — tidak pernah melempar galat ke halaman karena isi sesi.
 */
export async function muatSesi(id: string | null | undefined, d: Db = db): Promise<Sesi | null> {
    if (!id || !POLA_ID.test(id)) return null;
    const [r] = await d
        .select()
        .from(ccSessions)
        .where(and(eq(ccSessions.id, hashId(id)), gt(ccSessions.lastActivity, batasIdle())));
    if (!r || typeof r.csrfToken !== 'string' || r.csrfToken === '') return null;
    if (r.userId !== null && !Number.isSafeInteger(r.userId)) return null;
    const data = bukaData(r.data);
    if (!data) return null;
    return {
        id,
        ada: true,
        userId: r.userId,
        csrf: r.csrfToken,
        sidikSandi: r.passwordHashFingerprint,
        data,
        terakhirAktif: r.lastActivity,
    };
}

/** Sesi tamu baru (belum di DB; INSERT saat simpanSesi). */
export function sesiBaru(): Sesi {
    return { id: idAcak(), ada: false, userId: null, csrf: tokenAcak(), sidikSandi: null, data: {}, terakhirAktif: null };
}

/**
 * Simpan sesi. Baris lama → UPDATE saja; bila baris sudah dihapus (logout/rotasi serentak) tidak dibuat ulang dan
 * hasilnya false. Sesi baru → INSERT.
 */
export async function simpanSesi(s: Sesi, meta: MetaPermintaan, d: Db = db): Promise<boolean> {
    const nilai = {
        userId: s.userId,
        csrfToken: s.csrf,
        passwordHashFingerprint: s.sidikSandi,
        data: enkripsi(JSON.stringify(s.data), kunciSesi()),
        ipAddress: meta.ip,
        // DatabaseSessionHandler: substr(userAgent, 0, 500).
        userAgent: meta.userAgent === null ? null : meta.userAgent.slice(0, 500),
        lastActivity: sql`now()`,
    };
    if (s.ada) {
        const r = await d
            .update(ccSessions)
            .set(nilai)
            .where(eq(ccSessions.id, hashId(s.id)));
        return (r.rowCount ?? 0) > 0;
    }
    await d.insert(ccSessions).values({ id: hashId(s.id), ...nilai });
    s.ada = true;
    return true;
}

/** Perbarui last_activity bila sudah lewat JEDA_SENTUH_DETIK (UPDATE saja). */
export async function sentuhSesi(s: Sesi, d: Db = db): Promise<void> {
    if (!s.ada || (s.terakhirAktif && Date.now() - s.terakhirAktif.getTime() < JEDA_SENTUH_DETIK * 1000)) return;
    await d
        .update(ccSessions)
        .set({ lastActivity: sql`now()` })
        .where(and(eq(ccSessions.id, hashId(s.id)), lt(ccSessions.lastActivity, sql`now() - make_interval(secs => ${JEDA_SENTUH_DETIK})`)));
}

/**
 * `$session->regenerate(true)` (kosongkan=false) atau `invalidate()` + `regenerateToken()` (kosongkan=true): baris
 * lama dihapus, id & token CSRF baru; INSERT terjadi saat simpanSesi.
 */
export async function rotasiSesi(s: Sesi, kosongkan: boolean, d: Db = db): Promise<void> {
    if (s.ada) await d.delete(ccSessions).where(eq(ccSessions.id, hashId(s.id)));
    s.id = idAcak();
    s.csrf = tokenAcak();
    s.ada = false;
    s.terakhirAktif = null;
    if (kosongkan) {
        s.userId = null;
        s.sidikSandi = null;
        s.data = {};
    }
}

/** Hapus semua sesi pengguna kecuali satu (mis. setelah ganti sandi, bila pemanggil ingin langsung membersihkan). */
export async function hapusSesiPengguna(userId: number, kecuali: Sesi | null, d: Db = db): Promise<number> {
    const kondisi = kecuali ? and(eq(ccSessions.userId, userId), sql`${ccSessions.id} <> ${hashId(kecuali.id)}`) : eq(ccSessions.userId, userId);
    const r = await d.delete(ccSessions).where(kondisi);
    return r.rowCount ?? 0;
}

/** Job worker cc-bersih: hapus sesi kedaluwarsa (padanan lottery GC DatabaseSessionHandler::gc). */
export async function bersihkanSesi(d: Db = db): Promise<number> {
    const r = await d.delete(ccSessions).where(lt(ccSessions.lastActivity, batasIdle()));
    return r.rowCount ?? 0;
}

/** SessionGuard::hashPasswordForCookie: HMAC-SHA256(hash sandi, APP_KEY). */
export function sidikSandi(hashSandi: string): string {
    return createHmac('sha256', env.APP_KEY ?? 'base-key-for-password-hash-mac')
        .update(hashSandi)
        .digest('hex');
}

/**
 * AuthenticateSession: sandi pengguna masih sama dengan saat sesi login?
 * - users.password kosong → selalu cocok (AuthenticateSession::handle baris 47 melewati pemeriksaan);
 * - sesi belum menyimpan sidik → 'simpan' (pemanggil menyimpan sidik sekarang, seperti storePasswordHashInSession);
 * - beda → 'beda' (pemanggil mengeluarkan sesi).
 */
export function periksaSidik(s: Sesi, passwordDb: string | null): 'cocok' | 'simpan' | 'beda' {
    if (!passwordDb) return 'cocok';
    if (s.sidikSandi === null) return 'simpan';
    return samaWaktuTetap(sidikSandi(passwordDb), s.sidikSandi) ? 'cocok' : 'beda';
}
