// Migrasi tabel khusus Next.js + skema pg-boss (service compose `migrate`, sekali jalan): `node dist/migrate.js`.
// Hanya membaca DATABASE_URL_MIGRATE (cc_migrate lewat alias session pooling); tanpa env.ts agar tidak menuntut
// rahasia aplikasi. Folder migrasi: drizzle-cc/ di sebelah dist/ (image: /app/drizzle-cc).
import path from 'node:path';

import { terapkanMigrasi } from '@/server/migrasi';

const url = process.env.DATABASE_URL_MIGRATE;
if (!url) {
    console.error('DATABASE_URL_MIGRATE wajib diisi');
    process.exit(2);
}

try {
    await terapkanMigrasi({
        url,
        folder: process.env.CC_MIGRASI_DIR ?? path.join(import.meta.dirname, '..', 'drizzle-cc'),
        catat: (pesan) => console.log(JSON.stringify({ level: 'info', service: 'contact-center-migrate', msg: pesan })),
    });
} catch (e) {
    // Pesan galat pg tidak memuat sandi; URL koneksi tidak pernah dicetak.
    console.error(
        JSON.stringify({ level: 'error', service: 'contact-center-migrate', msg: (e as Error).message, code: (e as { code?: string }).code }),
    );
    process.exit(1);
}
