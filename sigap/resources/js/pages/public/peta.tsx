import { Map as MapIcon, MapPinned, MessageSquareText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import ProvinceMap, { TooltipRow } from '@/components/sigap/province-map';
import TaraPage from '@/components/sigap/tara-shell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PROVINCE_OPTIONS } from '@/lib/provinces';
import { cn } from '@/lib/utils';

/** Total pengaduan publik per provinsi asal (lokasi bebas pelapor tidak ditampilkan di publik). */
interface ProvinceTotal {
    provinsi: string;
    total: number;
    selesai: number;
    berjalan: number;
}

interface Props {
    provinsi: ProvinceTotal[];
}

const nf = (n: number) => n.toLocaleString('id-ID');

export default function Peta({ provinsi }: Props) {
    const [mounted, setMounted] = useState(false);
    const [province, setProvince] = useState('all');

    useEffect(() => setMounted(true), []);

    const totalPengaduan = provinsi.reduce((s, p) => s + p.total, 0);
    const reporting = provinsi.filter((p) => p.total > 0).length;
    const ranked = useMemo(() => [...provinsi].sort((a, b) => b.total - a.total), [provinsi]);
    const shown = province === 'all' ? ranked : ranked.filter((p) => p.provinsi === province);
    const max = Math.max(1, ...ranked.map((p) => p.total));

    return (
        <TaraPage
            title="Peta Wilayah"
            description="Sebaran pengaduan warga per provinsi asal yang dilayani Contact Center Kementerian Transmigrasi."
            active="peta"
            eyebrow="Peta Wilayah"
            heading="Peta Sebaran Pengaduan"
            subtitle={
                <span className="flex flex-wrap items-center gap-x-6 gap-y-2 font-medium text-[var(--tcd-heading,var(--t-deep))]">
                    <span className="flex items-center gap-2">
                        <MessageSquareText className="h-5 w-5 text-[var(--tcd-bronze,#8b682b)]" aria-hidden="true" /> {nf(totalPengaduan)} Pengaduan
                    </span>
                    <span className="flex items-center gap-2">
                        <MapPinned className="h-5 w-5 text-[var(--tcd-bronze,#8b682b)]" aria-hidden="true" /> {nf(reporting)} Provinsi asal
                    </span>
                </span>
            }
            heroAside={
                <div className="w-full lg:w-[300px]">
                    <label id="label-wilayah" className="mb-2 block text-sm font-semibold text-[var(--tcd-heading,var(--t-deep))]">
                        Provinsi
                    </label>
                    <Select value={province} onValueChange={setProvince}>
                        <SelectTrigger
                            aria-labelledby="label-wilayah"
                            className="h-[52px] gap-2.5 rounded-full border-[var(--tcd-border-warm,#e6ded1)] bg-[var(--tcd-surface,#fff)] px-5 text-[15px] font-medium text-[var(--tcd-heading,var(--t-deep))] [&>span]:flex-1 [&>span]:text-left"
                        >
                            <MapIcon className="h-[18px] w-[18px] shrink-0 text-[var(--tcd-link,var(--t-navy))]" aria-hidden="true" />
                            <SelectValue placeholder="Semua Provinsi" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Provinsi</SelectItem>
                            {PROVINCE_OPTIONS.map((p) => (
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
                <section className="rounded-[24px] border border-[var(--tcd-border,#e6ebf0)] bg-[var(--tcd-surface,#fff)] p-5 sm:p-7">
                    <h2 className="font-heading text-2xl font-bold text-[var(--tcd-heading,var(--t-deep))]">Sebaran Pengaduan per Provinsi</h2>
                    <p className="mt-1 text-[var(--tcd-text-2,#5b6b7a)]">
                        Dihitung dari provinsi asal yang diisi warga saat bertanya ke TARA atau mengirim pengaduan. Klik provinsi untuk melihat
                        rinciannya.
                    </p>
                    <p className="mt-4 mb-3 flex items-center gap-2 font-semibold text-[var(--tcd-heading,var(--t-deep))]">
                        <MapPinned className="h-5 w-5 text-[var(--tcd-bronze,#8b682b)]" aria-hidden="true" />
                        {province === 'all' ? 'Seluruh Indonesia' : province}
                        {province !== 'all' && (
                            <button
                                type="button"
                                onClick={() => setProvince('all')}
                                className="ml-1 rounded-full border border-[var(--tcd-border-warm,#e6ded1)] px-3 py-0.5 text-sm font-medium hover:bg-[var(--tcd-cream,#f7f3ee)]"
                            >
                                Nasional
                            </button>
                        )}
                    </p>
                    {mounted ? (
                        <ProvinceMap
                            data={provinsi}
                            selected={province === 'all' ? null : province}
                            onSelect={(p) => setProvince(p === province ? 'all' : p)}
                            hint={province === 'all' ? 'Klik untuk melihat rincian provinsi ini' : 'Klik lagi untuk kembali ke nasional'}
                            tooltip={(_, row) =>
                                row ? (
                                    <>
                                        <TooltipRow label="Total pengaduan" value={nf(row.total)} />
                                        <TooltipRow label="Sedang ditangani" value={nf(row.berjalan)} />
                                        <TooltipRow label="Selesai" value={nf(row.selesai)} tone="text-[#5fd0b5]" />
                                    </>
                                ) : (
                                    <p className="text-white/70">Belum ada pengaduan dari provinsi ini.</p>
                                )
                            }
                        />
                    ) : (
                        <div className="flex h-[360px] items-center justify-center text-[var(--tcd-text-2,#5b6b7a)] sm:h-[460px] lg:h-[520px]">
                            Memuat peta…
                        </div>
                    )}
                </section>

                <section aria-labelledby="judul-peringkat" className="flex flex-col gap-4">
                    <h2 id="judul-peringkat" className="font-heading text-xl font-bold text-[var(--tcd-heading,var(--t-deep))]">
                        {province === 'all' ? 'Provinsi asal pengaduan' : `Rincian ${province}`}
                    </h2>
                    {shown.length > 0 ? (
                        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {shown.map((p) => (
                                <li key={p.provinsi}>
                                    <button
                                        type="button"
                                        onClick={() => setProvince(p.provinsi === province ? 'all' : p.provinsi)}
                                        aria-pressed={p.provinsi === province}
                                        className={cn(
                                            'flex w-full flex-col gap-3 rounded-[18px] border p-4 text-left transition-colors sm:p-5',
                                            p.provinsi === province
                                                ? 'border-[var(--t-gold)] bg-[var(--tcd-cream,#f7f3ee)]'
                                                : 'border-[var(--tcd-border,#e6ebf0)] bg-[var(--tcd-surface,#fff)] hover:border-[var(--tcd-border-strong,#cdd6df)]',
                                        )}
                                    >
                                        <span className="flex items-baseline justify-between gap-3">
                                            <span className="font-heading text-lg font-bold text-[var(--tcd-heading,var(--t-deep))]">
                                                {p.provinsi}
                                            </span>
                                            <span className="font-heading text-2xl font-bold text-[var(--tcd-heading,var(--t-deep))] tabular-nums">
                                                {nf(p.total)}
                                            </span>
                                        </span>
                                        <span className="h-1.5 overflow-hidden rounded-full bg-[var(--tcd-muted-2,#e6ebf0)]" aria-hidden="true">
                                            <span
                                                className="block h-full rounded-full bg-[var(--t-gold)]"
                                                style={{ width: `${(p.total / max) * 100}%` }}
                                            />
                                        </span>
                                        <span className="flex gap-4 text-sm text-[var(--tcd-text-2,#5b6b7a)]">
                                            <span>
                                                Ditangani <strong className="text-[var(--tcd-text,#1f2d3a)]">{nf(p.berjalan)}</strong>
                                            </span>
                                            <span>
                                                Selesai <strong className="text-[var(--tcd-success,#0d7a5f)]">{nf(p.selesai)}</strong>
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="rounded-[18px] border border-dashed border-[var(--tcd-border-strong,#cdd6df)] p-6 text-center text-[var(--tcd-text-2,#5b6b7a)]">
                            {province === 'all' ? 'Belum ada pengaduan yang masuk.' : `Belum ada pengaduan dari ${province}.`}
                        </p>
                    )}
                </section>
            </div>
        </TaraPage>
    );
}
