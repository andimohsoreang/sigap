import 'server-only';

import { createHash } from 'node:crypto';

import { and, eq, sql } from 'drizzle-orm';

import { transaksi, type Db, type Transaksi } from '@/server/db/client';
import { ccIdempotency } from '@/server/db/schema-cc';

// Idempotency key (rencana §9.2): kirim pengaduan, survei, pesan chat, lampiran. Kunci dibuat klien dan disimpan
// 24 jam per cakupan. Handler berjalan di DALAM transaksi yang sama dengan baris kunci:
// - respons & tulisan handler commit bersama (tidak ada tiket tanpa catatan kunci, atau sebaliknya);
// - duplikat serentak menunggu di kunci baris PostgreSQL (INSERT yang bentrok menunggu transaksi pertama), lalu
//   membaca respons tersimpan; transaksi pertama gagal → duplikat menjadi pemilik baru;
// - handler melempar → tidak ada yang disimpan, klien boleh mencoba lagi dengan kunci yang sama.
// Panggilan lambat ke luar (reCAPTCHA, AI) dilakukan SEBELUM memanggil ini: transaksi menahan satu koneksi DB, dan
// role cc_app memutus transaksi yang menganggur > 30 dtk.

export interface ResponsIdempoten {
    status: number;
    body: unknown;
}

const TTL = sql`interval '24 hours'`;
/** Batas body respons yang disimpan (jsonb per baris). */
export const MAKS_BODY_TERSIMPAN = 64 * 1024;

// Membatalkan transaksi tanpa melempar ke pemanggil: respons 5xx dikembalikan, tetapi tidak disimpan.
class TidakDisimpan extends Error {
    constructor(readonly hasil: ResponsIdempoten) {
        super('respons 5xx tidak disimpan');
    }
}

/** Kunci sama dipakai untuk isi permintaan yang berbeda. */
export const RESPONS_KUNCI_BENTROK: ResponsIdempoten = {
    status: 422,
    body: { message: 'Idempotency-Key sudah dipakai untuk permintaan yang berbeda.' },
};

/** Header `Idempotency-Key`: 1–255 karakter ASCII tampak. Kosong/tidak sah → null (diproses tanpa idempotensi, seperti Laravel). */
export function kunciIdempotensi(nilai: string | null | undefined): string | null {
    const k = nilai?.trim();
    return k && /^[\x21-\x7e]{1,255}$/.test(k) ? k : null;
}

function stabil(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(stabil);
    if (v !== null && typeof v === 'object') {
        const proto = Object.getPrototypeOf(v);
        // File/Blob/Map/FormData/Date akan menjadi `{}` atau string yang tidak mewakili isinya → hash sama untuk
        // isi berbeda. Pemanggil meringkas dulu, mis. lampiran → { nama, ukuran, sha256 }.
        if (proto !== Object.prototype && proto !== null)
            throw new TypeError(`hashPermintaan hanya menerima objek biasa & array (dapat ${proto?.constructor?.name ?? 'objek'})`);
        return Object.fromEntries(
            Object.keys(v)
                .sort()
                .map((k) => [k, stabil((v as Record<string, unknown>)[k])]),
        );
    }
    return v;
}

/**
 * sha256 dari bagian permintaan (mis. metode, path, body) dengan urutan kunci objek dinormalkan. Hanya nilai JSON
 * biasa; objek lain (File, Map, FormData, Date, …) → TypeError.
 */
export function hashPermintaan(...bagian: unknown[]): string {
    return createHash('sha256')
        .update(JSON.stringify(stabil(bagian)))
        .digest('hex');
}

/**
 * Jalankan `fn` sekali per (cakupan, kunci). `cakupan` memisahkan pemilik kunci (mis. `pengaduan:<id sesi>`).
 * `diulang` = respons diambil dari simpanan, bukan hasil menjalankan `fn`. Respons ≥ 500 tidak disimpan (transaksi
 * dibatalkan); body > 64 KB ditolak (galat).
 */
export async function denganIdempotensi(
    opsi: { cakupan: string; kunci: string; hash: string },
    fn: (tx: Transaksi) => Promise<ResponsIdempoten>,
): Promise<ResponsIdempoten & { diulang: boolean }> {
    const { cakupan, kunci, hash } = opsi;
    try {
        return await jalankan(cakupan, kunci, hash, fn);
    } catch (e) {
        if (e instanceof TidakDisimpan) return { ...e.hasil, diulang: false };
        throw e;
    }
}

function jalankan(cakupan: string, kunci: string, hash: string, fn: (tx: Transaksi) => Promise<ResponsIdempoten>) {
    return transaksi(async (tx): Promise<ResponsIdempoten & { diulang: boolean }> => {
        const kondisi = and(eq(ccIdempotency.scope, cakupan), eq(ccIdempotency.key, kunci));
        // Status 0 hanya terlihat di transaksi ini; baris yang ter-commit selalu berisi respons. Baris kedaluwarsa
        // diambil alih di statement yang sama (tidak bisa terhapus job pembersihan di sela-selanya).
        const baru = await tx
            .insert(ccIdempotency)
            .values({ scope: cakupan, key: kunci, requestHash: hash, status: 0, expiresAt: sql`now() + ${TTL}` })
            .onConflictDoUpdate({
                target: [ccIdempotency.scope, ccIdempotency.key],
                set: { requestHash: hash, status: 0, body: null, createdAt: sql`now()`, expiresAt: sql`now() + ${TTL}` },
                setWhere: sql`${ccIdempotency.expiresAt} <= now()`,
            })
            .returning({ key: ccIdempotency.key });
        if (baru.length === 0) {
            const [lama] = await tx
                .select({ hash: ccIdempotency.requestHash, status: ccIdempotency.status, body: ccIdempotency.body })
                .from(ccIdempotency)
                .where(kondisi)
                .for('update');
            if (!lama) throw new Error('baris idempotency hilang di tengah transaksi');
            return lama.hash === hash ? { status: lama.status, body: lama.body, diulang: true } : { ...RESPONS_KUNCI_BENTROK, diulang: false };
        }
        const hasil = await fn(tx);
        // 5xx = gagal sementara: transaksi (termasuk tulisan handler & kunci) dibatalkan, klien boleh mencoba lagi.
        if (hasil.status >= 500) throw new TidakDisimpan(hasil);
        if (Buffer.byteLength(JSON.stringify(hasil.body ?? null)) > MAKS_BODY_TERSIMPAN)
            throw new Error(`respons idempoten melebihi ${MAKS_BODY_TERSIMPAN} byte; simpan ringkasan (mis. id), bukan isi penuh`);
        await tx.update(ccIdempotency).set({ status: hasil.status, body: hasil.body }).where(kondisi);
        return { ...hasil, diulang: false };
    });
}

/** Hapus kunci kedaluwarsa (job pembersihan worker). */
export async function bersihkanIdempotensi(db: Db): Promise<number> {
    const { rowCount } = await db.execute(sql`DELETE FROM cc_idempotency WHERE expires_at <= now()`);
    return rowCount ?? 0;
}
