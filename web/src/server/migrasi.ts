import 'server-only';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { PgBoss } from 'pg-boss';

import { ANTREAN, JADWAL, JADWAL_CC, SKEMA_PGBOSS } from './antrean';

// Migrasi tabel KHUSUS Next.js sebagai cc_migrate (DDL) lewat alias PgBouncer session pooling
// `contact_center_migrate`. Tanpa env.ts/log.ts: service `migrate` hanya menerima DATABASE_URL_MIGRATE.
// Tabel Laravel tidak disentuh (skema Laravel tetap acuan, dimuat uji/init.sh).
//  1. drizzle-cc/*.sql (cc_outbox, cc_idempotency) — dicatat di public.cc_migrasi; hak DML cc_app dari default
//     privileges cc_migrate di skema public (uji/init.sh, DB dev);
//  2. skema pg-boss (instal/upgrade versi) + antrean, lalu hak DML untuk cc_app di skema itu. Worker berjalan
//     sebagai cc_app dengan migrate:false, jadi tidak pernah butuh DDL.

const KEBIJAKAN_JADWAL = 'stately';

export interface OpsiMigrasi {
    url: string;
    folder: string;
    /** Skema tabel cc_* & catatan migrasi (bawaan public; test memakai skema per proses). */
    skema?: string;
    skemaBoss?: string;
    roleApp?: string;
    catat?: (pesan: string) => void;
}

const ident = (s: string) => {
    if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error(`nama SQL tidak sah: ${s}`);
    return `"${s}"`;
};

export async function terapkanMigrasi({
    url,
    folder,
    skema = 'public',
    skemaBoss = SKEMA_PGBOSS,
    roleApp = 'cc_app',
    catat = () => {},
}: OpsiMigrasi) {
    const pool = new pg.Pool({ connectionString: url, max: 1, application_name: 'cc-migrate', options: `-c search_path=${skema}` });
    try {
        await migrate(drizzle({ client: pool }), { migrationsFolder: folder, migrationsTable: 'cc_migrasi', migrationsSchema: skema });
        catat(`migrasi tabel cc_* di skema ${skema} selesai`);

        const boss = new PgBoss({
            connectionString: url,
            schema: skemaBoss,
            max: 1,
            application_name: 'cc-migrate',
            supervise: false,
            schedule: false,
        });
        boss.on('error', (e) => catat(`pg-boss: ${e.message}`));
        await boss.start();
        try {
            for (const nama of ANTREAN) if (!(await boss.getQueue(nama))) await boss.createQueue(nama);
            for (const { nama } of [...JADWAL, ...JADWAL_CC]) {
                if (!(await boss.getQueue(nama))) await boss.createQueue(nama, { policy: KEBIJAKAN_JADWAL });
            }
        } finally {
            await boss.stop({ graceful: false });
        }
        catat(`skema pg-boss ${skemaBoss} & antrean siap`);

        const s = ident(skemaBoss);
        const r = ident(roleApp);
        await pool.query(`GRANT USAGE ON SCHEMA ${s} TO ${r};
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${s} TO ${r};
            GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${s} TO ${r};
            GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${s} TO ${r};
            ALTER DEFAULT PRIVILEGES IN SCHEMA ${s} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${r};
            ALTER DEFAULT PRIVILEGES IN SCHEMA ${s} GRANT USAGE, SELECT ON SEQUENCES TO ${r};
            ALTER DEFAULT PRIVILEGES IN SCHEMA ${s} GRANT EXECUTE ON FUNCTIONS TO ${r};`);
        catat(`hak DML ${roleApp} di skema ${skemaBoss} diberikan`);
    } finally {
        await pool.end();
    }
}
