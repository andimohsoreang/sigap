import 'server-only';

import type { PgBoss } from 'pg-boss';

import { JADWAL, JADWAL_CC, ZONA_JADWAL, type Jadwal } from '@/server/antrean';
import { bersihkanSesi } from '@/server/auth/sesi';
import { db } from '@/server/db/client';
import { bersihkanIdempotensi } from '@/server/idempotensi';
import { log } from '@/server/log';
import { bersihkanOutbox } from '@/server/outbox';

// Runner cron: jadwal Laravel didaftarkan ke pg-boss (satu pemilik per jadwal, aman untuk beberapa worker).
// Isi job port Laravel masih TODO (slice pemiliknya); hanya cc-bersih yang benar-benar bekerja.

const ISI: Record<string, () => Promise<unknown>> = {
    'cc-bersih': async () => ({
        outbox: await bersihkanOutbox(db),
        idempotensi: await bersihkanIdempotensi(db),
        // Sesi cc_session kedaluwarsa (padanan lottery GC sesi database Laravel).
        sesi: await bersihkanSesi(db),
    }),
};

async function jalankan(j: Jadwal) {
    const isi = ISI[j.nama];
    if (!isi) {
        // TODO(slice pemilik): port perintah Laravel (j.laravel). Belum ada logika bisnis yang dijalankan.
        log.debug({ jadwal: j.nama }, 'jadwal belum di-port; dilewati');
        return;
    }
    log.info({ jadwal: j.nama, hasil: await isi() }, 'jadwal selesai');
}

/** Daftarkan jadwal + worker-nya. Mengembalikan penghenti timer jadwal sub-menit. */
export async function pasangJadwal(boss: PgBoss, daftar: readonly Jadwal[] = [...JADWAL, ...JADWAL_CC]): Promise<() => void> {
    const nama = new Set(daftar.map((j) => j.nama));
    // Jadwal yang tidak ada di kode (dihapus, atau berkunci lain) tidak boleh terus mengirim job.
    for (const s of await boss.getSchedules()) if (!nama.has(s.name) || s.key !== '') await boss.unschedule(s.name, s.key);

    const timer: NodeJS.Timeout[] = [];
    for (const j of daftar) {
        if (j.cron) await boss.schedule(j.nama, j.cron, null, { tz: ZONA_JADWAL });
        else {
            await boss.unschedule(j.nama);
            // Satu job per slot N detik walau ada beberapa worker (singletonSeconds); antrean stately menolak tumpukan.
            const kirim = () =>
                boss
                    .send(j.nama, null, { singletonKey: j.nama, singletonSeconds: j.setiapDetik })
                    .catch((err) => log.warn({ err, jadwal: j.nama }, 'gagal mengirim jadwal'));
            timer.push(setInterval(kirim, j.setiapDetik! * 1000));
        }
        // Jadwal tidak butuh latensi detik: cron cukup diperiksa tiap 30 dtk (bawaan pg-boss 2 dtk = ±1,5 query/dtk per
        // antrean menganggur). Jadwal sub-menit (ai-macet, slot 15 dtk) tiap 5 dtk, jadi tetap berjalan di slotnya.
        await boss.work(j.nama, { pollingIntervalSeconds: j.setiapDetik ? 5 : 30 }, async () => jalankan(j));
    }
    return () => timer.forEach(clearInterval);
}
