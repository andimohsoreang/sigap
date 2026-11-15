import 'server-only';

import { isAxiosError } from 'axios';
import { sql } from 'drizzle-orm';

import type { Db, Transaksi } from '@/server/db/client';
import { bersihkanGalatDb } from '@/server/db/galat';
import { chatConversations } from '@/server/db/schema';
import { ccOutbox } from '@/server/db/schema-cc';
import { log } from '@/server/log';
import type { Siaran, SiaranOutbox } from '@/server/realtime/kanal';

// Outbox (rencana §9.2): efek samping (job, siaran realtime) ditulis ke cc_outbox di DALAM transaksi bisnis,
// lalu dikirim dispatcher di worker → tidak ada notifikasi untuk tiket yang gagal tersimpan, tidak ada tiket tanpa
// notifikasi. Padanan ShouldDispatchAfterCommit + queue broadcast Laravel.
// Pengiriman at-least-once: penerima harus tahan duplikat (job pg-boss memakai id turunan id outbox, jadi kiriman
// ulang job yang sama ditolak pg-boss; siaran realtime bisa terulang, sama seperti broadcast lewat queue Laravel).

export type PesanOutbox =
    | { jenis: 'job'; antrean: string; data: object; agregat?: string }
    | { jenis: 'realtime'; siaran: SiaranOutbox; agregat?: string };

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
 * Lengkapi data siaran yang dihitung saat disiarkan (broadcastWith Laravel dievaluasi di queue, setelah commit).
 * chat.unread: ChatConversation::unreadForAdmins() = (int) sum(unread_admin).
 */
async function lengkapi(db: Db, s: SiaranOutbox): Promise<Siaran> {
    if (s.event !== 'chat.unread') return s;
    const [{ total }] = await db.select({ total: sql<number>`coalesce(sum(${chatConversations.unreadAdmin}), 0)::int` }).from(chatConversations);
    return { ...s, data: { conversation_id: s.data.conversation_id, total } };
}

/**
 * Galat yang tidak akan sembuh dengan mencoba lagi: 4xx dari Sockudo (selain 408/429), antrean pg-boss tidak ada,
 * atau penerbit menandai `permanen` (mis. payload terlalu besar). Langsung menyerah, tanpa 10 kali backoff.
 */
export function galatPermanen(e: unknown): boolean {
    if (isAxiosError(e)) {
        const s = e.response?.status;
        return s !== undefined && s >= 400 && s < 500 && s !== 408 && s !== 429;
    }
    const g = e as { code?: string; permanen?: boolean } | null;
    return g?.permanen === true || g?.code === 'PGBOSS_QUEUE_NOT_FOUND';
}

/**
 * Ambil (sewa 60 dtk) lalu kirim satu batch. Urutan per agregat: hanya pesan tertua yang belum terkirim di tiap
 * agregat yang boleh diambil, jadi pesan berikutnya menunggu sampai pendahulunya terkirim atau menyerah.
 * SKIP LOCKED: beberapa worker bisa berjalan bersamaan tanpa mengambil baris yang sama. Worker mati di tengah
 * pengiriman → baris kembali tersedia setelah sewa habis. Mengembalikan jumlah baris yang diambil.
 */
export async function kirimOutbox(db: Db, penerbit: PenerbitOutbox, batas = 50): Promise<number> {
    // Sewa yang habis berulang kali tanpa hasil (worker mati/crash saat mengirim pesan ini) → menyerah, agar pesan
    // racun tidak membuat worker crash selamanya. Percobaan yang gagal biasa sudah menyerah di bawah.
    const { rows: racun } = await db.execute<{ id: number; topic: string; last_error: string | null }>(sql`
        UPDATE cc_outbox SET failed_at = now(), last_error = coalesce(last_error, 'sewa habis ' || attempts || ' kali tanpa hasil')
        WHERE sent_at IS NULL AND failed_at IS NULL AND attempts >= ${MAKS_PERCOBAAN} AND available_at <= now()
        RETURNING id::int AS id, topic, last_error`);
    for (const r of racun) log.error({ id: r.id, topic: r.topic, last_error: r.last_error }, 'outbox menyerah');

    const { rows } = await db.execute<BarisOutbox>(sql`
        UPDATE cc_outbox SET attempts = attempts + 1, available_at = now() + make_interval(secs => ${SEWA_DETIK})
        WHERE id IN (
            SELECT o.id FROM cc_outbox o
            WHERE o.sent_at IS NULL AND o.failed_at IS NULL AND o.available_at <= now() AND o.attempts < ${MAKS_PERCOBAAN}
              AND (o.aggregate_key IS NULL OR NOT EXISTS (
                SELECT 1 FROM cc_outbox p
                WHERE p.aggregate_key = o.aggregate_key AND p.sent_at IS NULL AND p.failed_at IS NULL AND p.id < o.id))
            ORDER BY o.id
            LIMIT ${batas}
            FOR UPDATE SKIP LOCKED)
        RETURNING id::int AS id, kind, topic, payload, attempts`);

    const hasil = await Promise.allSettled(
        rows.map(async (b) => {
            if (b.kind === 'job') return penerbit.job(b.topic, b.payload as object, idJobOutbox(b.id));
            const { kanal, data } = b.payload as Omit<SiaranOutbox, 'event'>;
            return penerbit.realtime(await lengkapi(db, { event: b.topic, kanal, data } as SiaranOutbox));
        }),
    );

    const terkirim = rows.filter((_, i) => hasil[i].status === 'fulfilled').map((b) => b.id);
    if (terkirim.length) await db.execute(sql`UPDATE cc_outbox SET sent_at = now(), last_error = NULL WHERE id IN (${sql.join(terkirim, sql`, `)})`);
    for (const [i, b] of rows.entries()) {
        const h = hasil[i];
        if (h.status === 'fulfilled') continue;
        // Galat Drizzle membawa nilai parameter query di pesannya; disimpan versi tanpa data (seperti log).
        const galat = bersihkanGalatDb(h.reason) as Error;
        const pesan = String(galat?.message ?? galat).slice(0, 500);
        const menyerah = galatPermanen(h.reason) || b.attempts >= MAKS_PERCOBAAN;
        // Backoff eksponensial 2^n dtk, maks 5 menit.
        await db.execute(sql`
            UPDATE cc_outbox SET last_error = ${pesan},
                available_at = now() + make_interval(secs => ${Math.min(2 ** b.attempts, 300)}),
                failed_at = ${menyerah ? sql`now()` : null}
            WHERE id = ${b.id}`);
        if (menyerah) log.error({ id: b.id, topic: b.topic, last_error: pesan }, 'outbox menyerah');
    }
    return rows.length;
}

/** Hapus pesan terkirim > 7 hari (job pembersihan worker). */
export async function bersihkanOutbox(db: Db): Promise<number> {
    const { rowCount } = await db.execute(sql`DELETE FROM cc_outbox WHERE sent_at < now() - interval '7 days'`);
    return rowCount ?? 0;
}
