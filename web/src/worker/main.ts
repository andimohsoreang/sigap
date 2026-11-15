// Proses worker Contact Center (contact-center-worker): pg-boss (antrean & jadwal) + dispatcher outbox.
// Dibundel ke dist/worker.js (scripts/bangun-worker.mjs), image yang sama dengan web; compose: `node dist/worker.js`
// dengan DATABASE_URL = alias PgBouncer contact_center_worker, DB_POOL_MAX=3.
import { setTimeout as tidur } from 'node:timers/promises';

import { db, tutupDb } from '@/server/db/client';
import { env } from '@/server/env';
import { log } from '@/server/log';
import { kirimOutbox } from '@/server/outbox';
import { terbitkan } from '@/server/realtime/penerbit';
import { tutupValkey } from '@/server/valkey';

import { buatBoss } from './boss';
import { pasangJadwal } from './jadwal';

// Di bawah stop_grace_period worker (60 dtk) sebelum Docker mengirim SIGKILL.
const BATAS_BERHENTI_MS = 50_000;
const JEDA_OUTBOX_MS = 1_000;

if (!env.DATABASE_URL) throw new Error('DATABASE_URL wajib untuk worker');

const boss = buatBoss(env.DATABASE_URL, { max: env.DB_POOL_MAX, application_name: `${env.DB_APP_NAME}-boss` });
boss.on('error', (err) => log.error({ err }, 'pg-boss galat'));
boss.on('warning', (w) => log.warn({ peringatan: w.message }, 'pg-boss peringatan'));

let berhenti = false;
const henti = new AbortController();

async function putarOutbox() {
    const penerbit = { job: (antrean: string, data: object, id: string) => boss.send(antrean, data, { id }), realtime: terbitkan };
    while (!berhenti) {
        try {
            // Batch penuh → langsung ambil lagi; kosong → tunggu sebentar (polling; LISTEN tidak lewat PgBouncer).
            if ((await kirimOutbox(db, penerbit)) > 0) continue;
        } catch (err) {
            log.error({ err }, 'dispatcher outbox gagal');
        }
        await tidur(JEDA_OUTBOX_MS, undefined, { signal: henti.signal }).catch(() => {});
    }
}

await boss.start();
const hentiJadwal = await pasangJadwal(boss);
const outbox = putarOutbox();
log.info('worker berjalan');

async function matikan(sinyal: string) {
    if (berhenti) return;
    berhenti = true;
    log.info({ sinyal }, 'worker berhenti: menyelesaikan job berjalan');
    setTimeout(() => {
        log.error('worker tidak berhenti tepat waktu; keluar paksa');
        process.exit(1);
    }, BATAS_BERHENTI_MS).unref();
    hentiJadwal();
    henti.abort();
    await outbox;
    // graceful: job aktif diberi waktu selesai, setelah itu digagalkan agar diulang worker lain.
    await boss.stop({ graceful: true, timeout: BATAS_BERHENTI_MS - 10_000 });
    await Promise.allSettled([tutupDb(), tutupValkey()]);
    log.info('worker selesai');
    process.exit(0);
}

process.on('SIGTERM', () => void matikan('SIGTERM'));
process.on('SIGINT', () => void matikan('SIGINT'));
