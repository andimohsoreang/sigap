import 'server-only';

import { createHmac, hkdfSync, randomBytes } from 'node:crypto';

import { env } from '@/server/env';
import { bacaKunci, samaWaktuTetap } from '@/server/legacy/laravel-crypt';

import type { Pengguna } from './peran';
import { hashId, type Sesi } from './sesi';

// Konteks auth dari proxy.ts ke route handler / Server Component dalam permintaan yang SAMA, supaya sesi & pengguna
// tidak dimuat dua kali dari DB. Header hanya membawa penanda bertanda tangan; sesi & baris pengguna disimpan di
// memori proses (proxy dan rute berjalan di proses Node.js yang sama, beda chunk → Map di globalThis).
// - Kunci HMAC diturunkan dari APP_KEY lewat HKDF berlabel (bukan APP_KEY mentah).
// - Tanda tangan mencakup nonce CSP permintaan (x-nonce, selalu ditimpa proxy) dan id acak permintaan: header yang
//   disalin dari permintaan lain gagal diverifikasi.
// - proxy.ts selalu membuang header ini dari permintaan masuk sebelum mengisinya.
// - Isi header: versi, id permintaan, id sesi internal (sha256), id pengguna, sidik sandi — tanpa data sensitif.

export const HEADER_KONTEKS = 'x-cc-konteks';
const VERSI = 'v1';
/** Cukup untuk satu permintaan (render halaman/aksi); entri lebih tua dibuang. */
const UMUR_MS = 60_000;
const MAKS_ENTRI = 20_000;

type Entri = { sesi: Sesi | null; pengguna: Pengguna | null; habis: number };
const simpanan = ((globalThis as { [k: symbol]: Map<string, Entri> | undefined })[Symbol.for('cc.auth.konteks')] ??= new Map());

let kunci: Buffer | null | undefined;
function kunciKonteks(): Buffer | null {
    if (kunci === undefined) {
        kunci = env.APP_KEY ? Buffer.from(hkdfSync('sha256', bacaKunci(env.APP_KEY).kunci, 'contact-center', 'cc-konteks-auth-v1', 32)) : null;
    }
    return kunci;
}

const tanda = (k: Buffer, nonce: string, isi: string) => createHmac('sha256', k).update(`${nonce}.${isi}`).digest('base64url');

function bagianIsi(sesi: Sesi | null, pengguna: Pengguna | null): [string, string, string] {
    return [sesi ? hashId(sesi.id) : '-', pengguna ? String(pengguna.id) : '-', sesi?.sidikSandi ?? '-'];
}

function bersihkan(now: number) {
    // Map urut sisip = urut kedaluwarsa: berhenti di entri pertama yang masih berlaku.
    for (const [rid, e] of simpanan) {
        if (e.habis > now && simpanan.size < MAKS_ENTRI) break;
        simpanan.delete(rid);
    }
}

/** proxy.ts: simpan konteks permintaan & kembalikan nilai header. Null bila APP_KEY atau nonce tidak ada. */
export function tandaiKonteks(nonce: string | null, sesi: Sesi | null, pengguna: Pengguna | null): string | null {
    const k = kunciKonteks();
    if (!k || !nonce) return null;
    const now = Date.now();
    bersihkan(now);
    const rid = randomBytes(16).toString('base64url');
    simpanan.set(rid, { sesi: structuredClone(sesi), pengguna: structuredClone(pengguna), habis: now + UMUR_MS });
    const isi = [VERSI, rid, ...bagianIsi(sesi, pengguna)].join('.');
    return `${isi}.${tanda(k, nonce, isi)}`;
}

export type HasilKonteks = { sesi: Sesi | null; pengguna: Pengguna | null } | 'tidak-ada' | 'tidak-sah';

/** Rute: verifikasi header konteks (tanda tangan, nonce permintaan ini, entri memori cocok). Salinan dikembalikan. */
export function bacaKonteks(h: Headers): HasilKonteks {
    const nilai = h.get(HEADER_KONTEKS);
    if (!nilai) return 'tidak-ada';
    const k = kunciKonteks();
    const nonce = h.get('x-nonce');
    const b = nilai.split('.');
    if (!k || !nonce || b.length !== 6 || b[0] !== VERSI) return 'tidak-sah';
    const isi = b.slice(0, 5).join('.');
    if (!samaWaktuTetap(tanda(k, nonce, isi), b[5])) return 'tidak-sah';
    const e = simpanan.get(b[1]);
    if (!e || e.habis <= Date.now() || bagianIsi(e.sesi, e.pengguna).join('.') !== b.slice(2, 5).join('.')) return 'tidak-sah';
    return { sesi: structuredClone(e.sesi), pengguna: structuredClone(e.pengguna) };
}
