import { Card, CardContent } from '@/components/ui/card';
import PublicLayout from '@/layouts/public-layout';
import { Head } from '@inertiajs/react';
import { Building2, Download, Users } from 'lucide-react';

interface Props {
    stats: {
        total: number;
        today: number;
        this_month: number;
        by_status: Record<string, number>;
        by_category: { name: string; total: number }[];
        by_channel: { name: string; total: number }[];
        sla_pct: number;
    };
    regions: {
        id: number;
        code: string;
        name: string;
        province: string | null;
        infrastructure_status: string | null;
        kk_count: number;
    }[];
}

const DASAR_HUKUM = [
    'Undang-Undang Nomor 25 Tahun 2009 tentang Pelayanan Publik',
    'Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi',
    'Peraturan Menteri PANRB Nomor 62 Tahun 2018 tentang Pedoman SP4N',
    'Peraturan Menteri Transmigrasi tentang Penyelenggaraan Pelayanan Publik',
    'Peraturan Presiden tentang Program Transmigrasi 5T',
];

export default function Tentang({ stats, regions }: Props) {
    const channelTotal = stats.by_channel.reduce((sum, c) => sum + c.total, 0) || 1;

    return (
        <PublicLayout title="Data Terbuka">
            <Head title="Data Terbuka — SIGAP" />

            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
                <div className="mb-10 text-center">
                    <h1 className="text-primary mb-2 text-3xl font-bold">Data Terbuka SIGAP</h1>
                    <p className="text-gray-500">Transparansi Informasi Pelayanan Publik Kementerian Transmigrasi</p>
                    <p className="text-secondary mt-2 text-sm font-bold italic">"Komitmen Melayani, Menuntaskan Tanpa Henti"</p>
                </div>

                {/* SEC-HARIAN */}
                <section id="sec-harian" className="mb-10 scroll-mt-24">
                    <h2 className="mb-4 text-xl font-bold text-gray-800">Matriks Laporan Harian</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                            ['Laporan Masuk Hari Ini', stats.today, 'text-primary'],
                            ['Sedang Diproses', stats.by_status?.diproses ?? 0, 'text-amber-600'],
                            ['Selesai Ditangani', stats.by_status?.selesai ?? 0, 'text-emerald-600'],
                            ['Total Publik', stats.total, 'text-secondary'],
                        ].map(([label, value, color]) => (
                            <Card key={label as string} className="border-gray-100">
                                <CardContent className="p-6">
                                    <p className="mb-1 text-xs font-bold tracking-wide text-gray-400 uppercase">{label as string}</p>
                                    <p className={`text-3xl font-black ${color as string}`}>{value as number}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                {/* Top kategori harian */}
                <section className="mb-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card className="border-gray-100">
                        <CardContent className="p-6">
                            <h3 className="mb-4 font-bold text-gray-800">Top Kategori Keluhan</h3>
                            <ol className="space-y-3">
                                {stats.by_category.map((cat, idx) => (
                                    <li key={cat.name} className="flex items-center justify-between border-b border-gray-50 pb-2">
                                        <span className="text-sm text-gray-600">
                                            <span className="text-secondary mr-2 font-bold">{idx + 1}.</span>
                                            {cat.name}
                                        </span>
                                        <span className="text-primary text-sm font-bold">{cat.total} Laporan</span>
                                    </li>
                                ))}
                                {stats.by_category.length === 0 && <li className="text-sm text-gray-400 italic">Belum ada data kategori.</li>}
                            </ol>
                        </CardContent>
                    </Card>

                    {/* SEC-BULANAN */}
                    <Card id="sec-bulanan" className="scroll-mt-24 border-gray-100">
                        <CardContent className="p-6">
                            <h3 className="mb-4 font-bold text-gray-800">Matriks Laporan Bulanan</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-brand-soft/60 rounded-xl p-4 text-center">
                                    <p className="text-xs font-bold text-gray-400 uppercase">Total Bulan Ini</p>
                                    <p className="text-primary text-3xl font-black">{stats.this_month}</p>
                                </div>
                                <div className="bg-brand-soft/60 rounded-xl p-4 text-center">
                                    <p className="text-xs font-bold text-gray-400 uppercase">SLA Tepat Waktu</p>
                                    <p className="text-3xl font-black text-emerald-600">{stats.sla_pct}%</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Distribusi kanal */}
                <section className="mb-12">
                    <h3 className="mb-4 font-bold text-gray-800">Distribusi Kanal Pengaduan</h3>
                    <Card className="border-gray-100">
                        <CardContent className="overflow-x-auto p-0">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-5 py-3 text-left font-bold text-gray-600">Sumber Kanal</th>
                                        <th className="px-5 py-3 text-right font-bold text-gray-600">Jumlah</th>
                                        <th className="px-5 py-3 text-right font-bold text-gray-600">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.by_channel.map((ch) => (
                                        <tr key={ch.name} className="border-t border-gray-50">
                                            <td className="px-5 py-3 text-gray-700">{ch.name}</td>
                                            <td className="px-5 py-3 text-right font-bold text-gray-800">{ch.total}</td>
                                            <td className="px-5 py-3 text-right text-gray-500">{((ch.total / channelTotal) * 100).toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </section>

                {/* SEC-PETUGAS */}
                <section id="sec-petugas" className="mb-12 scroll-mt-24">
                    <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-800">
                        <Building2 className="text-primary h-5 w-5" /> Kawasan Transmigrasi
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {regions.map((r) => (
                            <Card key={r.id} className="border-gray-100">
                                <CardContent className="p-5">
                                    <p className="text-secondary text-xs font-bold">{r.code}</p>
                                    <h4 className="mb-1 font-bold text-gray-800">{r.name}</h4>
                                    <p className="text-xs text-gray-500">{r.province}</p>
                                    <div className="mt-3 flex items-center justify-between text-xs">
                                        <span className="bg-brand-soft text-primary rounded px-2 py-1 font-semibold">
                                            {r.infrastructure_status ?? '-'}
                                        </span>
                                        <span className="flex items-center gap-1 text-gray-500">
                                            <Users className="h-3 w-3" /> {r.kk_count} KK
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                {/* SEC-DASAR-HUKUM */}
                <section id="sec-dasar-hukum" className="scroll-mt-24">
                    <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-800">
                        <Download className="text-primary h-5 w-5" /> Landasan Hukum Layanan
                    </h3>
                    <ul className="space-y-2">
                        {DASAR_HUKUM.map((h) => (
                            <li key={h} className="rounded-lg border border-gray-100 bg-white px-5 py-3 text-sm text-gray-700">
                                {h}
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </PublicLayout>
    );
}
