import 'server-only';

import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';

// Padanan Illuminate\Hashing\BcryptHasher dengan konfigurasi produksi: BCRYPT_ROUNDS=12, HASH_VERIFY=true (bawaan).
// bcrypt cost 12 ±0,4 dtk CPU per operasi → dijalankan di pool worker_threads, bukan di event loop.

export const BIAYA_BCRYPT = 12;
/** Batas pekerjaan bcrypt yang menunggu + berjalan per proses; lebih dari ini ditolak (pemanggil menjawab 429/503). */
export const MAKS_ANTREAN = 32;

// password_get_info() PHP hanya mengenali `$2y$` (60 karakter) sebagai bcrypt; `$2a$`/`$2b$` dianggap "unknown".
const BCRYPT_2Y = /^\$2y\$\d{2}\$[./A-Za-z0-9]{53}$/;

/** Antrean bcrypt penuh. */
export class GalatSandiSibuk extends Error {
    override name = 'GalatSandiSibuk';
}

/**
 * Jumlah worker: BCRYPT_POOL (bawaan 1), dibatasi [1, availableParallelism()-1].
 * Container web dibatasi `cpus: 1.5`; worker lebih banyak hanya memicu throttling CFS seluruh container.
 */
export function ukuranPool(nilai = process.env.BCRYPT_POOL): number {
    const n = Number.parseInt(nilai ?? '', 10);
    return Number.isNaN(n) ? 1 : Math.min(Math.max(n, 1), Math.max(1, availableParallelism() - 1));
}

type Pesan = { sandi: string; hash?: string; biaya?: number };
type Tugas = { pesan: Pesan; ok: (v: boolean | string) => void; gagal: (e: unknown) => void; signal?: AbortSignal };
type Pekerja = { w: Worker; tugas: Tugas | null };

const UKURAN_POOL = ukuranPool();
const pool: Pekerja[] = [];
const antrean: Tugas[] = [];

function buatPekerja(): Pekerja {
    const p: Pekerja = { w: new Worker(new URL('./sandi-pekerja.mjs', import.meta.url)), tugas: null };
    p.w.on('message', ({ hasil, galat }: { hasil?: boolean | string; galat?: string }) => {
        const t = p.tugas;
        p.tugas = null;
        p.w.unref(); // worker menganggur tidak menahan proses tetap hidup
        if (galat === undefined) t?.ok(hasil!);
        else t?.gagal(new Error(galat));
        jalankanBerikut();
    });
    const mati = (e: Error) => {
        if (pool.includes(p)) pool.splice(pool.indexOf(p), 1);
        p.tugas?.gagal(e);
        p.tugas = null;
        jalankanBerikut();
    };
    p.w.on('error', mati);
    p.w.on('exit', (kode) => mati(new Error(`Worker bcrypt berhenti (kode ${kode})`)));
    pool.push(p);
    return p;
}

/** Satu pekerjaan per worker; pekerjaan yang pemanggilnya sudah menyerah dibuang sebelum dijalankan. */
function jalankanBerikut() {
    while (antrean.length > 0) {
        const p = pool.find((x) => !x.tugas) ?? (pool.length < UKURAN_POOL ? buatPekerja() : undefined);
        if (!p) return;
        const t = antrean.shift()!;
        if (t.signal?.aborted) {
            t.gagal(t.signal.reason);
            continue;
        }
        p.tugas = t;
        p.w.ref();
        p.w.postMessage(t.pesan);
    }
}

function jalankan<T extends boolean | string>(pesan: Pesan, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(signal.reason);
    if (antrean.length + pool.filter((p) => p.tugas).length >= MAKS_ANTREAN) {
        return Promise.reject(new GalatSandiSibuk('Antrean bcrypt penuh'));
    }
    return new Promise<T>((ok, gagal) => {
        const t: Tugas = { pesan, ok: ok as (v: boolean | string) => void, gagal, signal };
        antrean.push(t);
        // Masih menunggu saat dibatalkan → keluar dari antrean seketika; yang sudah berjalan dibiarkan selesai.
        signal?.addEventListener(
            'abort',
            () => {
                const i = antrean.indexOf(t);
                if (i >= 0) {
                    antrean.splice(i, 1);
                    gagal(signal.reason);
                }
            },
            { once: true },
        );
        jalankanBerikut();
    });
}

/** Hentikan semua worker (shutdown): antrean ditolak, pool dibuat ulang bila dipakai lagi. */
export async function tutupPoolSandi(): Promise<void> {
    for (const t of antrean.splice(0)) t.gagal(new Error('Pool bcrypt ditutup'));
    await Promise.all(pool.splice(0).map((p) => p.w.terminate()));
}

/**
 * Hash::check: hash kosong → false; bukan `$2y$` → galat seperti Laravel (verify=true).
 * Cost di luar 04–31 → false seperti password_verify. NUL di sandi → false (lebih ketat dari PHP, yang memotong
 * sandi di NUL sehingga "a\0b" cocok dengan hash "a"; Hash::make PHP 8.4 tidak pernah menyimpan sandi ber-NUL).
 * Antrean penuh → GalatSandiSibuk.
 */
export async function verifikasiSandi(sandi: string, hash: string | null | undefined, signal?: AbortSignal): Promise<boolean> {
    if (!hash) return false;
    if (!BCRYPT_2Y.test(hash)) throw new Error('This password does not use the Bcrypt algorithm.');
    const biaya = Number(hash.slice(4, 6));
    if (sandi.includes('\0') || biaya < 4 || biaya > 31) return false;
    return jalankan<boolean>({ sandi, hash }, signal);
}

/** Hash::make: `$2y$12$…`; awalan `$2b$` bawaan bcryptjs akan ditolak Hash::check Laravel. Antrean penuh → GalatSandiSibuk. */
export async function hashSandi(sandi: string, signal?: AbortSignal): Promise<string> {
    // password_hash PHP 8.4 menolak NUL; Laravel membungkusnya menjadi RuntimeException ini.
    if (sandi.includes('\0')) throw new Error('Bcrypt hashing not supported.');
    return jalankan<string>({ sandi, biaya: BIAYA_BCRYPT }, signal);
}
