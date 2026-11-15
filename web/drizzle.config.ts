import { defineConfig } from 'drizzle-kit';

// Hanya untuk `drizzle-kit pull` (cc_migrate); runtime memakai DATABASE_URL (cc_app) di src/server/db/client.ts.
// Tabel framework Laravel tidak ditarik: Next.js memakai sesi/antrean/cache sendiri (paket F & G).
export default defineConfig({
    dialect: 'postgresql',
    out: process.env.DRIZZLE_OUT ?? './drizzle',
    schema: './src/server/db/schema.ts',
    dbCredentials: { url: process.env.DATABASE_URL_MIGRATE ?? 'postgres://cc_migrate@127.0.0.1:5432/contact_center_dev' },
    schemaFilter: ['public'],
    tablesFilter: [
        '*',
        '!cache',
        '!cache_locks',
        '!jobs',
        '!job_batches',
        '!failed_jobs',
        '!password_reset_tokens',
        '!personal_access_tokens',
        '!sessions',
        '!migrations',
    ],
});
