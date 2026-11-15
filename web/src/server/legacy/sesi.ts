import 'server-only';

import { createHmac } from 'node:crypto';

import { bacaCookie, dekripsiCookie } from './cookie';
import { dekripsiByte, enkripsiByte, GalatDekripsi, samaWaktuTetap, type KunciLaravel } from './laravel-crypt';
import { GalatSerial, kunciPhp, serialize, unserialize, type ArrayPhp, type NilaiPhp } from './php-serial';

// Jembatan sesi Laravel (driver database, SESSION_ENCRYPT=true, serialization php):
// Illuminate\Session\{Store,EncryptedStore,DatabaseSessionHandler}, Auth\SessionGuard, Middleware\AuthenticateSession.

export const NAMA_COOKIE_SESI = 'sigap_session';

/** SESSION_LIFETIME dalam menit seperti config/session.php (bawaan 120); bukan angka → galat, bukan diam-diam 120. */
export function umurSesiMenit(nilai = process.env.SESSION_LIFETIME): number {
    // shortcut: dibaca langsung dari process.env; pindah ke skema env.ts (paket A) saat lapisan DB sesi dibuat.
    const t = nilai?.trim() ?? '';
    if (t === '') return 120;
    if (!/^\d+$/.test(t)) throw new Error('SESSION_LIFETIME tidak sah');
    return Number(t);
}
/** SessionGuard::getName(): 'login_web_' . sha1(Illuminate\Auth\SessionGuard::class). */
export const KUNCI_LOGIN = 'login_web_59ba36addc2b2f9401580f014c7f58ea4e30989d';
export const KUNCI_HASH_SANDI = 'password_hash_web';

/** Baris tabel `sessions` yang dibutuhkan; lapisan DB menyusul. */
export type BarisSesi = { id: string; payload: string; last_activity: number };

export type SesiLaravel = {
    id: string;
    data: ArrayPhp;
    userId: number | null;
    /** Isi `password_hash_web`: HMAC hash sandi (format kini) atau hash bcrypt mentah (format lama). */
    passwordHash: string | null;
    /**
     * Baris `sessions` ada saat dibaca (termasuk yang kedaluwarsa), = DatabaseSessionHandler::$exists.
     * Penyimpan WAJIB: ada → `UPDATE … WHERE id` saja (baris yang dihapus logout Laravel tetap terhapus);
     * tidak ada → `INSERT … ON CONFLICT (id) DO UPDATE` (performInsert yang jatuh ke update).
     */
    ada: boolean;
};

/** Sesi memuat data yang tidak bisa dibaca TS (objek di luar daftar izin, referensi, int 64-bit, terlalu besar). Jangan tulis balik sesi ini. */
export class GalatSesiTakDidukung extends Error {
    override name = 'GalatSesiTakDidukung';
}

const detikSekarang = () => Math.floor(Date.now() / 1000);

/** Store::isValidId: 40 karakter alfanumerik. */
const ID_SAH = /^[A-Za-z0-9]{40}$/;

/** Data sesi dari payload; GalatDekripsi / serial rusak → [] (EncryptedStore & Store::readFromHandler). */
function dekodePayload(payload: string, k: KunciLaravel): ArrayPhp {
    try {
        // Isi terenkripsi = serialize(string serialize($attributes)) karena EncryptedStore memakai encrypt() ber-serialize.
        const luar = unserialize(dekripsiByte(Buffer.from(payload, 'base64').toString('latin1'), k));
        if (typeof luar !== 'string') return new Map();
        const data = unserialize(luar);
        return data instanceof Map ? data : new Map();
    } catch (e) {
        if (e instanceof GalatDekripsi || (e instanceof GalatSerial && e.jenis === 'rusak')) return new Map();
        // Laravel dapat membaca data ini (objek, int 64-bit, ukuran besar); mengosongkannya akan menghapus sesi pengguna.
        if (e instanceof GalatSerial) throw new GalatSesiTakDidukung(e.message);
        throw e;
    }
}

function userIdDari(data: ArrayPhp): number | null {
    const v = data.get(KUNCI_LOGIN);
    if (typeof v === 'number') return v;
    return typeof v === 'string' && /^[1-9]\d*$/.test(v) && Number.isSafeInteger(Number(v)) ? Number(v) : null;
}

/**
 * Baca sesi Laravel dari header Cookie. null = tidak ada id sesi sah (Laravel membuat sesi baru).
 * Id sah tetapi baris tidak ada/kedaluwarsa/tidak terbaca → data kosong dengan id yang sama, seperti Laravel.
 */
export async function bacaSesi(opsi: {
    cookieHeader: string | null | undefined;
    kunci: KunciLaravel;
    muat: (id: string) => Promise<BarisSesi | null>;
    sekarang?: number;
    umurMenit?: number;
}): Promise<SesiLaravel | null> {
    const nilai = bacaCookie(opsi.cookieHeader, NAMA_COOKIE_SESI);
    const id = nilai === null ? null : dekripsiCookie(NAMA_COOKIE_SESI, nilai, opsi.kunci);
    if (id === null || !ID_SAH.test(id)) return null;

    const baris = await opsi.muat(id);
    const batas = (opsi.sekarang ?? detikSekarang()) - (opsi.umurMenit ?? umurSesiMenit()) * 60;
    // DatabaseSessionHandler::expired memakai "<": tepat di batas masih berlaku.
    const data = baris && baris.last_activity >= batas ? dekodePayload(baris.payload, opsi.kunci) : new Map();
    return hasilSesi(id, data, baris !== null);
}

function hasilSesi(id: string, data: ArrayPhp, ada: boolean): SesiLaravel {
    const hash = data.get(KUNCI_HASH_SANDI);
    return { id, data, userId: userIdDari(data), passwordHash: typeof hash === 'string' ? hash : null, ada };
}

/** SessionGuard::hashPasswordForCookie: HMAC-SHA256 dengan APP_KEY MENTAH (string "base64:…", tidak di-decode). */
export function hashSandiUntukSesi(hashSandiUser: string, k: KunciLaravel): string {
    return createHmac('sha256', k.mentah).update(hashSandiUser).digest('hex');
}

/**
 * AuthenticateSession::handle untuk sesi web (tanpa remember-me):
 * 'kosong' → Laravel menerima lalu menyimpan hash; 'beda' → logout; 'cocok' → lanjut.
 * users.password kosong ('' / '0' / null) → 'cocok': Laravel melewati cek sepenuhnya (baris 47).
 */
export function cekHashSandi(tersimpan: string | null, hashSandiUser: string | null, k: KunciLaravel): 'cocok' | 'kosong' | 'beda' {
    if (!hashSandiUser || hashSandiUser === '0') return 'cocok';
    if (tersimpan === null) return 'kosong';
    // validatePasswordHash: format HMAC lebih dulu, lalu hash mentah (kompatibilitas mundur).
    return samaWaktuTetap(hashSandiUntukSesi(hashSandiUser, k), tersimpan) || samaWaktuTetap(hashSandiUser, tersimpan) ? 'cocok' : 'beda';
}

export type PerubahanSesi = {
    simpan?: Record<string, NilaiPhp>;
    hapus?: string[];
    /** Store::flash: terbaca di request berikutnya (Laravel maupun Next.js) lalu dibuang. */
    flash?: Record<string, NilaiPhp>;
};

function salinArray(a: ArrayPhp): ArrayPhp {
    return new Map([...a].map(([k, v]) => [k, v instanceof Map ? salinArray(v) : v]));
}

function daftarFlash(data: ArrayPhp, jenis: 'old' | 'new'): ArrayPhp {
    const f = data.get('_flash');
    const d = f instanceof Map ? f.get(jenis) : undefined;
    return d instanceof Map ? d : new Map();
}

/** Arr::set($data, "_flash.$jenis", $nilai). */
function aturFlash(data: ArrayPhp, jenis: 'old' | 'new', nilai: ArrayPhp) {
    let f = data.get('_flash');
    if (!(f instanceof Map)) {
        f = new Map();
        data.set('_flash', f);
    }
    f.set(jenis, nilai);
}

function cekKunci(kunci: string) {
    // Store::put memakai notasi titik (Arr::set); kunci bertitik akan bersarang di Laravel.
    if (kunci.includes('.')) throw new Error(`Kunci sesi bertitik tidak didukung: ${kunci}`);
    // `errors` harus ViewErrorBag (objek PHP); belum ada penulis resminya di TS.
    if (kunci === 'errors') throw new Error('Kunci sesi errors belum didukung');
}

/**
 * Terapkan perubahan seperti satu request Laravel lalu Store::save(): put/forget, flash(), ageFlashData(),
 * kemudian payload = base64(encrypt(serialize(serialize($data)))) seperti EncryptedStore + DatabaseSessionHandler.
 */
export function perbaruiKunci(sesiData: ArrayPhp, perubahan: PerubahanSesi, k: KunciLaravel): { data: ArrayPhp; payload: string } {
    const data = salinArray(sesiData);
    // kunciPhp: "5" dan 5 adalah kunci yang sama di array PHP.
    for (const kunci of perubahan.hapus ?? []) {
        cekKunci(kunci);
        data.delete(kunciPhp(kunci));
    }
    for (const [kunci, nilai] of Object.entries(perubahan.simpan ?? {})) {
        cekKunci(kunci);
        data.set(kunciPhp(kunci), nilai);
    }
    for (const [kunci, nilai] of Object.entries(perubahan.flash ?? {})) {
        cekKunci(kunci);
        data.set(kunciPhp(kunci), nilai);
        // push('_flash.new', $key): $array[] = $key → indeks int berikutnya.
        const baru = daftarFlash(data, 'new');
        const indeks = [...baru.keys()].filter((x): x is number => typeof x === 'number');
        baru.set(indeks.length ? Math.max(...indeks) + 1 : 0, kunci);
        aturFlash(data, 'new', baru);
        // removeFromOldFlashData: array_diff mempertahankan indeks lama.
        aturFlash(data, 'old', new Map([...daftarFlash(data, 'old')].filter(([, v]) => v !== kunci)));
    }

    // ageFlashData: buang flash lama, flash baru menjadi lama.
    // shortcut: forget hanya kunci tingkat atas (Arr::forget juga menelusuri notasi titik); flash aplikasi selalu tingkat atas.
    for (const kunci of daftarFlash(data, 'old').values()) if (typeof kunci === 'string') data.delete(kunciPhp(kunci));
    aturFlash(data, 'old', daftarFlash(data, 'new'));
    aturFlash(data, 'new', new Map());

    const payload = Buffer.from(enkripsiByte(Buffer.from(serialize(serialize(data)), 'utf8'), k), 'latin1').toString('base64');
    return { data, payload };
}

/**
 * Simpan sesi seperti DatabaseSessionHandler::write; ip_address & user_agent diisi lapisan DB.
 * `ada` menentukan perintah SQL penyimpan (lihat SesiLaravel.ada); setelah tersimpan baris dianggap ada.
 */
export async function simpanSesi(opsi: {
    sesi: SesiLaravel;
    perubahan: PerubahanSesi;
    kunci: KunciLaravel;
    simpan: (baris: BarisSesi & { user_id: number | null; ada: boolean }) => Promise<void>;
    sekarang?: number;
}): Promise<SesiLaravel> {
    const { data, payload } = perbaruiKunci(opsi.sesi.data, opsi.perubahan, opsi.kunci);
    const hasil = hasilSesi(opsi.sesi.id, data, true);
    await opsi.simpan({ id: hasil.id, payload, last_activity: opsi.sekarang ?? detikSekarang(), user_id: hasil.userId, ada: opsi.sesi.ada });
    return hasil;
}
