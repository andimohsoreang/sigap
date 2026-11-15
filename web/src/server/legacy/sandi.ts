import 'server-only';

import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';

// Padanan Illuminate\Hashing\BcryptHasher dengan konfigurasi produksi: BCRYPT_ROUNDS=12, HASH_VERIFY=true (bawaan).
// bcrypt cost 12 ±0,4 dtk CPU per operasi → dijalankan di pool worker_threads, bukan di event loop.

export const BIAYA_BCRYPT = 12;

// password_get_info() PHP hanya mengenali `$2y$` (60 karakter) sebagai bcrypt; `$2a$`/`$2b$` dianggap "unknown".
const BCRYPT_2Y = /^\$2y\$\d{2}\$[./A-Za-z0-9]{53}$/;

type Pekerja = { w: Worker; tugas: Map<number, { ok: (v: boolean | string) => void; gagal: (e: Error) => void }> };
const UKURAN_POOL = Math.max(1, availableParallelism() - 1);
const pool: Pekerja[] = [];
let nomor = 0;

function buatPekerja(): Pekerja {
    const p: Pekerja = { w: new Worker(new URL('./sandi-pekerja.mjs', import.meta.url)), tugas: new Map() };
    p.w.on('message', ({ id, hasil, galat }: { id: number; hasil?: boolean | string; galat?: string }) => {
        const t = p.tugas.get(id);
        p.tugas.delete(id);
        if (p.tugas.size === 0) p.w.unref(); // worker menganggur tidak menahan proses tetap hidup
        if (galat === undefined) t?.ok(hasil!);
        else t?.gagal(new Error(galat));
    });
    const mati = (e: Error) => {
        if (pool.includes(p)) pool.splice(pool.indexOf(p), 1);
        for (const t of p.tugas.values()) t.gagal(e);
        p.tugas.clear();
    };
    p.w.on('error', mati);
    p.w.on('exit', (kode) => mati(new Error(`Worker bcrypt berhenti (kode ${kode})`)));
    pool.push(p);
    return p;
}

function jalankan<T extends boolean | string>(pesan: { sandi: string; hash?: string; biaya?: number }): Promise<T> {
    // Worker dengan antrean terpendek; tambah worker selama pool belum penuh.
    const sibuk = pool.reduce<Pekerja | undefined>((a, b) => (!a || b.tugas.size < a.tugas.size ? b : a), undefined);
    const p = sibuk && (sibuk.tugas.size === 0 || pool.length >= UKURAN_POOL) ? sibuk : buatPekerja();
    const id = ++nomor;
    return new Promise<T>((ok, gagal) => {
        p.tugas.set(id, { ok: ok as (v: boolean | string) => void, gagal });
        p.w.ref();
        p.w.postMessage({ id, ...pesan });
    });
}

/** Hentikan semua worker (shutdown); pool dibuat ulang bila dipakai lagi. */
export async function tutupPoolSandi(): Promise<void> {
    await Promise.all(pool.splice(0).map((p) => p.w.terminate()));
}

/**
 * Hash::check: hash kosong → false; bukan `$2y$` → galat seperti Laravel (verify=true).
 * Cost di luar 04–31 → false seperti password_verify. NUL di sandi → false (lebih ketat dari PHP, yang memotong
 * sandi di NUL sehingga "a\0b" cocok dengan hash "a"; Hash::make PHP 8.4 tidak pernah menyimpan sandi ber-NUL).
 */
export async function verifikasiSandi(sandi: string, hash: string | null | undefined): Promise<boolean> {
    if (!hash) return false;
    if (!BCRYPT_2Y.test(hash)) throw new Error('This password does not use the Bcrypt algorithm.');
    const biaya = Number(hash.slice(4, 6));
    if (sandi.includes('\0') || biaya < 4 || biaya > 31) return false;
    return jalankan<boolean>({ sandi, hash });
}

/** Hash::make: `$2y$12$…`; awalan `$2b$` bawaan bcryptjs akan ditolak Hash::check Laravel. */
export async function hashSandi(sandi: string): Promise<string> {
    // password_hash PHP 8.4 menolak NUL; Laravel membungkusnya menjadi RuntimeException ini.
    if (sandi.includes('\0')) throw new Error('Bcrypt hashing not supported.');
    return jalankan<string>({ sandi, biaya: BIAYA_BCRYPT });
}
