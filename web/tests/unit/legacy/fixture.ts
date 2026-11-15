import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { bacaKunci } from '@/server/legacy/laravel-crypt';

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
    galat_make_nul: Galat;
    kasus: { sandi: string; hash: string; perlu_rehash: boolean; cek: { sandi: string; hasil: boolean }[] }[];
    negatif: { label: string; hash: string; galat: Galat; hasil: boolean | null }[];
};
export function fixture<T>(nama: string): T {
    return JSON.parse(readFileSync(DIR_FIXTURE + nama, 'utf8')) as T;
}

export function kunciUji(f: Kunci) {
    return bacaKunci(f.app_key, f.app_previous_keys);
}
