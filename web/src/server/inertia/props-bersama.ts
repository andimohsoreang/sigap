import 'server-only';

import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, or, sql, sum } from 'drizzle-orm';

import { APP_NAME } from '@/lib/judul';
import type { DataSesi } from '@/server/auth/kilat';
import { adalahAdmin, type Pengguna } from '@/server/auth/peran';
import { db, type Db } from '@/server/db/client';
import { keWib } from '@/server/db/kolom';
import { chatConversations, referrals, users } from '@/server/db/schema';
import { env } from '@/server/env';

// Props bersama = sigap/app/Http/Middleware/HandleInertiaRequests::share (+ `errors` dari Inertia\Middleware::share),
// urutan kunci & bentuk JSON sama. Dibandingkan dengan Laravel asli di tests/unit/db/props-bersama.test.ts.

export interface PenggunaInertia {
    id: number;
    name: string;
    username: string | null;
    role: string;
    is_admin: boolean;
}

export interface MenungguPetugas {
    id: number;
    nama: string;
    cuplikan: string | null;
    sejak: string | null;
}

export interface PropsBersama {
    errors: Record<string, string>;
    name: string;
    app: { brand: string; tagline: string; ministry: string };
    auth: { user: PenggunaInertia | null };
    chat_unread: number | null;
    chat_waiting: MenungguPetugas[] | null;
    rujukan_perlu: number | null;
    recaptcha: { site_key: string | null };
    assistant: { enabled: boolean; service_hours: string };
    flash: { status: unknown; success: unknown; error: unknown };
}

/** Carbon::toIso8601String() dengan APP_TIMEZONE Asia/Jakarta. */
const iso8601Wib = (w: Date | null) => (w === null ? null : `${keWib(w).replace(' ', 'T')}+07:00`);

/** ChatConversation::waitingForStaff(5). */
async function menungguPetugas(d: Db): Promise<MenungguPetugas[]> {
    const c = chatConversations;
    const baris = await d
        .select({ id: c.id, namaUser: users.name, namaTamu: c.guestName, cuplikan: c.aiSummary, handoffAt: c.handoffAt, terakhir: c.lastMessageAt })
        .from(c)
        .leftJoin(users, eq(users.id, c.userId))
        .where(and(isNull(c.closedAt), eq(c.handledBy, 'petugas'), or(isNotNull(c.handoffAt), gt(c.unreadAdmin, 0))))
        .orderBy(asc(sql`COALESCE(${c.handoffAt}, ${c.lastMessageAt})`))
        .limit(5);
    return baris.map((b) => ({
        id: b.id,
        nama: b.namaUser ?? b.namaTamu ?? 'Tamu',
        cuplikan: b.cuplikan,
        sejak: iso8601Wib(b.handoffAt ?? b.terakhir),
    }));
}

/** Referral::query()->needsAction()->where('assigned_to', $id)->count(). */
async function rujukanPerlu(d: Db, idAdmin: number, sekarang: Date): Promise<number> {
    const r = referrals;
    const [{ n }] = await d
        .select({ n: sql<number>`count(*)::int` })
        .from(r)
        .where(
            and(
                inArray(r.status, ['dirujuk', 'dibuka', 'butuh_bantuan']),
                or(eq(r.status, 'butuh_bantuan'), lt(r.followUpDueAt, sekarang)),
                eq(r.assignedTo, idAdmin),
            ),
        );
    return n;
}

/** `$request->session()->get($kunci)`: null bila tidak ada. */
const dariSesi = (data: DataSesi | null, kunci: string) => (data && Object.hasOwn(data, kunci) ? (data[kunci] ?? null) : null);

/**
 * Props bersama untuk pengguna & data sesi permintaan ini. Bagian admin (badge chat & rujukan) hanya di-query untuk
 * admin, seperti closure lazy Laravel.
 */
export async function hitungPropsBersama(pengguna: Pengguna | null, sesi: DataSesi | null, d: Db = db, sekarang = new Date()): Promise<PropsBersama> {
    // Galat validasi Laravel (ViewErrorBag di sesi `errors`) belum punya padanan: formulir pertama yang memindahkan
    // pola redirect-back wajib menambahkannya di sini.
    if (sesi && Object.hasOwn(sesi, 'errors')) throw new Error('props bersama: sesi `errors` belum didukung');
    const admin = pengguna !== null && adalahAdmin(pengguna);
    const [unread, menunggu, perlu] = admin
        ? await Promise.all([
              d.select({ n: sum(chatConversations.unreadAdmin) }).from(chatConversations),
              menungguPetugas(d),
              rujukanPerlu(d, pengguna.id, sekarang),
          ])
        : [null, null, null];

    return {
        errors: {},
        name: APP_NAME,
        app: {
            brand: 'Contact Center',
            tagline: 'Inisiatif Gerak Aksi, Penyelesaian Tuntas',
            ministry: 'Kementerian Transmigrasi Republik Indonesia',
        },
        auth: {
            user: pengguna
                ? { id: pengguna.id, name: pengguna.name, username: pengguna.username, role: pengguna.role, is_admin: adalahAdmin(pengguna) }
                : null,
        },
        // (int) sum(): SUM kosong → 0.
        chat_unread: unread ? Number(unread[0]?.n ?? 0) : null,
        chat_waiting: menunggu,
        rujukan_perlu: perlu,
        recaptcha: { site_key: env.RECAPTCHA_SITE_KEY ?? null },
        assistant: { enabled: env.AI_ENABLED, service_hours: env.AI_SERVICE_LABEL },
        flash: { status: dariSesi(sesi, 'status'), success: dariSesi(sesi, 'success'), error: dariSesi(sesi, 'error') },
    };
}
