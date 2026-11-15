import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { bacaKunci } from '@/server/legacy/laravel-crypt';
import { DesimalPhp, ObjekPhp, type NilaiPhp } from '@/server/legacy/php-serial';

// Vektor dari `php artisan cc:ekspor-fixture-kripto` (kunci uji, bukan kunci produksi).
export const DIR_SIGAP = fileURLToPath(new URL('../../../../sigap/', import.meta.url));
const DIR_FIXTURE = fileURLToPath(new URL('../../../../parity/fixtures/kripto/', import.meta.url));

export type Galat = { kelas: string; pesan: string } | null;
type Kunci = { app_key: string; app_previous_keys: string };

export type FixtureEnkripsi = Kunci & {
    kasus: { label: string; kunci: string; plaintext: string; payload: string }[];
    negatif: { label: string; payload: string; galat: Galat; plaintext: string | null }[];
};
export type FixtureNik = {
    kunci_nik: Record<string, string>;
    kasus: { nik: string | null; hash: Record<string, string | null>; mask: string | null; mirip_nik: boolean | null }[];
};
export type FixtureSandi = {
    app_key: string;
    galat_make_nul: Galat;
    kasus: { sandi: string; hash: string; perlu_rehash: boolean; cek: { sandi: string; hasil: boolean }[]; password_hash_web: string }[];
    negatif: { label: string; hash: string; galat: Galat; hasil: boolean | null }[];
};
export type FixtureSerial = { kasus: { label: string; serial: string; json: unknown }[]; int_di_luar_batas_js: string };
export type FixtureCookie = Kunci & {
    nama_remember: string;
    kasus: { nama: string; nilai: string; terenkripsi: string; set_cookie: string; prefix: string; hasil_dekripsi: string | null }[];
    negatif: { label: string; nama: string; terenkripsi: string; hasil_dekripsi: string | null }[];
    header_xsrf: { label: string; header: string; token: string }[];
    pengguna: { id: number; password: string; remember_token: string | null }[];
    remember: { label: string; nilai: string; terenkripsi: string; user_id: number | null }[];
};
export type KasusSesi = {
    label: string;
    cookie: string;
    baris: { id: string; user_id: number | null; payload: string; last_activity: number };
    serial: string;
    data: unknown;
    user_hash: string | null;
    harapan: { user_id: number | null; password_hash: string | null };
    harapan_kosong?: boolean;
};
export type FixtureSesi = Kunci & {
    cookie_sesi: string;
    lifetime_menit: number;
    serialization: string;
    sekarang: number;
    kunci_login: string;
    kasus: KasusSesi[];
    password_hash_web: { user_hash: string; tersimpan: string; cocok: boolean }[];
};

export function fixture<T>(nama: string): T {
    return JSON.parse(readFileSync(DIR_FIXTURE + nama, 'utf8')) as T;
}

export function kunciUji(f: Kunci) {
    return bacaKunci(f.app_key, f.app_previous_keys);
}

/**
 * Bentuk json_encode PHP (daftar 0..n-1 → array, selain itu objek) untuk membandingkan dengan fixture;
 * objek PHP menjadi penanda `{__objek: kelas}` seperti jsonable() di cc:ekspor-fixture-kripto.
 * Hanya untuk test: kunci data sesi bisa bernama `__proto__`.
 */
export function keJson(nilai: NilaiPhp): unknown {
    if (nilai instanceof DesimalPhp) return nilai.nilai;
    if (nilai instanceof ObjekPhp) return { __objek: nilai.kelas };
    if (!(nilai instanceof Map)) return nilai;
    const kunci = [...nilai.keys()];
    if (kunci.every((k, i) => k === i)) return [...nilai.values()].map(keJson);
    return Object.fromEntries([...nilai].map(([k, v]) => [String(k), keJson(v)]));
}
