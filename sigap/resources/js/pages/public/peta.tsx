import { House, Map as MapIcon, MapPinned, MessageSquareText, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import ProvinceMap, { TooltipRow } from '@/components/sigap/province-map';
import TaraPage from '@/components/sigap/tara-shell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Point {
    id: number;
    code: string;
    name: string;
    province: string | null;
    latitude: number;
    longitude: number;
    infrastructure_status: string | null;
    kk_count: number;
}

interface ProvinceTotal {
    provinsi: string;
    total: number;
    selesai: number;
    berjalan: number;
    kawasan: { nama: string; total: number }[];
}

interface Props {
    regions: number;
    points: Point[];
    provinsi: ProvinceTotal[];
}

function statusTone(status: string | null): string {
    const s = (status ?? '').toLowerCase();
    if (s.includes('memadai') || s.includes('baik')) return 'bg-[#e7f4ef] text-[#0d7a5f]';
    if (s.includes('berkembang') || s.includes('sedang')) return 'bg-[#fdf3e1] text-[#9a5b00]';
    if (s.includes('kurang') || s.includes('rusak')) return 'bg-[#fdecea] text-[#b42318]';
    return 'bg-[#eef1f4] text-[#4a5868]';
}

export default function Peta({ regions, points, provinsi }: Props) {
    const [mounted, setMounted] = useState(false);
    const [province, setProvince] = useState('all');
    const [selectedId, setSelectedId] = useState<number | null>(null);

    useEffect(() => setMounted(true), []);

    const provinces = useMemo(
        () => Array.from(new Set([...points.map((p) => p.province), ...provinsi.map((p) => p.provinsi)].filter(Boolean))).sort() as string[],
        [points, provinsi],
    );
    const filtered = useMemo(() => (province === 'all' ? points : points.filter((p) => p.province === province)), [points, province]);
    const totalKk = points.reduce((s, p) => s + p.kk_count, 0);
    const totalPengaduan = provinsi.reduce((s, p) => s + p.total, 0);

    const selectProvince = (v: string) => {
        setProvince(v);
        setSelectedId(null);
    };

    return (
        <TaraPage
            title="Peta Wilayah"
            description="Peta kawasan transmigrasi yang dilayani SIGAP."
            active="peta"
            eyebrow="Peta Wilayah"
            heading="Peta Wilayah Transmigrasi"
            subtitle={
                <span className="flex flex-wrap items-center gap-x-6 gap-y-2 font-medium text-[var(--t-deep)]">
                    <span className="flex items-center gap-2">
                        <MapPinned className="h-5 w-5 text-[#9a7330]" aria-hidden="true" /> {regions.toLocaleString('id-ID')} Kawasan Transmigrasi
                    </span>
                    <span className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-[#9a7330]" aria-hidden="true" /> {totalKk.toLocaleString('id-ID')} KK
                    </span>
                    <span className="flex items-center gap-2">
                        <MessageSquareText className="h-5 w-5 text-[#9a7330]" aria-hidden="true" /> {totalPengaduan.toLocaleString('id-ID')} Pengaduan
                    </span>
                </span>
            }
            heroAside={
                <div className="w-full lg:w-[300px]">
                    <label className="mb-2 block text-sm font-semibold text-[var(--t-deep)]">Kawasan / Wilayah</label>
                    <Select value={province} onValueChange={selectProvince}>
                        <SelectTrigger className="h-[52px] gap-2.5 rounded-full border-[#e6ded1] bg-white px-5 text-[15px] font-medium text-[var(--t-deep)] [&>span]:flex-1 [&>span]:text-left">
                            <MapIcon className="h-[18px] w-[18px] shrink-0 text-[var(--t-navy)]" aria-hidden="true" />
                            <SelectValue placeholder="Semua Wilayah" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Wilayah</SelectItem>
                            {provinces.map((p) => (
                                <SelectItem key={p} value={p}>
                                    {p}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            }
        >
            <div className="mx-auto flex max-w-[1312px] flex-col gap-6 px-4 py-12 sm:px-6 lg:px-16 lg:py-14">
                <section className="rounded-[24px] border border-[#e6ebf0] bg-white p-5 sm:p-7">
                    <h2 className="font-heading text-2xl font-bold text-[var(--t-deep)]">Sebaran Pengaduan per Wilayah</h2>
                    <p className="mt-1 text-[#5b6b7a]">Jumlah pengaduan warga per provinsi. Klik provinsi untuk melihat kawasan transmigrasinya.</p>
                    <p className="mt-4 mb-3 flex items-center gap-2 font-semibold text-[var(--t-deep)]">
                        <MapPinned className="h-5 w-5 text-[#9a7330]" aria-hidden="true" />
                        {province === 'all' ? 'Seluruh Wilayah (Nasional)' : province}
                        {province !== 'all' && (
                            <button
                                type="button"
                                onClick={() => selectProvince('all')}
                                className="ml-1 rounded-full border border-[#e6ded1] px-3 py-0.5 text-sm font-medium hover:bg-[#f7f3ee]"
                            >
                                Nasional
                            </button>
                        )}
                    </p>
                    {mounted ? (
                        <ProvinceMap
                            data={provinsi}
                            selected={province === 'all' ? null : province}
                            onSelect={(p) => selectProvince(p === province ? 'all' : p)}
                            hint={province === 'all' ? 'Klik untuk melihat kawasan di provinsi ini' : 'Klik lagi untuk kembali ke nasional'}
                            tooltip={(_, row) =>
                                row ? (
                                    <>
                                        <TooltipRow label="Total pengaduan" value={row.total.toLocaleString('id-ID')} />
                                        <TooltipRow label="Sedang ditangani" value={row.berjalan.toLocaleString('id-ID')} />
                                        <TooltipRow label="Selesai" value={row.selesai.toLocaleString('id-ID')} tone="text-[#5fd0b5]" />
                                        <div className="mt-2 border-t border-white/15 pt-2">
                                            <p className="text-white/70">Kawasan ({row.kawasan.length}):</p>
                                            <ul className="mt-1 space-y-0.5">
                                                {row.kawasan.slice(0, 4).map((k) => (
                                                    <li key={k.nama} className="flex justify-between gap-3">
                                                        <span className="truncate">• {k.nama}</span>
                                                        <span className="tabular-nums">{k.total.toLocaleString('id-ID')}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-white/70">Belum ada pengaduan dari provinsi ini.</p>
                                )
                            }
                        />
                    ) : (
                        <div className="flex h-[360px] items-center justify-center text-[#5b6b7a] sm:h-[460px] lg:h-[520px]">Memuat peta…</div>
                    )}
                </section>

                {filtered.length > 0 ? (
                    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {filtered.map((p) => {
                            const active = p.id === selectedId;
                            return (
                                <li key={p.id}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedId(p.id)}
                                        aria-pressed={active}
                                        className={cn(
                                            'flex w-full items-center gap-4 rounded-[20px] border p-5 text-left transition-colors',
                                            active ? 'border-[var(--t-gold)] bg-[#f7f3ee]' : 'border-[#e6ebf0] bg-white hover:border-[#cdd6df]',
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
                                                active ? 'bg-[var(--t-gold)] text-[var(--t-deep)]' : 'bg-[#eef3f8] text-[var(--t-navy)]',
                                            )}
                                        >
                                            <House className="h-5 w-5" aria-hidden="true" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-mono text-[13px] font-semibold text-[#9a7330]">{p.code}</span>
                                            <span className="font-heading block truncate text-lg font-bold text-[var(--t-deep)]">{p.name}</span>
                                            <span className="block text-sm text-[#5b6b7a]">
                                                {p.province ?? '—'} · {p.kk_count.toLocaleString('id-ID')} KK
                                            </span>
                                        </span>
                                        <span
                                            className={cn(
                                                'hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold sm:inline-flex lg:hidden xl:inline-flex',
                                                statusTone(p.infrastructure_status),
                                            )}
                                        >
                                            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                                            {p.infrastructure_status ?? 'Belum dinilai'}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="text-center text-[#5b6b7a]">Belum ada kawasan dengan koordinat di wilayah ini.</p>
                )}
            </div>
        </TaraPage>
    );
}
