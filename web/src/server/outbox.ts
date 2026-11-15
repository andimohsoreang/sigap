import 'server-only';

import { sql } from 'drizzle-orm';

import type { Db, Transaksi } from '@/server/db/client';
import { ccOutbox } from '@/server/db/schema-cc';
import type { Siaran } from '@/server/realtime/kanal';

// Outbox (rencana §9.2): efek samping (job, siaran realtime) ditulis ke cc_outbox di DALAM transaksi bisnis,
// lalu dikirim dispatcher di worker → tidak ada notifikasi untuk tiket yang gagal tersimpan, tidak ada tiket tanpa
// notifikasi. Padanan ShouldDispatchAfterCommit + queue broadcast Laravel.
// Pengiriman at-least-once: penerima harus tahan duplikat (job pg-boss memakai id turunan id outbox, jadi kiriman
// ulang job yang sama ditolak pg-boss; siaran realtime bisa terulang, sama seperti broadcast lewat queue Laravel).

export type PesanOutbox = { jenis: 'job'; antrean: string; data: object; agregat?: string } | { jenis: 'realtime'; siaran: Siaran; agregat?: string };

/** Tulis pesan outbox di transaksi pemanggil (dari `transaksi()`); terkirim hanya bila transaksi commit. */
export async function enqueueOutbox(tx: Transaksi, ...pesan: PesanOutbox[]): Promise<void> {
    if (pesan.length === 0) return;
    await tx.insert(ccOutbox).values(
        pesan.map((p) =>
            p.jenis === 'job'
                ? { kind: 'job', topic: p.antrean, aggregateKey: p.agregat ?? null, payload: p.data }
                : {
                      kind: 'realtime',
                      topic: p.siaran.event,
                      aggregateKey: p.agregat ?? null,
                      payload: { kanal: p.siaran.kanal, data: p.siaran.data },
                  },
        ),
    );
}

export type BarisOutbox = {
    id: number;
    kind: 'job' | 'realtime';
    topic: string;
    payload: unknown;
    attempts: number;
};

export interface PenerbitOutbox {
    job(antrean: string, data: object, idJob: string): Promise<unknown>;
    realtime(siaran: Siaran): Promise<unknown>;
}

const SEWA_DETIK = 60;
export const MAKS_PERCOBAAN = 10;

/** UUID tetap per baris outbox: pg-boss menolak id job yang sama, jadi kiriman ulang tidak membuat job ganda. */
export function idJobOutbox(id: number): string {
    return `00000000-0000-4000-8000-${id.toString(16).padStart(12, '0')}`;
}

/**
 * Ambil (sewa 60 dtk) lalu kirim satu batch. Urutan per agregat: hanya pesan tertua yang belum terkirim di tiap
 * agregat yang boleh diambil, jadi pesan berikutnya menunggu sampai pendahulunya terkirim atau menyerah.
 * SKIP LOCKED: beberapa worker bisa berjalan bersamaan tanpa mengambil baris yang sama. Worker mati di tengah
 * pengiriman → baris kembali tersedia setelah sewa habis. Mengembalikan jumlah baris yang diambil.
 */
export async function kirimOutbox(db: Db, penerbit: PenerbitOutbox, batas = 50): Promise<number> {
    const { rows } = await db.execute<BarisOutbox>(sql`
        UPDATE cc_outbox SET attempts = attempts + 1, available_at = now() + make_interval(secs => ${SEWA_DETIK})
        WHERE id IN (
            SELECT o.id FROM cc_outbox o
            WHERE o.sent_at IS NULL AND o.failed_at IS NULL AND o.available_at <= now()
              AND (o.aggregate_key IS NULL OR NOT EXISTS (
                SELECT 1 FROM cc_outbox p
                WHERE p.aggregate_key = o.aggregate_key AND p.sent_at IS NULL AND p.failed_at IS NULL AND p.id < o.id))
            ORDER BY o.id
            LIMIT ${batas}
            FOR UPDATE SKIP LOCKED)
        RETURNING id::int AS id, kind, topic, payload, attempts`);

    const hasil = await Promise.allSettled(
        rows.map((b) => {
            if (b.kind === 'job') return penerbit.job(b.topic, b.payload as object, idJobOutbox(b.id));
            const { kanal, data } = b.payload as Omit<Siaran, 'event'>;
            return penerbit.realtime({ event: b.topic, kanal, data } as Siaran);
        }),
    );

    const terkirim = rows.filter((_, i) => hasil[i].status === 'fulfilled').map((b) => b.id);
    if (terkirim.length) await db.execute(sql`UPDATE cc_outbox SET sent_at = now(), last_error = NULL WHERE id IN (${sql.join(terkirim, sql`, `)})`);
    for (const [i, b] of rows.entries()) {
        const h = hasil[i];
        if (h.status === 'fulfilled') continue;
        const pesan = String((h.reason as Error)?.message ?? h.reason).slice(0, 500);
        // Backoff eksponensial 2^n dtk, maks 5 menit.
        await db.execute(sql`
            UPDATE cc_outbox SET last_error = ${pesan},
                available_at = now() + make_interval(secs => ${Math.min(2 ** b.attempts, 300)}),
                failed_at = CASE WHEN attempts >= ${MAKS_PERCOBAAN} THEN now() END
            WHERE id = ${b.id}`);
    }
    return rows.length;
}

/** Hapus pesan terkirim > 7 hari (job pembersihan worker). */
export async function bersihkanOutbox(db: Db): Promise<number> {
    const { rowCount } = await db.execute(sql`DELETE FROM cc_outbox WHERE sent_at < now() - interval '7 days'`);
    return rowCount ?? 0;
}
