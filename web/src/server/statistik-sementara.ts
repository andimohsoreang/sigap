import 'server-only';

// SEMENTARA — dihapus saat s1/statistik (programmer 2) digabung: ganti impor di app/(publik)/tentang/page.tsx menjadi
// '@/server/statistik', lalu hapus berkas ini. Signature & tipe = web/src/server/statistik/index.ts di branch itu
// (StatsService::publicOverview Laravel). Isi nol hanya agar halaman bisa dirakit & dirender sebelum penggabungan.

export type JumlahPerNama = { name: string; total: number };

export interface StatistikPublik {
    total: number;
    by_status: Record<'baru' | 'verifikasi' | 'diproses' | 'selesai' | 'ditolak', number>;
    by_province: JumlahPerNama[];
    today: number;
    this_month: number;
    by_category: JumlahPerNama[];
    by_channel: JumlahPerNama[];
    sla_pct: number;
    ews: number;
    kanal_count: number;
}

export async function ambilStatistikPublik(sekarang?: Date): Promise<StatistikPublik> {
    void sekarang;
    return {
        total: 0,
        by_status: { baru: 0, verifikasi: 0, diproses: 0, selesai: 0, ditolak: 0 },
        by_province: [],
        today: 0,
        this_month: 0,
        by_category: [],
        by_channel: [],
        sla_pct: 100,
        ews: 0,
        kanal_count: 0,
    };
}
