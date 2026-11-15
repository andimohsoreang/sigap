// Dibangkitkan `drizzle-kit pull` (drizzle-kit 0.31.11) dari contact_center_dev (migrasi laravel-baseline), lalu diubah:
// - timestamp(0) Laravel → waktuWib (jam dinding WIB); 4 kolom cast `encrypted` → terenkripsi (lihat ./kolom);
// - id bigserial mode "number" seperti FK-nya (JSON Laravel berisi angka, bukan BigInt);
// - opclass indeks hasil pull (salah tebak, mis. timestamp_ops untuk varchar) dibuang → opclass bawaan;
// - sequence tabel framework dibuang. Tabel framework Laravel tidak ditarik (lihat drizzle.config.ts).
// Kolom `*_nik_hash` diisi lewat denganNikHash / denganReporterNikHash, padanan hook `saving` model Laravel.

import { sql } from 'drizzle-orm';
import {
    bigint,
    bigserial,
    boolean,
    date,
    foreignKey,
    index,
    integer,
    json,
    numeric,
    pgTable,
    smallint,
    text,
    unique,
    varchar,
} from 'drizzle-orm/pg-core';
import { terenkripsi, waktuWib } from './kolom';

export const channelSyncLogs = pgTable(
    'channel_sync_logs',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        channelId: bigint('channel_id', { mode: 'number' }),
        channel: varchar({ length: 30 }),
        pulledCount: integer('pulled_count').default(0).notNull(),
        status: varchar({ length: 20 }).default('berhasil').notNull(),
        message: text(),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
    },
    (table) => [
        foreignKey({
            columns: [table.channelId],
            foreignColumns: [channels.id],
            name: 'channel_sync_logs_channel_id_foreign',
        }).onDelete('set null'),
    ],
);

export const regions = pgTable(
    'regions',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        code: varchar({ length: 30 }).notNull(),
        name: varchar({ length: 150 }).notNull(),
        province: varchar({ length: 100 }),
        latitude: numeric({ precision: 10, scale: 6 }),
        longitude: numeric({ precision: 10, scale: 6 }),
        geometry: json(),
        infrastructureStatus: varchar('infrastructure_status', { length: 50 }),
        kkCount: integer('kk_count').default(0).notNull(),
        isActive: boolean('is_active').default(true).notNull(),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
    },
    (table) => [unique('regions_code_unique').on(table.code)],
);

export const settings = pgTable(
    'settings',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        key: varchar({ length: 100 }).notNull(),
        value: json(),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
    },
    (table) => [unique('settings_key_unique').on(table.key)],
);

export const categories = pgTable(
    'categories',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        name: varchar({ length: 100 }).notNull(),
        slug: varchar({ length: 100 }).notNull(),
        priorityDefault: varchar('priority_default', { length: 20 }).default('umum').notNull(),
        slaDays: smallint('sla_days')
            .default(sql`'14'`)
            .notNull(),
        isActive: boolean('is_active').default(true).notNull(),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
    },
    (table) => [unique('categories_name_unique').on(table.name), unique('categories_slug_unique').on(table.slug)],
);

export const channels = pgTable('channels', {
    id: bigserial({ mode: 'number' }).primaryKey().notNull(),
    type: varchar({ length: 20 }).notNull(),
    name: varchar({ length: 120 }).notNull(),
    accountName: varchar('account_name', { length: 120 }),
    url: varchar({ length: 500 }),
    status: varchar({ length: 30 }).default('aktif').notNull(),
    config: json(),
    lastSyncedAt: waktuWib('last_synced_at'),
    createdAt: waktuWib('created_at'),
    updatedAt: waktuWib('updated_at'),
});

export const ticketHistories = pgTable(
    'ticket_histories',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        ticketId: bigint('ticket_id', { mode: 'number' }).notNull(),
        fromStatus: varchar('from_status', { length: 20 }),
        toStatus: varchar('to_status', { length: 20 }).notNull(),
        actorId: bigint('actor_id', { mode: 'number' }),
        note: text(),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
    },
    (table) => [
        index().using('btree', table.ticketId),
        foreignKey({
            columns: [table.ticketId],
            foreignColumns: [tickets.id],
            name: 'ticket_histories_ticket_id_foreign',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.actorId],
            foreignColumns: [users.id],
            name: 'ticket_histories_actor_id_foreign',
        }).onDelete('set null'),
    ],
);

export const ticketReplies = pgTable(
    'ticket_replies',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        ticketId: bigint('ticket_id', { mode: 'number' }).notNull(),
        authorId: bigint('author_id', { mode: 'number' }),
        body: text().notNull(),
        isPublic: boolean('is_public').default(true).notNull(),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
    },
    (table) => [
        index().using('btree', table.ticketId),
        foreignKey({
            columns: [table.ticketId],
            foreignColumns: [tickets.id],
            name: 'ticket_replies_ticket_id_foreign',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.authorId],
            foreignColumns: [users.id],
            name: 'ticket_replies_author_id_foreign',
        }).onDelete('set null'),
    ],
);

export const activityLogs = pgTable(
    'activity_logs',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        userId: bigint('user_id', { mode: 'number' }),
        username: varchar({ length: 100 }),
        action: varchar({ length: 100 }).notNull(),
        subjectType: varchar('subject_type', { length: 150 }),
        subjectId: varchar('subject_id', { length: 100 }),
        description: text(),
        properties: json(),
        ipAddress: varchar('ip_address', { length: 45 }),
        userAgent: varchar('user_agent', { length: 255 }),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
    },
    (table) => [
        index().using('btree', table.action, table.createdAt),
        index().using('btree', table.subjectType, table.subjectId),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: 'activity_logs_user_id_foreign',
        }).onDelete('set null'),
    ],
);

export const tickets = pgTable(
    'tickets',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        ticketNo: varchar('ticket_no', { length: 20 }).notNull(),
        title: varchar({ length: 255 }).notNull(),
        description: text().notNull(),
        status: varchar({ length: 20 }).default('baru').notNull(),
        priority: varchar({ length: 20 }).default('umum').notNull(),
        impact: varchar({ length: 20 }),
        visibility: varchar({ length: 20 }).default('publik').notNull(),
        latitude: numeric({ precision: 10, scale: 6 }),
        longitude: numeric({ precision: 10, scale: 6 }),
        attachmentPath: varchar('attachment_path', { length: 500 }),
        isInternal: boolean('is_internal').default(false).notNull(),
        categoryId: bigint('category_id', { mode: 'number' }),
        regionId: bigint('region_id', { mode: 'number' }),
        channelId: bigint('channel_id', { mode: 'number' }),
        assigneeId: bigint('assignee_id', { mode: 'number' }),
        reporterId: bigint('reporter_id', { mode: 'number' }),
        reporterName: varchar('reporter_name', { length: 150 }),
        reporterNik: terenkripsi('reporter_nik'),
        reporterEmail: varchar('reporter_email', { length: 150 }),
        reporterPhone: varchar('reporter_phone', { length: 30 }),
        slaDueAt: waktuWib('sla_due_at'),
        respondedAt: waktuWib('responded_at'),
        resolvedAt: waktuWib('resolved_at'),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
        deletedAt: waktuWib('deleted_at'),
        ewsNotifiedAt: waktuWib('ews_notified_at'),
        source: varchar({ length: 30 }),
        sourceUrl: varchar('source_url', { length: 500 }),
        receivedBy: varchar('received_by', { length: 150 }),
        reporterNip: varchar('reporter_nip', { length: 30 }),
        reporterUnit: varchar('reporter_unit', { length: 120 }),
        location: varchar({ length: 150 }),
        reporterNikHash: varchar('reporter_nik_hash', { length: 64 }),
        lookupToken: varchar('lookup_token', { length: 16 }),
        province: varchar({ length: 60 }),
        reporterUnitId: bigint('reporter_unit_id', { mode: 'number' }),
        unitId: bigint('unit_id', { mode: 'number' }),
        disposedAt: waktuWib('disposed_at'),
        reviewRequestedAt: waktuWib('review_requested_at'),
        reviewReason: varchar('review_reason', { length: 20 }),
        reviewedAt: waktuWib('reviewed_at'),
        reviewedBy: bigint('reviewed_by', { mode: 'number' }),
        surveyRemindedAt: waktuWib('survey_reminded_at'),
    },
    (table) => [
        index().using('btree', table.assigneeId),
        index().using('btree', table.categoryId),
        index().using('btree', table.channelId),
        index().using('btree', table.createdAt),
        index().using('btree', table.impact),
        index().using('btree', table.isInternal),
        index().using('btree', table.priority),
        index().using('btree', table.province),
        index().using('btree', table.regionId),
        index().using('btree', table.reporterId),
        index().using('btree', table.reporterNikHash),
        index().using('btree', table.reviewRequestedAt),
        index().using('btree', table.slaDueAt),
        index().using('btree', table.status),
        foreignKey({
            columns: [table.categoryId],
            foreignColumns: [categories.id],
            name: 'tickets_category_id_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.regionId],
            foreignColumns: [regions.id],
            name: 'tickets_region_id_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.channelId],
            foreignColumns: [channels.id],
            name: 'tickets_channel_id_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.assigneeId],
            foreignColumns: [users.id],
            name: 'tickets_assignee_id_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.reporterId],
            foreignColumns: [users.id],
            name: 'tickets_reporter_id_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.reporterUnitId],
            foreignColumns: [units.id],
            name: 'tickets_reporter_unit_id_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.unitId],
            foreignColumns: [units.id],
            name: 'tickets_unit_id_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.reviewedBy],
            foreignColumns: [users.id],
            name: 'tickets_reviewed_by_foreign',
        }).onDelete('set null'),
        unique('tickets_ticket_no_unique').on(table.ticketNo),
    ],
);

export const users = pgTable(
    'users',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        nik: terenkripsi('nik'),
        username: varchar({ length: 50 }),
        name: varchar({ length: 255 }).notNull(),
        email: varchar({ length: 255 }),
        phone: varchar({ length: 30 }),
        role: varchar({ length: 20 }).default('warga').notNull(),
        regionId: bigint('region_id', { mode: 'number' }),
        unit: varchar({ length: 120 }),
        isActive: boolean('is_active').default(true).notNull(),
        emailVerifiedAt: waktuWib('email_verified_at'),
        password: varchar({ length: 255 }).notNull(),
        rememberToken: varchar('remember_token', { length: 100 }),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
        nikHash: varchar('nik_hash', { length: 64 }),
        registeredBy: bigint('registered_by', { mode: 'number' }),
        activatedAt: waktuWib('activated_at'),
        unitId: bigint('unit_id', { mode: 'number' }),
    },
    (table) => [
        index().using('btree', table.regionId),
        index().using('btree', table.role),
        foreignKey({
            columns: [table.regionId],
            foreignColumns: [regions.id],
            name: 'users_region_id_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.registeredBy],
            foreignColumns: [table.id],
            name: 'users_registered_by_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.unitId],
            foreignColumns: [units.id],
            name: 'users_unit_id_foreign',
        }).onDelete('set null'),
        unique('users_username_unique').on(table.username),
        unique('users_email_unique').on(table.email),
        unique('users_nik_hash_unique').on(table.nikHash),
    ],
);

export const chatMessages = pgTable(
    'chat_messages',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        conversationId: bigint('conversation_id', { mode: 'number' }).notNull(),
        senderId: bigint('sender_id', { mode: 'number' }),
        senderType: varchar('sender_type', { length: 20 }).default('user').notNull(),
        body: text().notNull(),
        readAt: waktuWib('read_at'),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
        meta: json(),
        feedback: smallint(),
    },
    (table) => [
        index().using('btree', table.conversationId, table.createdAt),
        foreignKey({
            columns: [table.conversationId],
            foreignColumns: [chatConversations.id],
            name: 'chat_messages_conversation_id_foreign',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.senderId],
            foreignColumns: [users.id],
            name: 'chat_messages_sender_id_foreign',
        }).onDelete('set null'),
    ],
);

export const knowledgeDocuments = pgTable(
    'knowledge_documents',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        originalName: varchar('original_name', { length: 255 }).notNull(),
        path: varchar({ length: 255 }).notNull(),
        size: integer().default(0).notNull(),
        pages: integer(),
        status: varchar({ length: 20 }).default('diproses').notNull(),
        error: text(),
        proposals: json(),
        uploadedBy: bigint('uploaded_by', { mode: 'number' }),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
    },
    (table) => [
        foreignKey({
            columns: [table.uploadedBy],
            foreignColumns: [users.id],
            name: 'knowledge_documents_uploaded_by_foreign',
        }).onDelete('set null'),
    ],
);

export const referrals = pgTable(
    'referrals',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        token: varchar({ length: 64 }).notNull(),
        code: varchar({ length: 20 }).notNull(),
        portalId: bigint('portal_id', { mode: 'number' }).notNull(),
        conversationId: bigint('conversation_id', { mode: 'number' }),
        userId: bigint('user_id', { mode: 'number' }),
        citizenName: varchar('citizen_name', { length: 120 }),
        contact: terenkripsi('contact'),
        summary: text(),
        status: varchar({ length: 20 }).default('dirujuk').notNull(),
        externalRef: varchar('external_ref', { length: 100 }),
        assignedTo: bigint('assigned_to', { mode: 'number' }),
        createdBy: bigint('created_by', { mode: 'number' }),
        openedAt: waktuWib('opened_at'),
        confirmedAt: waktuWib('confirmed_at'),
        followUpDueAt: waktuWib('follow_up_due_at'),
        remindedAt: waktuWib('reminded_at'),
        closedAt: waktuWib('closed_at'),
        closedBy: bigint('closed_by', { mode: 'number' }),
        closeReason: text('close_reason'),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
        citizenRemindedAt: waktuWib('citizen_reminded_at'),
    },
    (table) => [
        index().using('btree', table.followUpDueAt),
        index().using('btree', table.status),
        foreignKey({
            columns: [table.portalId],
            foreignColumns: [portals.id],
            name: 'referrals_portal_id_foreign',
        }).onDelete('restrict'),
        foreignKey({
            columns: [table.conversationId],
            foreignColumns: [chatConversations.id],
            name: 'referrals_conversation_id_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: 'referrals_user_id_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.assignedTo],
            foreignColumns: [users.id],
            name: 'referrals_assigned_to_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.createdBy],
            foreignColumns: [users.id],
            name: 'referrals_created_by_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.closedBy],
            foreignColumns: [users.id],
            name: 'referrals_closed_by_foreign',
        }).onDelete('set null'),
        unique('referrals_token_unique').on(table.token),
        unique('referrals_code_unique').on(table.code),
    ],
);

export const chatConversations = pgTable(
    'chat_conversations',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        userId: bigint('user_id', { mode: 'number' }),
        guestToken: varchar('guest_token', { length: 64 }),
        subject: varchar({ length: 200 }),
        lastMessageAt: waktuWib('last_message_at'),
        unreadAdmin: integer('unread_admin').default(0).notNull(),
        unreadUser: integer('unread_user').default(0).notNull(),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
        guestName: varchar('guest_name', { length: 100 }),
        handledBy: varchar('handled_by', { length: 20 }).default('petugas').notNull(),
        handoffAt: waktuWib('handoff_at'),
        handoffReason: varchar('handoff_reason', { length: 30 }),
        aiSummary: text('ai_summary'),
        reference: varchar({ length: 20 }),
        contact: terenkripsi('contact'),
        assignedTo: bigint('assigned_to', { mode: 'number' }),
        outcome: varchar({ length: 30 }),
        closedAt: waktuWib('closed_at'),
        closedBy: bigint('closed_by', { mode: 'number' }),
        ticketId: bigint('ticket_id', { mode: 'number' }),
        dataVerifiedAt: waktuWib('data_verified_at'),
        aiPendingAt: waktuWib('ai_pending_at'),
        province: varchar({ length: 60 }),
        location: varchar({ length: 150 }),
    },
    (table) => [
        index().using('btree', table.guestToken),
        index().using('btree', table.outcome),
        index().using('btree', table.userId),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: 'chat_conversations_user_id_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.assignedTo],
            foreignColumns: [users.id],
            name: 'chat_conversations_assigned_to_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.closedBy],
            foreignColumns: [users.id],
            name: 'chat_conversations_closed_by_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.ticketId],
            foreignColumns: [tickets.id],
            name: 'chat_conversations_ticket_id_foreign',
        }).onDelete('set null'),
        unique('chat_conversations_reference_unique').on(table.reference),
    ],
);

export const portals = pgTable(
    'portals',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        code: varchar({ length: 40 }).notNull(),
        name: varchar({ length: 100 }).notNull(),
        url: varchar({ length: 500 }).notNull(),
        actionUrl: varchar('action_url', { length: 500 }),
        actionLabel: varchar('action_label', { length: 60 }),
        audience: varchar({ length: 10 }).default('publik').notNull(),
        purpose: varchar({ length: 255 }).notNull(),
        description: text(),
        keywords: varchar({ length: 500 }),
        steps: text(),
        prepare: text(),
        proofLabel: varchar('proof_label', { length: 60 }),
        trackCompletion: boolean('track_completion').default(false).notNull(),
        managedBy: varchar('managed_by', { length: 150 }),
        contact: varchar({ length: 255 }),
        isActive: boolean('is_active').default(true).notNull(),
        sort: smallint()
            .default(sql`'0'`)
            .notNull(),
        isReachable: boolean('is_reachable').default(true).notNull(),
        lastStatus: smallint('last_status'),
        lastCheckedAt: waktuWib('last_checked_at'),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
    },
    (table) => [unique('portals_code_unique').on(table.code)],
);

export const knowledgeArticles = pgTable(
    'knowledge_articles',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        title: varchar({ length: 255 }).notNull(),
        body: text().notNull(),
        category: varchar({ length: 100 }),
        source: varchar({ length: 255 }),
        sourceRef: varchar('source_ref', { length: 100 }),
        status: varchar({ length: 20 }).default('draf').notNull(),
        reviewAt: date('review_at'),
        knowledgeDocumentId: bigint('knowledge_document_id', { mode: 'number' }),
        createdBy: bigint('created_by', { mode: 'number' }),
        updatedBy: bigint('updated_by', { mode: 'number' }),
        usedCount: integer('used_count').default(0).notNull(),
        helpfulCount: integer('helpful_count').default(0).notNull(),
        unhelpfulCount: integer('unhelpful_count').default(0).notNull(),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
        keywords: varchar({ length: 500 }),
        sourceUrl: varchar('source_url', { length: 500 }),
        dasarHukum: varchar('dasar_hukum', { length: 255 }),
        tanggalDasar: date('tanggal_dasar'),
        statusDasar: varchar('status_dasar', { length: 20 }).default('belum_diketahui').notNull(),
        digantiOleh: varchar('diganti_oleh', { length: 255 }),
    },
    (table) => [
        index().using('btree', table.status),
        foreignKey({
            columns: [table.knowledgeDocumentId],
            foreignColumns: [knowledgeDocuments.id],
            name: 'knowledge_articles_knowledge_document_id_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.createdBy],
            foreignColumns: [users.id],
            name: 'knowledge_articles_created_by_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.updatedBy],
            foreignColumns: [users.id],
            name: 'knowledge_articles_updated_by_foreign',
        }).onDelete('set null'),
    ],
);

export const referralEvents = pgTable(
    'referral_events',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        referralId: bigint('referral_id', { mode: 'number' }).notNull(),
        userId: bigint('user_id', { mode: 'number' }),
        actor: varchar({ length: 10 }).notNull(),
        type: varchar({ length: 30 }).notNull(),
        note: text(),
        // Default DB ini jam UTC (sesi DB ber-TimeZone UTC); Laravel & Next selalu mengisi created_at sendiri.
        createdAt: waktuWib('created_at')
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
    },
    (table) => [
        foreignKey({
            columns: [table.referralId],
            foreignColumns: [referrals.id],
            name: 'referral_events_referral_id_foreign',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: 'referral_events_user_id_foreign',
        }).onDelete('set null'),
    ],
);

export const accountActivations = pgTable(
    'account_activations',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        userId: bigint('user_id', { mode: 'number' }).notNull(),
        conversationId: bigint('conversation_id', { mode: 'number' }),
        createdBy: bigint('created_by', { mode: 'number' }),
        purpose: varchar({ length: 20 }).default('aktivasi').notNull(),
        tokenHash: varchar('token_hash', { length: 64 }).notNull(),
        expiresAt: waktuWib('expires_at').notNull(),
        usedAt: waktuWib('used_at'),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
    },
    (table) => [
        index().using('btree', table.conversationId, table.usedAt),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: 'account_activations_user_id_foreign',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.conversationId],
            foreignColumns: [chatConversations.id],
            name: 'account_activations_conversation_id_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.createdBy],
            foreignColumns: [users.id],
            name: 'account_activations_created_by_foreign',
        }).onDelete('set null'),
        unique('account_activations_token_hash_unique').on(table.tokenHash),
    ],
);

export const aiQualityRuns = pgTable(
    'ai_quality_runs',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        model: varchar({ length: 120 }),
        withModel: boolean('with_model').notNull(),
        passed: boolean(),
        retrievalHits: smallint('retrieval_hits').notNull(),
        retrievalTotal: smallint('retrieval_total').notNull(),
        classificationHits: smallint('classification_hits').notNull(),
        classificationTotal: smallint('classification_total').notNull(),
        unsourced: smallint().notNull(),
        failedCalls: smallint('failed_calls').notNull(),
        numberRejections: smallint('number_rejections').notNull(),
        medianMs: integer('median_ms'),
        p95Ms: integer('p95_ms'),
        failures: varchar({ length: 255 }),
        durationS: integer('duration_s').notNull(),
        createdAt: waktuWib('created_at'),
    },
    (table) => [index().using('btree', table.createdAt)],
);

export const knowledgePassages = pgTable(
    'knowledge_passages',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        knowledgeSourceId: bigint('knowledge_source_id', { mode: 'number' }).notNull(),
        url: varchar({ length: 1000 }),
        title: varchar({ length: 255 }),
        heading: varchar({ length: 255 }),
        page: integer(),
        body: text().notNull(),
        position: integer().default(0).notNull(),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
    },
    (table) => [
        foreignKey({
            columns: [table.knowledgeSourceId],
            foreignColumns: [knowledgeSources.id],
            name: 'knowledge_passages_knowledge_source_id_foreign',
        }).onDelete('cascade'),
    ],
);

export const aiCalls = pgTable(
    'ai_calls',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        task: varchar({ length: 40 }).notNull(),
        promptVersion: varchar('prompt_version', { length: 64 }),
        provider: varchar({ length: 120 }),
        model: varchar({ length: 120 }),
        status: varchar({ length: 16 }).notNull(),
        latencyMs: integer('latency_ms').notNull(),
        promptTokens: integer('prompt_tokens'),
        completionTokens: integer('completion_tokens'),
        conversationId: bigint('conversation_id', { mode: 'number' }),
        errorCode: varchar('error_code', { length: 40 }),
        createdAt: waktuWib('created_at'),
    },
    (table) => [
        index().using('btree', table.status, table.createdAt),
        index().using('btree', table.task, table.createdAt),
        foreignKey({
            columns: [table.conversationId],
            foreignColumns: [chatConversations.id],
            name: 'ai_calls_conversation_id_foreign',
        }).onDelete('set null'),
    ],
);

export const knowledgeSources = pgTable(
    'knowledge_sources',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        kind: varchar({ length: 20 }).notNull(),
        name: varchar({ length: 255 }).notNull(),
        url: varchar({ length: 1000 }),
        knowledgeDocumentId: bigint('knowledge_document_id', { mode: 'number' }),
        followLinks: boolean('follow_links').default(false).notNull(),
        isActive: boolean('is_active').default(true).notNull(),
        publicFile: boolean('public_file').default(true).notNull(),
        status: varchar({ length: 20 }).default('antre').notNull(),
        error: text(),
        pagesCount: integer('pages_count').default(0).notNull(),
        passagesCount: integer('passages_count').default(0).notNull(),
        usedCount: integer('used_count').default(0).notNull(),
        contentHash: varchar('content_hash', { length: 64 }),
        fetchedAt: waktuWib('fetched_at'),
        changedAt: waktuWib('changed_at'),
        createdBy: bigint('created_by', { mode: 'number' }),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
        dasarHukum: varchar('dasar_hukum', { length: 255 }),
        tanggalDasar: date('tanggal_dasar'),
        statusDasar: varchar('status_dasar', { length: 20 }).default('belum_diketahui').notNull(),
        digantiOleh: varchar('diganti_oleh', { length: 255 }),
    },
    (table) => [
        foreignKey({
            columns: [table.knowledgeDocumentId],
            foreignColumns: [knowledgeDocuments.id],
            name: 'knowledge_sources_knowledge_document_id_foreign',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.createdBy],
            foreignColumns: [users.id],
            name: 'knowledge_sources_created_by_foreign',
        }).onDelete('set null'),
        unique('knowledge_sources_knowledge_document_id_unique').on(table.knowledgeDocumentId),
    ],
);

export const units = pgTable(
    'units',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        code: varchar({ length: 30 }).notNull(),
        name: varchar({ length: 200 }).notNull(),
        shortName: varchar('short_name', { length: 60 }),
        parentId: bigint('parent_id', { mode: 'number' }),
        level: varchar({ length: 20 }).default('lainnya').notNull(),
        email: varchar({ length: 150 }),
        isActive: boolean('is_active').default(true).notNull(),
        sort: smallint()
            .default(sql`'0'`)
            .notNull(),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
    },
    (table) => [
        index().using('btree', table.parentId, table.sort),
        foreignKey({
            columns: [table.parentId],
            foreignColumns: [table.id],
            name: 'units_parent_id_foreign',
        }).onDelete('restrict'),
        unique('units_code_unique').on(table.code),
    ],
);

export const ticketDispositions = pgTable(
    'ticket_dispositions',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        ticketId: bigint('ticket_id', { mode: 'number' }).notNull(),
        unitId: bigint('unit_id', { mode: 'number' }).notNull(),
        assignedBy: bigint('assigned_by', { mode: 'number' }),
        acceptedBy: bigint('accepted_by', { mode: 'number' }),
        closedBy: bigint('closed_by', { mode: 'number' }),
        status: varchar({ length: 20 }).default('menunggu').notNull(),
        note: text(),
        dueAt: waktuWib('due_at'),
        acceptedAt: waktuWib('accepted_at'),
        closedAt: waktuWib('closed_at'),
        returnReason: text('return_reason'),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
    },
    (table) => [
        index().using('btree', table.ticketId, table.createdAt),
        index().using('btree', table.unitId, table.status),
        foreignKey({
            columns: [table.ticketId],
            foreignColumns: [tickets.id],
            name: 'ticket_dispositions_ticket_id_foreign',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.unitId],
            foreignColumns: [units.id],
            name: 'ticket_dispositions_unit_id_foreign',
        }).onDelete('restrict'),
        foreignKey({
            columns: [table.assignedBy],
            foreignColumns: [users.id],
            name: 'ticket_dispositions_assigned_by_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.acceptedBy],
            foreignColumns: [users.id],
            name: 'ticket_dispositions_accepted_by_foreign',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.closedBy],
            foreignColumns: [users.id],
            name: 'ticket_dispositions_closed_by_foreign',
        }).onDelete('set null'),
    ],
);

export const surveys = pgTable(
    'surveys',
    {
        id: bigserial({ mode: 'number' }).primaryKey().notNull(),
        ticketId: bigint('ticket_id', { mode: 'number' }).notNull(),
        rating: smallint(),
        comment: text(),
        createdAt: waktuWib('created_at'),
        updatedAt: waktuWib('updated_at'),
        version: smallint()
            .default(sql`'1'`)
            .notNull(),
        answers: json(),
        overall: smallint(),
        resolved: varchar({ length: 10 }),
        reuse: smallint(),
        goodFeedback: text('good_feedback'),
        improveFeedback: text('improve_feedback'),
        ageGroup: varchar('age_group', { length: 20 }),
        education: varchar({ length: 20 }),
        occupation: varchar({ length: 30 }),
        skmIndex: numeric('skm_index', { precision: 5, scale: 2 }),
    },
    (table) => [
        foreignKey({
            columns: [table.ticketId],
            foreignColumns: [tickets.id],
            name: 'surveys_ticket_id_foreign',
        }).onDelete('cascade'),
        unique('surveys_ticket_id_unique').on(table.ticketId),
    ],
);
