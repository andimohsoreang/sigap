import { keWib } from '@/server/db/kolom';

// Bagian murni StatsService::publicOverview (sigap/app/Services/StatsService.php): tipe, jendela waktu WIB, dan
// pembulatan persen SLA. Query ada di ./repo, cache di ./index.

/** Urutan kasus TicketStatus (app/Enums/TicketStatus.php) = urutan kunci `by_status`. */
export const STATUS_TIKET = ['baru', 'verifikasi', 'diproses', 'selesai', 'ditolak'] as const;
export type StatusTiket = (typeof STATUS_TIKET)[number];

/** Status berjalan untuk EWS (StatsService::overdueCount). */
export const STATUS_BERJALAN = ['baru', 'verifikasi', 'diproses'] as const satisfies readonly StatusTiket[];

export type JumlahPerNama = { name: string; total: number };

/** Props `stats` halaman /tentang; urutan kunci sama dengan array yang dikembalikan computePublicOverview. */
export interface StatistikPublik {
    total: number;
    by_status: Record<StatusTiket, number>;
    /** Top 6 provinsi (tanpa provinsi kosong). */
    by_province: JumlahPerNama[];
    today: number;
    this_month: number;
    /** Top 5 kategori, termasuk kategori tanpa tiket (total 0). */
    by_category: JumlahPerNama[];
    /** Semua kanal. */
    by_channel: JumlahPerNama[];
    /** Persen tiket selesai tepat waktu, 1 desimal; 100 bila belum ada tiket selesai ber-SLA. */
    sla_pct: number;
    ews: number;
    kanal_count: number;
}

/** Batas waktu sebagai jam dinding WIB 'Y-m-d H:i:s', persis binding Carbon Laravel (APP_TIMEZONE=Asia/Jakarta). */
export interface Jendela {
    sekarang: string;
    awalHari: string;
    akhirHari: string;
    awalBulan: string;
    akhirBulan: string;
}

/**
 * now()->startOfDay()/endOfDay()/startOfMonth()/endOfMonth(), diformat Connection::prepareBindings ('Y-m-d H:i:s'):
 * mikrodetik endOf* (23:59:59.999999) terpotong menjadi 23:59:59, `sekarang` terpotong ke detik.
 */
export function jendelaWib(sekarang: Date): Jendela {
    const s = keWib(sekarang);
    const [tahun, bulan] = s.slice(0, 7).split('-').map(Number);
    // Hari ke-0 bulan berikutnya = hari terakhir bulan ini.
    const hariTerakhir = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
    return {
        sekarang: s,
        awalHari: `${s.slice(0, 10)} 00:00:00`,
        akhirHari: `${s.slice(0, 10)} 23:59:59`,
        awalBulan: `${s.slice(0, 7)}-01 00:00:00`,
        akhirBulan: `${s.slice(0, 7)}-${String(hariTerakhir).padStart(2, '0')} 23:59:59`,
    };
}

/**
 * round($nilai, 1) PHP 8.4 (mode HALF_UP): bilangan bulat bawah dipulihkan bila galat floating point menurunkannya,
 * lalu dibandingkan dengan titik tengah desimal sebagai double. Diuji sama dengan PHP untuk semua pasangan
 * m/f*100 (f ≤ 2000) dan 2 juta pasangan acak (f ≤ 5·10⁷); Math.round(v*10)/10 berbeda (mis. 9/2000 → 0.4 vs 0.5).
 */
export function bulatSatuDesimal(nilai: number): number {
    if (!Number.isFinite(nilai) || nilai === 0) return nilai;
    let bulat = Math.floor(nilai * 10);
    if ((bulat + 1) / 10 === nilai) bulat += 1;
    if (nilai >= (bulat + 0.5) / 10) bulat += 1;
    return bulat / 10;
}

/** StatsService::slaPercentage: tepat/selesai*100 (urutan operasi sama dengan PHP), 100 bila belum ada yang selesai. */
export function persenSla(selesai: number, tepat: number): number {
    return selesai === 0 ? 100 : bulatSatuDesimal((tepat / selesai) * 100);
}
