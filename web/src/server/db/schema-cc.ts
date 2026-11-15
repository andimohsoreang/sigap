// Tabel KHUSUS Next.js (tidak ada di Laravel). Skema Laravel (schema.ts) tetap acuan tabel bersama dan tidak diubah
// dari sini. Migrasi: `npm run db:generate` → drizzle-cc/*.sql, diterapkan `node dist/migrate.js` sebagai cc_migrate.
// Tabel baru → timestamptz & jsonb (bukan format Laravel, karena tidak dibaca Laravel).

import { sql } from 'drizzle-orm';
import { bigint, index, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, varchar } from 'drizzle-orm/pg-core';

const waktu = (nama: string) => timestamp(nama, { withTimezone: true, mode: 'date' });

/** Outbox (rencana §9.2): efek samping ditulis dalam transaksi yang sama, dikirim dispatcher di worker. */
export const ccOutbox = pgTable(
    'cc_outbox',
    {
        id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
        /** 'job' (pg-boss) | 'realtime' (Sockudo). */
        kind: text().notNull(),
        /** Nama antrean pg-boss atau nama event realtime. */
        topic: text().notNull(),
        /** Pesan dengan kunci sama dikirim berurutan (mis. `chat:12`); null = tanpa urutan. */
        aggregateKey: text('aggregate_key'),
        payload: jsonb().notNull(),
        attempts: integer().notNull().default(0),
        availableAt: waktu('available_at').notNull().defaultNow(),
        lastError: text('last_error'),
        createdAt: waktu('created_at').notNull().defaultNow(),
        sentAt: waktu('sent_at'),
        /** Menyerah setelah batas percobaan; tidak lagi menahan pesan berikutnya di agregat yang sama. */
        failedAt: waktu('failed_at'),
    },
    (t) => [
        index('cc_outbox_antre')
            .on(t.id)
            .where(sql`sent_at IS NULL AND failed_at IS NULL`),
        index('cc_outbox_agregat')
            .on(t.aggregateKey, t.id)
            .where(sql`aggregate_key IS NOT NULL AND sent_at IS NULL AND failed_at IS NULL`),
        index('cc_outbox_terkirim').on(t.sentAt),
    ],
);

/** Idempotency key (rencana §9.2): respons disimpan 24 jam per (cakupan, kunci). */
export const ccIdempotency = pgTable(
    'cc_idempotency',
    {
        scope: text().notNull(),
        key: text().notNull(),
        requestHash: text('request_hash').notNull(),
        status: smallint().notNull(),
        body: jsonb(),
        createdAt: waktu('created_at').notNull().defaultNow(),
        expiresAt: waktu('expires_at').notNull(),
    },
    (t) => [primaryKey({ columns: [t.scope, t.key] }), index('cc_idempotency_kedaluwarsa').on(t.expiresAt)],
);

/**
 * Sesi milik Next.js (cookie cc_session, paket F) — padanan tabel `sessions` Laravel, tidak dibagi dengan Laravel.
 * `id` = sha256 hex dari id mentah di cookie: kebocoran tabel tidak memberi sesi yang bisa dipakai. Idle-based:
 * baris dengan last_activity lebih lama dari SESSION_LIFETIME dianggap tidak ada dan dihapus job cc-bersih.
 */
export const ccSessions = pgTable(
    'cc_sessions',
    {
        id: text().primaryKey(),
        userId: bigint('user_id', { mode: 'number' }),
        /** Token CSRF sesi (`_token` Laravel); dikirim ke browser lewat cookie XSRF-TOKEN. */
        csrfToken: text('csrf_token').notNull(),
        /** HMAC hash sandi saat login (`password_hash_web` Laravel); beda dengan users.password → sesi keluar. */
        passwordHashFingerprint: text('password_hash_fingerprint'),
        /**
         * Flash, url.intended, _old_input (bisa memuat NIK), dsb.: JSON terenkripsi APP_KEY (format Encrypter Laravel,
         * seperti SESSION_ENCRYPT=true produksi). Gagal didekripsi → dianggap tanpa sesi.
         */
        data: text().notNull(),
        ipAddress: varchar('ip_address', { length: 45 }),
        userAgent: text('user_agent'),
        lastActivity: waktu('last_activity').notNull().defaultNow(),
        createdAt: waktu('created_at').notNull().defaultNow(),
    },
    (t) => [index('cc_sessions_user_id').on(t.userId), index('cc_sessions_last_activity').on(t.lastActivity)],
);
