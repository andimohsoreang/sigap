import { defineConfig } from 'drizzle-kit';

// Migrasi tabel KHUSUS Next.js (src/server/db/schema-cc.ts) → drizzle-cc/. Hanya `generate` (tanpa koneksi DB);
// diterapkan oleh src/cli/migrate.ts sebagai cc_migrate. Tabel Laravel tetap lewat drizzle.config.ts (pull).
export default defineConfig({
    dialect: 'postgresql',
    out: './drizzle-cc',
    schema: './src/server/db/schema-cc.ts',
});
