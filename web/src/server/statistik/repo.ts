import 'server-only';

import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { categories, channels, tickets } from '@/server/db/schema';

import { STATUS_BERJALAN, STATUS_TIKET, type Jendela, type JumlahPerNama, type StatusTiket } from './hitung';

// Query StatsService::computePublicOverview. Ticket::scopePublic + SoftDeletes = semua query tiket di bawah.
const publik = and(eq(tickets.isInternal, false), isNull(tickets.deletedAt));
const hitungBila = (kondisi: ReturnType<typeof sql>) => sql`count(*) filter (where ${kondisi})`.mapWith(Number);

/**
 * statusCounts + todayCount + thisMonthCount + slaPercentage + overdueCount dalam SATU pemindaian tiket publik
 * (Laravel: 5 query terpisah dengan WHERE yang sama ditambah syarat masing-masing). Hasil identik:
 * - status di luar TicketStatus tidak masuk by_status/total, tetapi tetap terhitung di today/this_month;
 * - `resolved_at <= sla_due_at` bernilai NULL bila resolved_at kosong → tidak dihitung tepat (CASE … ELSE 0 Laravel);
 * - `sla_due_at < sekarang` sudah menyiratkan sla_due_at NOT NULL.
 */
export async function agregatTiket(j: Jendela) {
    const perStatus = Object.fromEntries(STATUS_TIKET.map((s) => [s, hitungBila(sql`${tickets.status} = ${s}`)])) as Record<
        StatusTiket,
        ReturnType<typeof hitungBila>
    >;
    const selesaiBerSla = sql`${tickets.status} = 'selesai' and ${tickets.slaDueAt} is not null`;
    const [baris] = await db
        .select({
            ...perStatus,
            today: hitungBila(sql`${tickets.createdAt} between ${j.awalHari} and ${j.akhirHari}`),
            thisMonth: hitungBila(sql`${tickets.createdAt} between ${j.awalBulan} and ${j.akhirBulan}`),
            selesaiBerSla: hitungBila(selesaiBerSla),
            tepatWaktu: hitungBila(sql`${selesaiBerSla} and ${tickets.resolvedAt} <= ${tickets.slaDueAt}`),
            ews: hitungBila(
                sql`${tickets.status} in (${sql.join(
                    STATUS_BERJALAN.map((s) => sql`${s}`),
                    sql`, `,
                )}) and ${tickets.slaDueAt} < ${j.sekarang}`,
            ),
        })
        .from(tickets)
        .where(publik);
    return baris;
}

// Bentuk query withCount Laravel dipertahankan (subquery berkorelasi, ORDER BY total DESC tanpa pemecah seri): urutan
// baris yang totalnya sama ditentukan rencana eksekusi PostgreSQL, jadi query yang sama memberi urutan yang sama.
// Kolom korelasi ditulis lengkap: di select satu tabel Drizzle mencetak kolom tanpa nama tabel ("id" = tickets.id).
function jumlahTiketPer(induk: 'categories' | 'channels', fk: 'category_id' | 'channel_id') {
    return sql<number>`(select count(*) from ${tickets} where ${sql.identifier(induk)}."id" = ${tickets}.${sql.identifier(fk)} and ${publik})`
        .mapWith(Number)
        .as('total');
}

/** Category::withCount(tickets publik)->orderByDesc('total')->limit(5). */
export function kategoriTeratas(): Promise<JumlahPerNama[]> {
    const total = jumlahTiketPer('categories', 'category_id');
    return db.select({ name: categories.name, total }).from(categories).orderBy(desc(total)).limit(5);
}

/** Channel::withCount(tickets publik)->orderByDesc('total'), semua kanal. */
export function semuaKanal(): Promise<JumlahPerNama[]> {
    const total = jumlahTiketPer('channels', 'channel_id');
    return db.select({ name: channels.name, total }).from(channels).orderBy(desc(total));
}

/** Top 6 provinsi tiket publik (province NOT NULL), GROUP BY province ORDER BY total DESC. */
export function provinsiTeratas(): Promise<JumlahPerNama[]> {
    const total = sql<number>`count(*)`.mapWith(Number).as('total');
    return db
        .select({ name: sql<string>`${tickets.province}`, total })
        .from(tickets)
        .where(and(publik, isNotNull(tickets.province)))
        .groupBy(tickets.province)
        .orderBy(desc(total))
        .limit(6);
}
