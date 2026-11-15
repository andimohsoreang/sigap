import 'server-only';

import { PgBoss, type ConstructorOptions } from 'pg-boss';

import { SKEMA_PGBOSS } from '@/server/antrean';

/**
 * pg-boss untuk worker, aman lewat PgBouncer mode transaksi (alias contact_center_worker):
 * - useListenNotify false (bawaan): LISTEN butuh koneksi sesi; worker memakai polling;
 * - kunci advisory pg-boss hanya pg_advisory_xact_lock di dalam transaksi (aman di mode transaksi);
 *   kunci advisory sesi & DDL hanya saat instal/upgrade skema → `migrate` (cc_migrate, alias session pooling);
 * - migrate:false — cc_app hanya DML; reindex & persistQueueStats mati karena keduanya DDL
 *   (REINDEX CONCURRENTLY, partisi queue_stats).
 */
export function opsiBoss(url: string, opsi: Partial<ConstructorOptions> = {}): ConstructorOptions {
    return {
        connectionString: url,
        schema: SKEMA_PGBOSS,
        migrate: false,
        useListenNotify: false,
        reindex: false,
        persistQueueStats: false,
        ...opsi,
    };
}

export const buatBoss = (url: string, opsi?: Partial<ConstructorOptions>) => new PgBoss(opsiBoss(url, opsi));
