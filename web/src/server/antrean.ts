// Antrean & jadwal pg-boss. Tanpa 'server-only' dan tanpa env: dipakai juga oleh CLI migrasi (src/cli/migrate.ts)
// yang membuat antrean sebagai cc_migrate.

/** Skema PostgreSQL milik pg-boss (terpisah dari tabel Laravel di public). */
export const SKEMA_PGBOSS = 'pgboss';

/** Antrean job umum (rencana §10.1, tanpa prefix): padanan antrean database Laravel `default` & `ai`, plus `ingest`. */
export const ANTREAN = ['default', 'ai', 'ingest'] as const;
export type NamaAntrean = (typeof ANTREAN)[number];

/** Zona jadwal = APP_TIMEZONE produksi Laravel (deploy/docker/.env.example). */
export const ZONA_JADWAL = 'Asia/Jakarta';

export interface Jadwal {
    /** Nama antrean pg-boss = nama perintah Laravel tanpa prefix `sigap:`. */
    nama: string;
    /** Ekspresi cron (menit jam tgl bln hari) di ZONA_JADWAL; tidak diisi bila `setiapDetik`. */
    cron?: string;
    /** Jadwal di bawah satu menit (cron pg-boss per menit): dikirim worker tiap N detik, satu job per slot. */
    setiapDetik?: number;
    /** Sumber Laravel. */
    laravel: string;
}

/**
 * Jadwal Laravel (sigap/bootstrap/app.php:27-51; routes/console.php tanpa jadwal, app/Console/Kernel.php tidak ada).
 * Semua `withoutOverlapping()` → antrean berkebijakan `stately` (maks 1 menunggu + 1 berjalan). Jadwal yang
 * terlewat saat worker mati tidak dikejar (pg-boss `missed: 'skip'`), sama dengan scheduler Laravel.
 * Isi job masih TODO: diport di slice pemiliknya; sampai itu handler hanya mencatat log.
 */
export const JADWAL: readonly Jadwal[] = [
    { nama: 'sync-channels', cron: '0 6 * * *', laravel: "app.php:29 sigap:sync-channels dailyAt('06:00')" },
    { nama: 'ews-check', cron: '0 7 * * *', laravel: "app.php:30 sigap:ews-check dailyAt('07:00')" },
    { nama: 'pengingat-survei', cron: '0 9 * * *', laravel: "app.php:31 sigap:pengingat-survei dailyAt('09:00')" },
    // between('8:00','17:00') inklusif: jam 08.00 s.d. 17.00, Senin–Jumat.
    { nama: 'pantau-rujukan', cron: '0 8-17 * * 1-5', laravel: "app.php:32 sigap:pantau-rujukan weekdays()->hourly()->between('8:00','17:00')" },
    { nama: 'cek-portal', cron: '0 * * * *', laravel: 'app.php:33 sigap:cek-portal hourly()' },
    { nama: 'ai-macet', setiapDetik: 15, laravel: 'app.php:36 sigap:ai-macet everyFifteenSeconds()' },
    { nama: 'sinkron-sumber', cron: '0 2 * * 1', laravel: "app.php:38 sigap:sinkron-sumber weeklyOn(1, '02:00')" },
    // when(): hanya bila AI aktif dan driver bukan `fake` — dicek di handler saat diport.
    { nama: 'uji-asisten', cron: '0 3 * * 1', laravel: "app.php:42-45 sigap:uji-asisten weeklyOn(1, '03:00') when(AI aktif)" },
    { nama: 'model-prune', cron: '0 2 * * *', laravel: "app.php:48-50 model:prune ChatConversation, ActivityLog, AiCall dailyAt('02:00')" },
];

/** Jadwal khusus Next.js (bukan port Laravel): pembersihan outbox terkirim & idempotency key kedaluwarsa. */
export const JADWAL_CC: readonly Jadwal[] = [{ nama: 'cc-bersih', cron: '17 * * * *', laravel: '— (khusus Next.js)' }];
