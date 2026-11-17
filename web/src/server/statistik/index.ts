import 'server-only';

import { log } from '@/server/log';
import { denganValkey, GalatValkey } from '@/server/valkey';

import { jendelaWib, persenSla, STATUS_TIKET, type StatistikPublik } from './hitung';
import { agregatTiket, kategoriTeratas, provinsiTeratas, semuaKanal } from './repo';

export type { JumlahPerNama, StatistikPublik } from './hitung';

// StatsService::PUBLIC_CACHE_KEY & PUBLIC_CACHE_TTL. Prefix `cc:` dipasang klien Valkey → cc:stats:public-overview,
// terpisah dari cache Laravel (prefix & format serialisasi berbeda).
const KUNCI_CACHE = 'stats:public-overview';
const TTL_DETIK = 60;

/** StatsService::computePublicOverview tanpa cache. `sekarang` dapat disuntik untuk test (Carbon::setTestNow). */
export async function hitungStatistikPublik(sekarang: Date = new Date()): Promise<StatistikPublik> {
    const [t, byCategory, byChannel, byProvince] = await Promise.all([
        agregatTiket(jendelaWib(sekarang)),
        kategoriTeratas(),
        semuaKanal(),
        provinsiTeratas(),
    ]);
    const byStatus = Object.fromEntries(STATUS_TIKET.map((s) => [s, t[s]])) as StatistikPublik['by_status'];
    return {
        total: STATUS_TIKET.reduce((n, s) => n + byStatus[s], 0),
        by_status: byStatus,
        by_province: byProvince,
        today: t.today,
        this_month: t.thisMonth,
        by_category: byCategory,
        by_channel: byChannel,
        sla_pct: persenSla(t.selesaiBerSla, t.tepatWaktu),
        ews: t.ews,
        // Channel::count(): by_channel memuat semua kanal tanpa filter, jadi jumlah barisnya sama (hemat satu query).
        kanal_count: byChannel.length,
    };
}

/**
 * Props `stats` halaman /tentang (StatsService::publicOverview): Cache::remember 60 detik di Valkey. Valkey mati atau
 * tidak dikonfigurasi → dihitung langsung dari DB tanpa menggagalkan halaman.
 */
export async function ambilStatistikPublik(sekarang: Date = new Date()): Promise<StatistikPublik> {
    let valkeyHidup = true;
    try {
        const tersimpan = await denganValkey((r) => r.get(KUNCI_CACHE));
        if (tersimpan !== null) return JSON.parse(tersimpan) as StatistikPublik;
    } catch (err) {
        // GalatValkey tidak dicatat per permintaan: valkey.ts mencatat putus sekali per gangguan. Galat lain (isi cache
        // rusak) dicatat, lalu cache ditimpa hasil baru.
        if (err instanceof GalatValkey) valkeyHidup = false;
        else log.warn({ err }, 'cache statistik publik tidak terbaca; dihitung dari DB');
    }
    const hasil = await hitungStatistikPublik(sekarang);
    // denganValkey membungkus semua galat sebagai GalatValkey → diabaikan (sama seperti di atas).
    if (valkeyHidup) await denganValkey((r) => r.set(KUNCI_CACHE, JSON.stringify(hasil), 'EX', TTL_DETIK)).catch(() => {});
    return hasil;
}
