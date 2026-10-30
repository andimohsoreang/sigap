import { Link } from '@inertiajs/react';
import {
    ArrowRight,
    AtSign,
    ChartColumn,
    CircleCheck,
    Database,
    FilePenLine,
    HandCoins,
    House,
    Inbox,
    Landmark,
    Loader,
    type LucideIcon,
    Megaphone,
    MessageCircle,
    RefreshCw,
    Route,
    Scale,
    ShieldCheck,
    Sprout,
    Tag,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import TaraPage, { AskTaraCard, TaraEyebrow } from '@/components/sigap/tara-shell';
import { statusLabel } from '@/lib/sigap';
import { cn } from '@/lib/utils';

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

const STATUS_ORDER: { key: string; color: string }[] = [
    { key: 'baru', color: '#0b5fa5' },
    { key: 'verifikasi', color: '#003d68' },
    { key: 'diproses', color: '#c29642' },
    { key: 'selesai', color: '#0d7a5f' },
    { key: 'ditolak', color: '#b42318' },
];

function categoryIcon(name: string): LucideIcon {
    const n = name.toLowerCase();
    if (n.includes('infrastruktur') || n.includes('jalan')) return Route;
    if (n.includes('lahan') || n.includes('tanah')) return Sprout;
    if (n.includes('bantuan') || n.includes('sosial')) return HandCoins;
    if (n.includes('data') || n.includes('tik')) return Database;
    return Tag;
}

function channelIcon(name: string): LucideIcon {
    const n = name.toLowerCase();
    if (n.includes('chat') || n.includes('tara')) return MessageCircle;
    if (n.includes('formulir') || n.includes('web')) return FilePenLine;
    if (n.startsWith('@') || n.includes('instagram') || n.includes('media')) return AtSign;
    if (n.includes('kantor') || n.includes('loket')) return Landmark;
    if (n.includes('whistle') || n.includes('inspektorat')) return ShieldCheck;
    return Megaphone;
}

function statusTone(status: string | null): string {
    const s = (status ?? '').toLowerCase();
    if (s.includes('memadai') || s.includes('baik')) return 'bg-[#e7f4ef] text-[#0d7a5f]';
    if (s.includes('berkembang') || s.includes('sedang')) return 'bg-[#fdf3e1] text-[#9a5b00]';
    if (s.includes('kurang') || s.includes('rusak')) return 'bg-[#fdecea] text-[#b42318]';
    return 'bg-[#eef1f4] text-[#4a5868]';
}

const nf = (n: number) => n.toLocaleString('id-ID');

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
    return <div className={cn('rounded-[20px] border border-[#e8edf2] bg-white p-6 sm:p-7', className)}>{children}</div>;
}

export default function Tentang({ stats, regions }: Props) {
    // Angka dihitung saat halaman diminta; waktu ditampilkan di sisi browser (zona waktu pengguna).
    const [now, setNow] = useState<string | null>(null);
    useEffect(() => {
        setNow(
            new Date().toLocaleString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            }),
        );
    }, []);

    const statusTotal = STATUS_ORDER.reduce((s, x) => s + (stats.by_status?.[x.key] ?? 0), 0);
    const categories = [...stats.by_category].sort((a, b) => b.total - a.total).slice(0, 6);
    const maxCategory = Math.max(1, ...categories.map((c) => c.total));
    const channels = [...stats.by_channel].sort((a, b) => b.total - a.total);
    const channelTotal = channels.reduce((s, c) => s + c.total, 0);
    const totalKk = regions.reduce((s, r) => s + r.kk_count, 0);

    const kpis: { icon: LucideIcon; label: string; value: number; hint: string; tone: string }[] = [
        { icon: Inbox, label: 'Laporan masuk hari ini', value: stats.today, hint: 'Dari semua kanal', tone: 'text-[#003d68]' },
        { icon: Loader, label: 'Sedang diproses', value: stats.by_status?.diproses ?? 0, hint: 'Ditangani petugas kawasan', tone: 'text-[#9a5b00]' },
        {
            icon: CircleCheck,
            label: 'Selesai ditangani',
            value: stats.by_status?.selesai ?? 0,
            hint: 'Warga diminta mengisi survei',
            tone: 'text-[#0d7a5f]',
        },
        { icon: ChartColumn, label: 'Total laporan publik', value: stats.total, hint: 'Sejak layanan dibuka', tone: 'text-[#9a7330]' },
    ];

    return (
        <TaraPage
            title="Data Terbuka"
            description="Data terbuka pelayanan pengaduan Kementerian Transmigrasi: laporan harian, status penanganan, kategori, kanal, dan kawasan."
            active="data"
            eyebrow="Data Terbuka"
            heading="Data Terbuka Contact Center"
            subtitle="Transparansi pelayanan pengaduan Kementerian Transmigrasi. Angka diperbarui otomatis dari sistem, tanpa data pribadi pelapor."
            pose="tablet"
            poseAlt="TARA memegang tablet berisi data layanan"
        >
            <div className="mx-auto flex max-w-[1312px] flex-col gap-12 px-4 py-12 sm:px-6 lg:gap-14 lg:px-16 lg:py-14">
                <p className="flex items-center gap-2 text-sm font-medium text-[#0d7a5f]">
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Diperbarui otomatis{now ? ` · ${now}` : ''}
                </p>

                <section id="sec-harian" className="flex scroll-mt-24 flex-col gap-4" aria-labelledby="judul-harian">
                    <TaraEyebrow>
                        <span id="judul-harian">Matriks laporan harian</span>
                    </TaraEyebrow>
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
                        {kpis.map(({ icon: Icon, label, value, hint, tone }) => (
                            <Card key={label} className="flex flex-col gap-2.5">
                                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef3f8]">
                                    <Icon className={cn('h-[22px] w-[22px]', tone)} aria-hidden="true" />
                                </span>
                                <p className="text-[15px] font-medium text-[#5b6b7a]">{label}</p>
                                <p className={cn('font-heading text-[36px] leading-none font-bold tabular-nums sm:text-[44px]', tone)}>{nf(value)}</p>
                                <p className="text-[13px] text-[#8a96a3]">{hint}</p>
                            </Card>
                        ))}
                    </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
                    <Card className="flex flex-col gap-5">
                        <h2 className="font-heading text-xl font-bold text-[var(--t-deep)]">Status penanganan</h2>
                        <div
                            className="flex h-[18px] w-full gap-[3px] overflow-hidden rounded-full bg-[#eef1f4]"
                            role="img"
                            aria-label="Sebaran status penanganan"
                        >
                            {statusTotal > 0 &&
                                STATUS_ORDER.map(({ key, color }) => {
                                    const v = stats.by_status?.[key] ?? 0;
                                    return v > 0 ? <span key={key} style={{ width: `${(v / statusTotal) * 100}%`, background: color }} /> : null;
                                })}
                        </div>
                        <ul className="divide-y divide-[#e8edf2]">
                            {STATUS_ORDER.map(({ key, color }) => {
                                const v = stats.by_status?.[key] ?? 0;
                                return (
                                    <li key={key} className="flex items-center gap-3 py-3">
                                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
                                        <span className="flex-1 text-[15px] font-medium text-[var(--t-deep)]">{statusLabel(key)}</span>
                                        <span className="font-heading text-[17px] font-bold text-[var(--t-deep)] tabular-nums">{nf(v)}</span>
                                        <span className="w-12 text-right text-sm text-[#8a96a3] tabular-nums">
                                            {statusTotal > 0 ? Math.round((v / statusTotal) * 100) : 0}%
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </Card>

                    <div
                        id="sec-bulanan"
                        className="flex scroll-mt-24 flex-col gap-5 rounded-[20px] bg-[radial-gradient(120%_120%_at_85%_0%,#0a5a91_0%,#022b4a_60%)] p-7 text-white"
                    >
                        <p className="text-[13px] font-semibold tracking-[0.12em] text-[#c9d6e2] uppercase">Matriks laporan bulanan</p>
                        <p className="flex items-end gap-2.5">
                            <span className="font-heading text-[56px] leading-none font-bold tabular-nums">{nf(stats.this_month)}</span>
                            <span className="pb-1 text-base text-[#c9d6e2]">laporan bulan ini</span>
                        </p>
                        <span className="h-px w-full bg-white/15" aria-hidden="true" />
                        <p className="flex items-end gap-2.5">
                            <span className="font-heading text-[40px] leading-none font-bold text-[var(--t-gold)] tabular-nums">
                                {stats.sla_pct}%
                            </span>
                            <span className="pb-1 text-[15px] text-[#c9d6e2]">ditangani tepat waktu (SLA)</span>
                        </p>
                        <span className="h-2.5 w-full overflow-hidden rounded-full bg-white/15" aria-hidden="true">
                            <span className="block h-full rounded-full bg-[var(--t-gold)]" style={{ width: `${Math.min(100, stats.sla_pct)}%` }} />
                        </span>
                        <p className="text-[13px] leading-relaxed text-[#9fb2c3]">
                            Dihitung dari tiket yang selesai bulan ini terhadap batas waktu penanganannya.
                        </p>
                    </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-2">
                    <Card className="flex flex-col gap-5">
                        <h2 className="font-heading text-xl font-bold text-[var(--t-deep)]">Top kategori keluhan</h2>
                        {categories.length === 0 ? (
                            <p className="text-sm text-[#8a96a3]">Belum ada data kategori.</p>
                        ) : (
                            <ul className="flex flex-col gap-4">
                                {categories.map((c, i) => {
                                    const Icon = categoryIcon(c.name);
                                    return (
                                        <li key={c.name} className="flex flex-col gap-2">
                                            <span className="flex items-center gap-2.5">
                                                <Icon className="h-[18px] w-[18px] shrink-0 text-[var(--t-navy)]" aria-hidden="true" />
                                                <span className="flex-1 text-[15px] font-medium text-[var(--t-deep)]">{c.name}</span>
                                                <span className="font-heading font-bold text-[var(--t-deep)] tabular-nums">{nf(c.total)}</span>
                                            </span>
                                            <span className="h-2.5 w-full overflow-hidden rounded-full bg-[#eef1f4]" aria-hidden="true">
                                                <span
                                                    className={cn('block h-full rounded-full', i === 0 ? 'bg-[var(--t-gold)]' : 'bg-[var(--t-navy)]')}
                                                    style={{ width: `${(c.total / maxCategory) * 100}%` }}
                                                />
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Card>

                    <Card className="flex flex-col">
                        <h2 className="font-heading text-xl font-bold text-[var(--t-deep)]">Distribusi kanal pengaduan</h2>
                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-[15px]">
                                <thead>
                                    <tr className="border-b border-[#e8edf2] text-left text-xs font-semibold tracking-[0.1em] text-[#8a96a3] uppercase">
                                        <th className="py-2.5 font-semibold">Sumber kanal</th>
                                        <th className="w-20 py-2.5 text-right font-semibold">Jumlah</th>
                                        <th className="w-16 py-2.5 text-right font-semibold">%</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#e8edf2]">
                                    {channels.map((c) => {
                                        const Icon = channelIcon(c.name);
                                        return (
                                            <tr key={c.name}>
                                                <td className="py-3">
                                                    <span className="flex items-center gap-2.5 text-[var(--t-deep)]">
                                                        <Icon className="h-[17px] w-[17px] shrink-0 text-[var(--t-navy)]" aria-hidden="true" />{' '}
                                                        {c.name}
                                                    </span>
                                                </td>
                                                <td className="font-heading py-3 text-right font-bold text-[var(--t-deep)] tabular-nums">
                                                    {nf(c.total)}
                                                </td>
                                                <td className="py-3 text-right text-sm text-[#8a96a3] tabular-nums">
                                                    {channelTotal > 0 ? ((c.total / channelTotal) * 100).toFixed(1) : '0.0'}%
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {channels.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="py-4 text-sm text-[#8a96a3]">
                                                Belum ada data kanal.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </section>

                <section id="sec-petugas" className="flex scroll-mt-24 flex-col gap-4" aria-labelledby="judul-kawasan">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <TaraEyebrow>Kawasan transmigrasi</TaraEyebrow>
                            <h2 id="judul-kawasan" className="font-heading mt-1.5 text-2xl font-bold text-[var(--t-deep)]">
                                {nf(regions.length)} kawasan · {nf(totalKk)} KK dilayani
                            </h2>
                        </div>
                        <Link
                            href="/peta"
                            className="flex items-center gap-1.5 text-[15px] font-semibold text-[var(--t-deep)] hover:text-[var(--t-navy)]"
                        >
                            Lihat di Peta Wilayah <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    </div>
                    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {regions.map((r) => (
                            <li key={r.id} className="flex items-center gap-4 rounded-[20px] border border-[#e8edf2] bg-white p-5">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eef3f8] text-[var(--t-navy)]">
                                    <House className="h-5 w-5" aria-hidden="true" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block font-mono text-[13px] font-semibold text-[#9a7330]">{r.code}</span>
                                    <span className="font-heading block truncate text-lg font-bold text-[var(--t-deep)]">{r.name}</span>
                                    <span className="block text-sm text-[#5b6b7a]">
                                        {r.province ?? '—'} · {nf(r.kk_count)} KK
                                    </span>
                                </span>
                                <span
                                    className={cn(
                                        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold',
                                        statusTone(r.infrastructure_status),
                                    )}
                                >
                                    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                                    {r.infrastructure_status ?? 'Belum dinilai'}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>

                <section
                    id="sec-dasar-hukum"
                    className="grid scroll-mt-24 gap-8 rounded-[24px] bg-[#f7f3ee] p-7 sm:p-9 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-10"
                >
                    <div className="flex flex-col gap-2.5">
                        <TaraEyebrow tone="bronze">Dasar hukum</TaraEyebrow>
                        <h2 className="font-heading text-2xl leading-tight font-bold text-[var(--t-deep)]">
                            Keterbukaan data ini dijalankan berdasarkan
                        </h2>
                        <p className="text-[15px] leading-relaxed text-[#5b4a36]">
                            Data yang tampil tidak memuat identitas pelapor dan tidak termasuk tiket internal pegawai.
                        </p>
                    </div>
                    <ul className="flex flex-col gap-2.5">
                        {DASAR_HUKUM.map((h) => (
                            <li key={h} className="flex items-center gap-3 rounded-[14px] border border-[#ece6dc] bg-white px-[18px] py-3.5">
                                <Scale className="h-[18px] w-[18px] shrink-0 text-[var(--t-navy)]" aria-hidden="true" />
                                <span className="text-[15px] font-medium text-[var(--t-deep)]">{h}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                <AskTaraCard
                    title="Butuh data yang lebih rinci?"
                    desc="Tanya TARA, atau ajukan permohonan informasi publik lewat PPID Kementerian Transmigrasi."
                />
            </div>
        </TaraPage>
    );
}
