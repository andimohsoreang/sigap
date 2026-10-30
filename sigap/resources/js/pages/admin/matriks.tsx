import { Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowRight,
    AtSign,
    Building2,
    CalendarCheck,
    CalendarDays,
    ChevronRight,
    CircleCheck,
    CircleX,
    Clock,
    Database,
    ExternalLink,
    Eye,
    FilePenLine,
    Globe,
    HandHeart,
    Hourglass,
    Inbox,
    Info,
    Landmark,
    LoaderCircle,
    Mail,
    MapPin,
    MessageCircle,
    MousePointerClick,
    Phone,
    Printer,
    RadioTower,
    Route,
    ShieldCheck,
    Siren,
    Sparkles,
    Sprout,
    Star,
    Tag,
    Ticket,
    Timer,
    UserRound,
    Users,
    UserX,
    Workflow,
    X,
    type LucideIcon,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

import { DonutChart, TrendChart, type TrendPoint } from '@/components/sigap/charts';
import { DataTable, type DataTableColumn } from '@/components/sigap/data-table';
import ProvinceMap, { TooltipRow } from '@/components/sigap/province-map';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminLayout, { AdminStat, ImpactBadge, StatusBadge } from '@/layouts/admin-layout';
import { formatDate } from '@/lib/admin-format';
import { cn } from '@/lib/utils';

interface TicketRow {
    nomor: string;
    judul: string;
    pelapor: string | null;
    status: string;
    status_label: string;
    impact: string | null;
    impact_label: string | null;
    kategori: string | null;
    kawasan: string | null;
    is_internal: boolean;
    created_at: string | null;
    tenggat_sla: string | null;
    overdue: boolean;
}

type StatusKey = 'baru' | 'verifikasi' | 'diproses' | 'selesai' | 'ditolak';
type Sumbu = 'kategori' | 'kawasan' | 'kanal' | 'petugas';

interface Metrics {
    counts: Record<StatusKey, number>;
    total: number;
    ews: number;
    selesai_sla: number;
    tepat: number;
    sla_pct: number | null;
}

interface MatrixRow extends Metrics {
    key: string;
    label: string;
    ikon: string | null;
    param: Record<string, string> | null;
}

interface OverdueItem {
    nomor: string;
    judul: string;
    kategori: string | null;
    kawasan: string | null;
    impact: string | null;
    impact_label: string | null;
    status: string | null;
    status_label: string | null;
    petugas: string | null;
    lewat_menit: number;
}

interface Rekap {
    total: number;
    alur: {
        pintu: { key: string; label: string; total: number }[];
        tahap: Record<StatusKey, { jumlah: number; ews: number; tepat_waktu?: number }>;
        tanpa_tiket: { dijawab_tara: number; rujukan: number; rujukan_berhasil: number; ppid: number };
    };
    kpi: {
        berjalan: number;
        ews: number;
        ews_luar_periode: number;
        sla_pct: number | null;
        sla_tepat: number;
        sla_selesai: number;
        respons_jam: number | null;
        penyelesaian_hari: number | null;
    };
    matriks: { sumbu: Sumbu; rows: MatrixRow[]; total: Metrics };
    dampak: {
        value: string;
        label: string;
        target: string;
        respons_jam: number;
        selesai_hari: number;
        tiket: number;
        berjalan: number;
        lewat: number;
        tepat: number;
        selesai: number;
    }[];
    kanal: { key: string; label: string; total: number }[];
    kawasan: { id: number | null; label: string; total: number; ews: number }[];
    provinsi: ProvinceRow[];
    kategori: { key: string; label: string; total: number }[];
    tren: { satuan: 'hari' | 'bulan'; titik: TrendPoint[] };
    survei: { rata: number | null; responden: number; selesai: number };
    perlu_tindakan: { total: number; items: OverdueItem[] };
}

interface ProvinceRow {
    provinsi: string;
    total: number;
    counts: Record<StatusKey, number>;
    ews: number;
    sla_pct: number | null;
    kawasan: { id: number; nama: string; total: number }[];
}

interface Options {
    regions: { id: number; name: string; province: string | null }[];
    categories: { id: number; name: string }[];
    months: { value: string; label: string }[];
}

interface Props {
    tickets: { data: TicketRow[]; meta: PaginationMeta };
    rekap: Rekap;
    periode: { value: string; label: string; bulan_berjalan: boolean };
    filters: Record<string, string>;
    chips: { key: string; label: string }[];
    options: Options;
    region_locked: boolean;
    own_region: { id: number; name: string } | null;
}

type PaginationMeta = { total: number; current_page: number; last_page: number; per_page: number; from: number | null; to: number | null };

/* ------------------------------ Konstanta ------------------------------ */

/** Warna tahap (desain Admin v2): Menunggu emas, Diverifikasi biru, Diproses navy. */
const TONE: Record<StatusKey, string> = {
    baru: 'var(--adm-warning)',
    verifikasi: 'var(--adm-info)',
    diproses: 'var(--adm-primary)',
    selesai: 'var(--adm-success)',
    ditolak: 'var(--adm-danger)',
};

const STATUS_LABEL: Record<StatusKey, string> = {
    baru: 'Menunggu',
    verifikasi: 'Diverifikasi',
    diproses: 'Diproses',
    selesai: 'Selesai',
    ditolak: 'Ditolak',
};

const STATUSES: StatusKey[] = ['baru', 'verifikasi', 'diproses', 'selesai', 'ditolak'];

const OPEN_STAGES: { key: StatusKey; desc: string; icon: LucideIcon }[] = [
    { key: 'baru', desc: 'Belum diverifikasi', icon: Hourglass },
    { key: 'verifikasi', desc: 'Data & lokasi dicek', icon: ShieldCheck },
    { key: 'diproses', desc: 'Didisposisikan ke petugas', icon: LoaderCircle },
];

const SUMBU: { key: Sumbu; label: string; title: string; column: string }[] = [
    { key: 'kategori', label: 'Kategori', title: 'Kategori aduan × tahap penanganan', column: 'Kategori' },
    { key: 'kawasan', label: 'Kawasan', title: 'Kawasan × tahap penanganan', column: 'Kawasan' },
    { key: 'kanal', label: 'Kanal', title: 'Kanal masuk × tahap penanganan', column: 'Kanal' },
    { key: 'petugas', label: 'Petugas', title: 'Petugas × tahap penanganan', column: 'Petugas' },
];

/** Ikon baris matriks: slug kategori, kunci kanal, atau jenis baris. */
const ROW_ICON: Record<string, LucideIcon> = {
    'infrastruktur-dasar': Route,
    'tata-kelola-lahan': Sprout,
    'bantuan-sosial': HandHeart,
    'layanan-data-tik': Database,
    kawasan: MapPin,
    web: Globe,
    chat: MessageCircle,
    medsos: AtSign,
    call_center: Phone,
    tatap_muka: Users,
    surat: Mail,
    internal: Building2,
    kanal: RadioTower,
    lainnya: Tag,
    petugas: UserRound,
    belum: UserX,
};

const PINTU_ICON: Record<string, LucideIcon> = { web: Globe, manual: FilePenLine, chat: MessageCircle };

/* ------------------------------- Pembantu ------------------------------ */

const nf = (n: number) => n.toLocaleString('id-ID');
const dec = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 1 });

/** Query string tanpa nilai kosong. */
function qs(params: Record<string, string | undefined | null>): string {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') search.set(k, v);
    });
    const out = search.toString();
    return out ? `?${out}` : '';
}

/** "2 hari 4 jam", "19 jam", "35 menit". */
function durasi(menit: number): string {
    const hari = Math.floor(menit / 1440);
    const jam = Math.floor((menit % 1440) / 60);
    if (hari > 0) return jam > 0 ? `${hari} hari ${jam} jam` : `${hari} hari`;
    if (jam > 0) return `${jam} jam`;
    return `${Math.max(menit, 1)} menit`;
}

function slaColor(pct: number | null): string {
    if (pct === null) return 'var(--adm-border-strong)';
    if (pct >= 85) return 'var(--adm-success)';
    if (pct >= 60) return 'var(--adm-accent)';
    return 'var(--adm-danger)';
}

/* -------------------------------- Halaman ------------------------------ */

export default function Matriks({ tickets, rekap, periode, filters, chips, options, region_locked, own_region }: Props) {
    const isEmpty = rekap.total === 0;
    const periodeTiket = periode.value === 'semua' ? '' : periode.value;

    /** URL halaman ini dengan saringan aktif + perubahan (halaman tabel direset). */
    const matriksUrl = (changes: Record<string, string>, hash = '') => `/admin/matriks${qs({ ...filters, ...changes })}${hash}`;
    const visit = (changes: Record<string, string>) => router.get(matriksUrl(changes), {}, { preserveScroll: true, preserveState: true });

    /** Tautan sel matriks → Manajemen Tiket dengan saringan baris + status. */
    const ticketUrl = (param: Record<string, string> | null, status?: StatusKey) =>
        `/admin/tiket${qs({ region_id: filters.region_id, periode: periodeTiket, ...(param ?? {}), status })}`;

    const regionName = region_locked
        ? (own_region?.name ?? '—')
        : (options.regions.find((r) => String(r.id) === filters.region_id)?.name ?? 'Semua kawasan');

    const extraChips = chips.filter((c) => ['provinsi', 'kanal', 'petugas', 'ews'].includes(c.key));

    const columns: DataTableColumn<TicketRow>[] = [
        {
            id: 'no',
            header: 'No',
            meta: { label: 'No', disableToggle: true, disableSorting: true, className: 'w-[60px] text-gray-500' },
            cell: ({ row }) => (tickets.meta.from ?? 1) + row.index,
        },
        {
            accessorKey: 'nomor',
            header: 'ID & Judul Laporan',
            cell: ({ row }) => (
                <div>
                    <div className="text-brand-light font-bold">#{row.original.nomor}</div>
                    <div className="mt-0.5 max-w-[220px] truncate text-xs text-gray-500">{row.original.judul}</div>
                </div>
            ),
        },
        {
            accessorKey: 'created_at',
            header: 'Tgl Masuk',
            cell: ({ getValue }) => formatDate(getValue<string | null>()),
        },
        {
            accessorKey: 'kawasan',
            header: 'Kawasan',
            cell: ({ getValue }) => getValue<string | null>() ?? '—',
        },
        {
            accessorKey: 'kategori',
            header: 'Kategori',
            cell: ({ getValue }) => getValue<string | null>() ?? '—',
        },
        {
            accessorKey: 'impact',
            header: 'Tingkat Dampak',
            meta: { className: 'text-center', disableSorting: true },
            cell: ({ row }) => <ImpactBadge value={row.original.impact} label={row.original.impact_label} />,
        },
        {
            accessorKey: 'overdue',
            header: 'SLA / EWS',
            cell: ({ row }) =>
                row.original.overdue ? (
                    <span className="flex w-fit items-center gap-1.5 rounded bg-red-50 px-2 py-0.5 font-bold text-red-600">
                        <AlertTriangle className="h-3.5 w-3.5" /> EWS
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 text-gray-600">
                        <Clock className="h-3.5 w-3.5 text-green-500" /> Aman
                    </span>
                ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            meta: { className: 'text-center', disableSorting: true },
            cell: ({ row }) => <StatusBadge value={row.original.status} label={row.original.status_label} />,
        },
        {
            id: 'aksi',
            header: 'Aksi',
            meta: { label: 'Aksi', disableToggle: true, disableSorting: true, className: 'text-center' },
            cell: ({ row }) => (
                <Button asChild size="sm" variant="outline" className="h-7 w-7 p-0">
                    <Link href={`/admin/tiket/${row.original.nomor}`} title="Lihat detail">
                        <Eye className="h-3.5 w-3.5" />
                    </Link>
                </Button>
            ),
        },
    ];

    return (
        <AdminLayout
            title="Matriks Rekapitulasi"
            subtitle="Rekap tiket per tahap penanganan, kategori, tingkat dampak & SLA, kanal masuk, dan kawasan — sesuai Pedoman Layanan Contact Center."
            actions={
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                    <Select value={periode.value} onValueChange={(v) => visit({ periode: v })}>
                        <SelectTrigger className="h-10 w-auto min-w-[168px] gap-2 bg-white font-medium" aria-label="Periode">
                            <CalendarDays className="h-4 w-4 shrink-0 text-[var(--adm-text-2)]" aria-hidden="true" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {options.months.map((m) => (
                                <SelectItem key={m.value} value={m.value}>
                                    {m.label}
                                </SelectItem>
                            ))}
                            <SelectItem value="semua">Semua waktu</SelectItem>
                        </SelectContent>
                    </Select>
                    {region_locked ? (
                        <span className="flex h-10 items-center gap-2 rounded-md border border-[var(--adm-border-strong)] bg-white px-3 text-sm font-medium">
                            <MapPin className="h-4 w-4 text-[var(--adm-text-2)]" aria-hidden="true" />
                            {regionName}
                        </span>
                    ) : (
                        <Select value={filters.region_id || 'all'} onValueChange={(v) => visit({ region_id: v === 'all' ? '' : v })}>
                            <SelectTrigger className="h-10 w-auto min-w-[180px] gap-2 bg-white font-medium" aria-label="Kawasan">
                                <MapPin className="h-4 w-4 shrink-0 text-[var(--adm-text-2)]" aria-hidden="true" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua kawasan</SelectItem>
                                {options.regions.map((r) => (
                                    <SelectItem key={r.id} value={String(r.id)}>
                                        {r.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Button size="sm" className="h-10 px-4" onClick={() => window.print()}>
                        <Printer className="h-4 w-4" /> Print
                    </Button>
                </div>
            }
        >
            <div className="space-y-6 [print-color-adjust:exact]">
                <p className="hidden text-sm text-[var(--adm-text-2)] print:block">
                    Periode: <strong>{periode.label}</strong> · Kawasan: <strong>{regionName}</strong>
                </p>

                <FlowCard
                    rekap={rekap}
                    periode={periode}
                    activeStatus={filters.status}
                    stageUrl={(s) => matriksUrl({ status: s }, '#daftar-tiket')}
                />

                <KpiRow kpi={rekap.kpi} counts={rekap.matriks.total.counts} periodeSemua={periode.value === 'semua'} />

                <ProvinceMapCard
                    rows={rekap.provinsi}
                    periode={periode.label}
                    selected={filters.provinsi || null}
                    onSelect={region_locked ? undefined : (p) => visit({ provinsi: p === filters.provinsi ? '' : p, region_id: '' })}
                    onReset={() => visit({ provinsi: '' })}
                />

                {!isEmpty && (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr]">
                        <Card className="p-5 md:p-6 lg:col-span-2 xl:col-span-1">
                            <CardHeading eyebrow="Tren" title={`Tiket masuk vs selesai per ${rekap.tren.satuan}`} />
                            <div className="mt-4">
                                <TrendChart points={rekap.tren.titik} unit={rekap.tren.satuan} />
                            </div>
                        </Card>
                        <Card className="p-5 md:p-6">
                            <CardHeading eyebrow="Komposisi" title="Status tiket" />
                            <div className="mt-4">
                                <DonutChart
                                    centerLabel="tiket"
                                    segments={STATUSES.map((st) => ({
                                        key: st,
                                        label: STATUS_LABEL[st],
                                        value: rekap.matriks.total.counts[st],
                                        color: TONE[st],
                                    }))}
                                    onSelect={(st) => router.get(matriksUrl({ status: st }, '#daftar-tiket'))}
                                />
                            </div>
                        </Card>
                        <Card className="p-5 md:p-6">
                            <CardHeading eyebrow="Kategori" title="Tiket per kategori" />
                            <div className="mt-4">
                                <BarList rows={rekap.kategori} color="var(--adm-info)" icon={() => Tag} />
                                <TotalLine total={rekap.total} />
                            </div>
                        </Card>
                    </div>
                )}

                <MatrixCard matriks={rekap.matriks} isEmpty={isEmpty} sumbuUrl={(s) => matriksUrl({ sumbu: s })} ticketUrl={ticketUrl} />

                {isEmpty ? (
                    <EmptyPanel rekap={rekap} />
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr]">
                            <ImpactCard rows={rekap.dampak} />
                            <KanalCard rows={rekap.kanal} total={rekap.total} />
                            <KawasanCard rows={rekap.kawasan} total={rekap.total} survei={rekap.survei} />
                        </div>
                        <OverdueCard
                            data={rekap.perlu_tindakan}
                            luarPeriode={rekap.kpi.ews_luar_periode}
                            listUrl={`/admin/tiket${qs({ ews: '1', periode: periodeTiket, region_id: filters.region_id })}`}
                            semuaUrl={matriksUrl({ periode: 'semua' })}
                        />
                    </>
                )}

                {/* Daftar tiket (fitur lama): saringan, pencarian, paginasi & sorting server-side. */}
                <section id="daftar-tiket" className="scroll-mt-24 print:break-before-page">
                    {extraChips.length > 0 && (
                        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                            <span className="text-[var(--adm-text-3)]">Saringan tambahan:</span>
                            {extraChips.map((c) => (
                                <Link
                                    key={c.key}
                                    href={matriksUrl({ [c.key]: '' }, '#daftar-tiket')}
                                    preserveScroll
                                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--adm-border-strong)] bg-white px-3 py-1 text-xs font-medium hover:bg-[var(--adm-surface-2)]"
                                >
                                    {c.label}
                                    <X className="h-3.5 w-3.5" aria-label="Hapus saringan" />
                                </Link>
                            ))}
                        </div>
                    )}
                    <DataTable<TicketRow>
                        columns={columns}
                        data={tickets.data}
                        toolbarTitle={`Daftar tiket · ${periode.label}`}
                        searchPlaceholder="Cari ID / judul tiket..."
                        itemLabel="tiket"
                        emptyMessage="Tidak ada tiket yang cocok."
                        filters={[
                            {
                                columnId: 'region_id',
                                placeholder: 'Semua Wilayah',
                                options: options.regions.map((r) => ({ value: String(r.id), label: r.name })),
                            },
                            {
                                columnId: 'category_id',
                                placeholder: 'Semua Kategori',
                                options: options.categories.map((c) => ({ value: String(c.id), label: c.name })),
                            },
                            {
                                columnId: 'impact',
                                placeholder: 'Semua Dampak',
                                options: [
                                    { value: 'rendah', label: 'Rendah' },
                                    { value: 'sedang', label: 'Sedang' },
                                    { value: 'tinggi', label: 'Tinggi' },
                                    { value: 'kritis', label: 'Kritis' },
                                ],
                            },
                            {
                                columnId: 'status',
                                placeholder: 'Semua Status',
                                options: STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
                            },
                        ]}
                        rowClassName={(row) => cn(row.overdue && 'bg-red-50/40 hover:bg-red-50/60')}
                        serverSide={{
                            url: '/admin/matriks',
                            meta: tickets.meta,
                            currentValues: filters,
                            preserveScroll: true,
                        }}
                    />
                </section>
            </div>
        </AdminLayout>
    );
}

/* ------------------------------ Komponen ------------------------------- */

function Card({ className, children }: { className?: string; children: ReactNode }) {
    return <section className={cn('rounded-xl border border-[var(--adm-border)] bg-white', className)}>{children}</section>;
}

function CardHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--adm-text-3)] uppercase">{eyebrow}</p>
                <h2 className="mt-1 text-lg leading-snug font-bold text-[var(--adm-text)]">{title}</h2>
            </div>
            {children}
        </div>
    );
}

function FlowCard({
    rekap,
    periode,
    activeStatus,
    stageUrl,
}: {
    rekap: Rekap;
    periode: Props['periode'];
    activeStatus?: string;
    stageUrl: (status: StatusKey) => string;
}) {
    const { pintu, tahap, tanpa_tiket: tanpa } = rekap.alur;
    const frasa = periode.value === 'semua' ? 'sepanjang waktu' : periode.bulan_berjalan ? 'bulan ini' : `pada ${periode.label}`;
    const title =
        rekap.total > 0
            ? `${nf(rekap.total)} tiket ${frasa} — dari pintu masuk sampai tuntas`
            : periode.value === 'semua'
              ? 'Belum ada tiket tercatat'
              : `Belum ada tiket pada ${periode.label}`;

    const chevron = <ChevronRight className="hidden h-5 w-5 shrink-0 self-center text-[var(--adm-border-strong)] lg:block" aria-hidden="true" />;

    return (
        <Card className="p-5 md:p-6">
            <CardHeading eyebrow="Alur penanganan tiket" title={title}>
                <span className="flex items-center gap-1.5 rounded-md bg-[var(--adm-surface-2)] px-2.5 py-1.5 text-xs text-[var(--adm-text-2)] print:hidden">
                    <Info className="h-3.5 w-3.5" aria-hidden="true" /> Klik tahap untuk menyaring tabel di bawah
                </span>
            </CardHeading>

            <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-stretch">
                {/* Pintu masuk */}
                <div className="rounded-xl bg-[var(--adm-primary-soft)] p-4 lg:w-[236px] lg:shrink-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-[var(--adm-primary)]">
                        <Inbox className="h-4 w-4" aria-hidden="true" /> Pintu masuk
                    </p>
                    <ul className="mt-3 space-y-2.5">
                        {pintu.map((p) => {
                            const Icon = PINTU_ICON[p.key] ?? Globe;
                            return (
                                <li key={p.key} className="flex items-center gap-2 text-[13px] text-[var(--adm-text-2)]">
                                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                    <span className="flex-1">{p.label}</span>
                                    <span className="font-[family-name:var(--font-mono)] font-semibold text-[var(--adm-text)] tabular-nums">
                                        {nf(p.total)}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                {OPEN_STAGES.map((stage) => {
                    const data = tahap[stage.key];
                    const Icon = stage.icon;
                    const active = activeStatus === stage.key;
                    return (
                        <div key={stage.key} className="contents">
                            {chevron}
                            <Link
                                href={stageUrl(stage.key)}
                                className={cn(
                                    'group flex flex-col rounded-xl border-[1.5px] bg-white p-4 transition-shadow hover:shadow-md lg:min-w-0 lg:flex-1',
                                    active && 'ring-2 ring-offset-2',
                                )}
                                style={{ borderColor: TONE[stage.key], '--tw-ring-color': TONE[stage.key] } as CSSProperties}
                                aria-label={`${STATUS_LABEL[stage.key]}: ${data.jumlah} tiket — saring daftar tiket`}
                            >
                                <span className="flex items-center gap-2 text-sm font-semibold text-[var(--adm-text)]">
                                    <span
                                        className="flex h-6 w-6 items-center justify-center rounded-md"
                                        style={{ backgroundColor: `color-mix(in srgb, ${TONE[stage.key]} 12%, white)`, color: TONE[stage.key] }}
                                    >
                                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                    </span>
                                    {STATUS_LABEL[stage.key]}
                                </span>
                                <span className="mt-2 font-[family-name:var(--font-heading)] text-[32px] leading-none font-bold text-[var(--adm-text)] tabular-nums">
                                    {nf(data.jumlah)}
                                </span>
                                <span className="mt-2 text-xs text-[var(--adm-text-2)]">{stage.desc}</span>
                                {data.ews > 0 && (
                                    <span className="mt-2 inline-flex w-fit items-center gap-1 rounded bg-[var(--adm-danger-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--adm-danger)]">
                                        <Siren className="h-3 w-3" aria-hidden="true" /> {nf(data.ews)} lewat tenggat
                                    </span>
                                )}
                            </Link>
                        </div>
                    );
                })}

                {chevron}
                <div className="flex flex-col justify-center gap-3 sm:flex-row lg:w-[216px] lg:shrink-0 lg:flex-col">
                    <TerminalStage
                        href={stageUrl('selesai')}
                        active={activeStatus === 'selesai'}
                        status="selesai"
                        icon={CircleCheck}
                        jumlah={tahap.selesai.jumlah}
                        note={tahap.selesai.jumlah > 0 ? `${nf(tahap.selesai.tepat_waktu ?? 0)} tepat waktu` : '—'}
                    />
                    <TerminalStage
                        href={stageUrl('ditolak')}
                        active={activeStatus === 'ditolak'}
                        status="ditolak"
                        icon={CircleX}
                        jumlah={tahap.ditolak.jumlah}
                        note="Di luar kewenangan"
                    />
                </div>
            </div>

            {/* Ditangani tanpa tiket (percakapan & rujukan tidak terikat kawasan). */}
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-[var(--adm-surface-2)] px-4 py-3 text-[13px] text-[var(--adm-text-2)]">
                <span className="font-semibold text-[var(--adm-text)]">Ditangani tanpa tiket</span>
                <span className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-[var(--adm-accent)]" aria-hidden="true" />
                    Dijawab TARA (sumber resmi): <strong className="text-[var(--adm-text)]">{nf(tanpa.dijawab_tara)} percakapan</strong>
                </span>
                <Link href="/admin/rujukan" className="flex items-center gap-1.5 hover:underline">
                    <ExternalLink className="h-4 w-4 text-[var(--adm-accent)]" aria-hidden="true" />
                    Dirujuk ke portal:{' '}
                    <strong className="text-[var(--adm-text)]">
                        {nf(tanpa.rujukan)} · {nf(tanpa.rujukan_berhasil)} berhasil
                    </strong>
                </Link>
                <span className="flex items-center gap-1.5">
                    <Landmark className="h-4 w-4 text-[var(--adm-accent)]" aria-hidden="true" />
                    Diarahkan ke PPID: <strong className="text-[var(--adm-text)]">{nf(tanpa.ppid)} percakapan</strong>
                </span>
            </div>
        </Card>
    );
}

function TerminalStage({
    href,
    active,
    status,
    icon: Icon,
    jumlah,
    note,
}: {
    href: string;
    active: boolean;
    status: 'selesai' | 'ditolak';
    icon: LucideIcon;
    jumlah: number;
    note: string;
}) {
    const tone = TONE[status];
    return (
        <Link
            href={href}
            className={cn(
                'flex flex-1 items-center gap-3 rounded-xl px-4 py-3 transition-shadow hover:shadow-md lg:flex-none',
                active && 'ring-2 ring-offset-2',
            )}
            style={{ backgroundColor: `color-mix(in srgb, ${tone} 10%, white)`, '--tw-ring-color': tone } as CSSProperties}
            aria-label={`${STATUS_LABEL[status]}: ${jumlah} tiket — saring daftar tiket`}
        >
            <Icon className="h-5 w-5 shrink-0" style={{ color: tone }} aria-hidden="true" />
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold" style={{ color: tone }}>
                    {STATUS_LABEL[status]}
                </span>
                <span className="block text-xs leading-snug text-[var(--adm-text-2)]">{note}</span>
            </span>
            <span className="font-[family-name:var(--font-heading)] text-[26px] leading-none font-bold tabular-nums" style={{ color: tone }}>
                {nf(jumlah)}
            </span>
        </Link>
    );
}

function KpiRow({ kpi, counts, periodeSemua }: { kpi: Rekap['kpi']; counts: Record<StatusKey, number>; periodeSemua: boolean }) {
    const ewsHint =
        kpi.ews_luar_periode > 0 && !periodeSemua
            ? `Tiket berjalan melewati tenggat SLA · +${nf(kpi.ews_luar_periode)} dari periode lain`
            : 'Tiket berjalan yang melewati tenggat SLA';

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <AdminStat
                label="Tiket berjalan"
                value={nf(kpi.berjalan)}
                unit="tiket"
                hint={`Menunggu ${nf(counts.baru)} · Diverifikasi ${nf(counts.verifikasi)} · Diproses ${nf(counts.diproses)}`}
                icon={Ticket}
            />
            <AdminStat label="Peringatan EWS" value={nf(kpi.ews)} unit="lewat tenggat" hint={ewsHint} tone="red" icon={Siren} />
            <AdminStat
                label="SLA terpenuhi"
                value={kpi.sla_pct === null ? '—' : `${dec(kpi.sla_pct)}%`}
                unit={kpi.sla_pct === null ? 'belum ada tiket selesai' : `${nf(kpi.sla_tepat)} dari ${nf(kpi.sla_selesai)}`}
                hint="Tiket selesai sebelum tenggat"
                tone="green"
                icon={CircleCheck}
            />
            <AdminStat
                label="Rata-rata respons awal"
                value={kpi.respons_jam === null ? '—' : dec(kpi.respons_jam)}
                unit="jam"
                hint="Target: 1×24 jam (Kritis) – 5 hari"
                icon={Timer}
            />
            <AdminStat
                label="Rata-rata penyelesaian"
                value={kpi.penyelesaian_hari === null ? '—' : dec(kpi.penyelesaian_hari)}
                unit="hari"
                hint="Hari kalender; target 3–14 hari kerja sesuai dampak"
                icon={CalendarCheck}
            />
        </div>
    );
}

function MatrixCard({
    matriks,
    isEmpty,
    sumbuUrl,
    ticketUrl,
}: {
    matriks: Rekap['matriks'];
    isEmpty: boolean;
    sumbuUrl: (s: Sumbu) => string;
    ticketUrl: (param: Record<string, string> | null, status?: StatusKey) => string;
}) {
    const sumbu = SUMBU.find((s) => s.key === matriks.sumbu) ?? SUMBU[0];
    // Intensitas warna sel relatif terhadap jumlah terbesar pada kolom tahap yang sama.
    const max = Object.fromEntries(STATUSES.map((s) => [s, Math.max(0, ...matriks.rows.map((r) => r.counts[s]))])) as Record<StatusKey, number>;
    const total = matriks.total;

    return (
        <Card className="overflow-hidden">
            <div className="p-5 md:px-6">
                <CardHeading eyebrow="Matriks rekapitulasi" title={sumbu.title}>
                    <nav
                        className="flex rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-1 print:hidden"
                        aria-label="Sumbu baris matriks"
                    >
                        {SUMBU.map((s) => (
                            <Link
                                key={s.key}
                                href={sumbuUrl(s.key)}
                                preserveScroll
                                preserveState
                                aria-current={s.key === matriks.sumbu ? 'true' : undefined}
                                className={cn(
                                    'rounded-md px-3 py-1.5 text-[13px] font-medium text-[var(--adm-text-2)] transition-colors hover:text-[var(--adm-text)]',
                                    s.key === matriks.sumbu && 'bg-white font-semibold text-[var(--adm-primary)] shadow-sm',
                                )}
                            >
                                {s.label}
                            </Link>
                        ))}
                    </nav>
                </CardHeading>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] border-t border-[var(--adm-border)] text-sm">
                    <thead className="bg-[var(--adm-surface-2)] text-[11px] font-semibold tracking-[0.06em] text-[var(--adm-text-3)] uppercase">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left font-semibold">
                                {sumbu.column}
                            </th>
                            {STATUSES.map((s) => (
                                <th key={s} scope="col" className="px-2 py-3 text-center font-semibold">
                                    {STATUS_LABEL[s]}
                                </th>
                            ))}
                            <th scope="col" className="px-2 py-3 text-center font-semibold">
                                Total
                            </th>
                            <th scope="col" className="px-2 py-3 text-center font-semibold">
                                EWS
                            </th>
                            <th scope="col" className="px-6 py-3 text-center font-semibold">
                                SLA
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--adm-border)]">
                        {matriks.rows.length === 0 && (
                            <tr>
                                <td colSpan={9} className="px-6 py-8 text-center text-sm text-[var(--adm-text-3)]">
                                    Belum ada tiket pada periode ini.
                                </td>
                            </tr>
                        )}
                        {matriks.rows.map((row) => {
                            const Icon = ROW_ICON[row.ikon ?? ''] ?? Tag;
                            return (
                                <tr key={row.key || 'kosong'}>
                                    <th scope="row" className="px-6 py-2.5 text-left font-semibold text-[var(--adm-text)]">
                                        <span className="flex items-center gap-3">
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]">
                                                <Icon className="h-4 w-4" aria-hidden="true" />
                                            </span>
                                            <span className="truncate">{row.label}</span>
                                        </span>
                                    </th>
                                    {STATUSES.map((s) => (
                                        <td key={s} className="px-2 py-2.5 text-center">
                                            <MatrixCell
                                                value={row.counts[s]}
                                                max={max[s]}
                                                status={s}
                                                href={row.param ? ticketUrl(row.param, s) : null}
                                                label={`${row.counts[s]} tiket ${row.label} berstatus ${STATUS_LABEL[s]}`}
                                            />
                                        </td>
                                    ))}
                                    <td className="px-2 py-2.5 text-center font-[family-name:var(--font-heading)] text-base font-bold tabular-nums">
                                        {nf(row.total)}
                                    </td>
                                    <td className="px-2 py-2.5 text-center">
                                        {row.ews > 0 ? (
                                            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--adm-danger-soft)] px-2 py-1 text-xs font-bold text-[var(--adm-danger)]">
                                                <Siren className="h-3.5 w-3.5" aria-hidden="true" /> {nf(row.ews)}
                                            </span>
                                        ) : (
                                            <span className="text-[var(--adm-text-3)]">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-2.5">
                                        <SlaBar pct={row.sla_pct} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot className="border-t border-[var(--adm-border)] bg-[var(--adm-surface-2)] font-semibold">
                        <tr>
                            <th scope="row" className="px-6 py-3 text-left text-[var(--adm-text)]">
                                Total
                            </th>
                            {STATUSES.map((s) => (
                                <td
                                    key={s}
                                    className="px-2 py-3 text-center font-[family-name:var(--font-mono)] tabular-nums"
                                    style={{ color: total.counts[s] > 0 ? TONE[s] : 'var(--adm-text-3)' }}
                                >
                                    {nf(total.counts[s])}
                                </td>
                            ))}
                            <td className="px-2 py-3 text-center font-[family-name:var(--font-heading)] text-base font-bold tabular-nums">
                                {nf(total.total)}
                            </td>
                            <td
                                className="px-2 py-3 text-center font-[family-name:var(--font-mono)] tabular-nums"
                                style={{ color: total.ews > 0 ? 'var(--adm-danger)' : 'var(--adm-text-3)' }}
                            >
                                {nf(total.ews)}
                            </td>
                            <td className="px-6 py-3 text-center font-[family-name:var(--font-mono)] tabular-nums">
                                {total.sla_pct === null ? '—' : `${dec(total.sla_pct)}%`}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            {!isEmpty && (
                <p className="flex items-center gap-2 border-t border-[var(--adm-border)] px-6 py-3 text-xs text-[var(--adm-text-3)]">
                    <MousePointerClick className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Klik angka di sel untuk membuka daftar tiket dengan saringan {sumbu.label.toLowerCase()} + status tersebut. Intensitas warna
                    mengikuti jumlah tiket. SLA = tiket selesai sebelum tenggat.
                </p>
            )}
        </Card>
    );
}

function MatrixCell({ value, max, status, href, label }: { value: number; max: number; status: StatusKey; href: string | null; label: string }) {
    const base =
        'inline-flex h-8 w-[52px] items-center justify-center rounded-md font-[family-name:var(--font-mono)] text-[13px] font-semibold tabular-nums';

    if (value === 0) {
        return <span className={cn(base, 'bg-[#f1f4f7] font-medium text-[var(--adm-text-3)]')}>0</span>;
    }

    const mix = 10 + Math.round((max > 0 ? value / max : 0) * 22);
    const style: CSSProperties = { backgroundColor: `color-mix(in srgb, ${TONE[status]} ${mix}%, white)`, color: TONE[status] };

    return href ? (
        <Link
            href={href}
            className={cn(base, 'transition-shadow hover:shadow-[0_0_0_2px_currentColor]')}
            style={style}
            aria-label={label}
            title={label}
        >
            {nf(value)}
        </Link>
    ) : (
        <span className={base} style={style} title={label}>
            {nf(value)}
        </span>
    );
}

function SlaBar({ pct }: { pct: number | null }) {
    return (
        <span className="flex items-center justify-center gap-2">
            <span className="h-1.5 w-[70px] overflow-hidden rounded-full bg-[#e6ebf0]">
                <span className="block h-full rounded-full" style={{ width: `${pct ?? 0}%`, backgroundColor: slaColor(pct) }} />
            </span>
            <span className="w-11 font-[family-name:var(--font-mono)] text-xs tabular-nums">{pct === null ? '—' : `${dec(pct)}%`}</span>
        </span>
    );
}

function ImpactCard({ rows }: { rows: Rekap['dampak'] }) {
    return (
        <Card className="flex flex-col p-5 md:p-6">
            <CardHeading eyebrow="Tingkat dampak × SLA" title="Target Pedoman Layanan Contact Center" />
            <div className="-mx-1 mt-4 overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                    <thead className="bg-[var(--adm-surface-2)] text-[11px] font-semibold tracking-[0.06em] text-[var(--adm-text-3)] uppercase">
                        <tr>
                            <th className="px-2 py-2.5 text-left font-semibold">Dampak</th>
                            <th className="px-2 py-2.5 text-left font-semibold">Target</th>
                            <th className="px-2 py-2.5 text-center font-semibold">Tiket</th>
                            <th className="px-2 py-2.5 text-center font-semibold">Berjalan</th>
                            <th className="px-2 py-2.5 text-center font-semibold">Lewat</th>
                            <th className="px-2 py-2.5 text-center font-semibold">Tepat waktu</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--adm-border)]">
                        {rows.map((r) => (
                            <tr key={r.value}>
                                <td className="px-2 py-3">
                                    <ImpactBadge value={r.value} label={r.label} />
                                </td>
                                <td className="px-2 py-3 text-xs text-[var(--adm-text-2)]">{r.target}</td>
                                <td className="px-2 py-3 text-center font-semibold tabular-nums">{nf(r.tiket)}</td>
                                <td className="px-2 py-3 text-center tabular-nums">{nf(r.berjalan)}</td>
                                <td className="px-2 py-3 text-center font-semibold tabular-nums">
                                    {r.lewat > 0 ? (
                                        <span className="text-[var(--adm-danger)]">{nf(r.lewat)}</span>
                                    ) : (
                                        <span className="text-[var(--adm-text-3)]">—</span>
                                    )}
                                </td>
                                <td className="px-2 py-3 text-center font-[family-name:var(--font-mono)] font-semibold tabular-nums">
                                    {r.selesai > 0 ? (
                                        <span style={{ color: r.tepat === r.selesai ? 'var(--adm-success)' : 'var(--adm-warning)' }}>
                                            {r.tepat}/{r.selesai}
                                        </span>
                                    ) : (
                                        <span className="text-[var(--adm-text-3)]">—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="mt-auto flex gap-2 pt-4 text-xs text-[var(--adm-text-3)]">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Tenggat dihitung dalam hari kerja (Sabtu–Minggu dilewati); kategori dengan SLA khusus memakai yang lebih ketat.
            </p>
        </Card>
    );
}

function BarList({
    rows,
    color,
    icon,
}: {
    rows: { key: string; label: string; total: number; ews?: number }[];
    color: string;
    icon: (key: string) => LucideIcon;
}) {
    const max = Math.max(1, ...rows.map((r) => r.total));
    return (
        <ul className="space-y-3.5">
            {rows.map((r) => {
                const Icon = icon(r.key);
                return (
                    <li key={r.key}>
                        <div className="flex items-center gap-2 text-[13px]">
                            <Icon className="h-4 w-4 shrink-0 text-[var(--adm-text-2)]" aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate text-[var(--adm-text)]">{r.label}</span>
                            {r.ews !== undefined && r.ews > 0 && (
                                <span
                                    className="flex items-center gap-0.5 text-[11px] font-semibold text-[var(--adm-danger)]"
                                    title={`${r.ews} lewat tenggat`}
                                >
                                    <Siren className="h-3 w-3" aria-hidden="true" /> {nf(r.ews)}
                                </span>
                            )}
                            <span className="font-semibold tabular-nums">{nf(r.total)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-[#e6ebf0]">
                            <div className="h-full rounded-full" style={{ width: `${(r.total / max) * 100}%`, backgroundColor: color }} />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

function TotalLine({ total }: { total: number }) {
    return (
        <div className="mt-4 flex justify-between border-t border-[var(--adm-border)] pt-3 text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{nf(total)}</span>
        </div>
    );
}

function KanalCard({ rows, total }: { rows: Rekap['kanal']; total: number }) {
    return (
        <Card className="p-5 md:p-6">
            <CardHeading eyebrow="Kanal masuk" title="Dari mana tiket datang" />
            <div className="mt-4">
                <BarList rows={rows} color="var(--adm-primary)" icon={(k) => ROW_ICON[k] ?? Tag} />
                <TotalLine total={total} />
            </div>
        </Card>
    );
}

function KawasanCard({ rows, total, survei }: { rows: Rekap['kawasan']; total: number; survei: Rekap['survei'] }) {
    return (
        <Card className="flex flex-col p-5 md:p-6">
            <CardHeading eyebrow="Kawasan transmigrasi" title="Sebaran per kawasan" />
            <div className="mt-4">
                <BarList rows={rows.map((r) => ({ ...r, key: String(r.id ?? 'kosong') }))} color="var(--adm-accent)" icon={() => MapPin} />
                <TotalLine total={total} />
            </div>
            {survei.rata !== null && (
                <div className="mt-auto pt-5">
                    <div className="rounded-lg bg-[var(--adm-accent-soft)] px-4 py-3">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--adm-text)]">
                            <Star className="h-3.5 w-3.5 text-[var(--adm-accent)]" aria-hidden="true" /> Survei kepuasan warga
                        </p>
                        <p className="mt-1 flex items-baseline gap-1.5">
                            <span className="font-[family-name:var(--font-heading)] text-[26px] leading-none font-bold">{dec(survei.rata)}</span>
                            <span className="text-xs text-[var(--adm-text-2)]">
                                / 5 · {nf(survei.responden)} dari {nf(survei.selesai)} tiket selesai
                            </span>
                        </p>
                    </div>
                </div>
            )}
        </Card>
    );
}

/** Peta sebaran pengaduan per provinsi; klik provinsi menyaring seluruh dashboard. */
function ProvinceMapCard({
    rows,
    periode,
    selected,
    onSelect,
    onReset,
}: {
    rows: ProvinceRow[];
    periode: string;
    selected: string | null;
    onSelect?: (provinsi: string) => void;
    onReset: () => void;
}) {
    const mapped = rows.filter((r) => r.provinsi !== 'Tanpa provinsi');

    return (
        <Card className="p-5 md:p-6">
            <CardHeading eyebrow="Peta wilayah" title="Sebaran Pengaduan per Wilayah">
                <p className="text-xs text-[var(--adm-text-2)]">{periode}</p>
            </CardHeading>
            <p className="mt-1 text-sm text-[var(--adm-text-2)]">
                {onSelect ? 'Klik provinsi untuk memfilter dashboard.' : 'Sebaran pengaduan di kawasan Anda.'}
            </p>
            <div className="mt-4 mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--adm-text)]">
                <MapPin className="h-4 w-4 text-[var(--adm-accent)]" aria-hidden="true" />
                {selected ?? 'Seluruh Wilayah (Nasional)'}
                {selected && onSelect && (
                    <button
                        type="button"
                        onClick={onReset}
                        className="ml-1 inline-flex items-center gap-1 rounded-full border border-[var(--adm-border-strong)] px-2.5 py-0.5 text-xs font-medium hover:bg-[var(--adm-surface-2)]"
                    >
                        <X className="h-3 w-3" aria-hidden="true" /> Nasional
                    </button>
                )}
            </div>
            <ProvinceMap
                data={mapped}
                selected={selected}
                onSelect={onSelect}
                hint={onSelect ? (selected ? 'Klik lagi untuk kembali ke nasional' : 'Klik untuk menyaring wilayah ini') : undefined}
                tooltip={(_, row) =>
                    row ? (
                        <>
                            <TooltipRow label="Total pengaduan" value={nf(row.total)} />
                            <TooltipRow label="Sedang berjalan" value={nf(row.counts.baru + row.counts.verifikasi + row.counts.diproses)} />
                            <TooltipRow label="Selesai" value={nf(row.counts.selesai)} tone="text-[#5fd0b5]" />
                            <TooltipRow label="Lewat tenggat SLA" value={nf(row.ews)} tone={row.ews > 0 ? 'text-[#f6c453]' : undefined} />
                            <TooltipRow label="Selesai tepat SLA" value={row.sla_pct === null ? '—' : `${dec(row.sla_pct)}%`} />
                            <div className="mt-2 border-t border-white/15 pt-2">
                                <p className="text-white/70">Kawasan ({row.kawasan.length}):</p>
                                <ul className="mt-1 space-y-0.5">
                                    {row.kawasan.slice(0, 4).map((k) => (
                                        <li key={k.id} className="flex justify-between gap-3">
                                            <span className="truncate">• {k.nama}</span>
                                            <span className="tabular-nums">{nf(k.total)}</span>
                                        </li>
                                    ))}
                                    {row.kawasan.length > 4 && <li className="text-white/60">+{row.kawasan.length - 4} kawasan lain</li>}
                                </ul>
                            </div>
                        </>
                    ) : (
                        <p className="text-white/70">Belum ada pengaduan pada periode ini.</p>
                    )
                }
            />
        </Card>
    );
}

function OverdueCard({
    data,
    luarPeriode,
    listUrl,
    semuaUrl,
}: {
    data: Rekap['perlu_tindakan'];
    luarPeriode: number;
    listUrl: string;
    semuaUrl: string;
}) {
    if (data.total === 0) {
        return luarPeriode > 0 ? (
            <p className="flex items-center gap-2 rounded-xl border border-[#f4c7c2] bg-[var(--adm-danger-soft)] px-5 py-3 text-sm text-[var(--adm-danger)]">
                <Siren className="h-4 w-4 shrink-0" aria-hidden="true" />
                Tidak ada tiket lewat tenggat pada periode ini, tetapi {nf(luarPeriode)} tiket dari periode lain masih melewati tenggat.
                <Link href={semuaUrl} className="ml-auto font-semibold underline">
                    Lihat semua waktu
                </Link>
            </p>
        ) : null;
    }

    return (
        <Card className="overflow-hidden border-[#f4c7c2]">
            <div className="flex flex-wrap items-center gap-3 bg-[var(--adm-danger-soft)] px-5 py-4 md:px-6">
                <Siren className="h-5 w-5 shrink-0 text-[var(--adm-danger)]" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold text-[var(--adm-danger)]">Perlu tindakan — {nf(data.total)} tiket melewati tenggat SLA</h2>
                    <p className="text-xs text-[var(--adm-text-2)]">
                        Peringatan EWS juga dikirim ke petugas & koordinator. Urut dari keterlambatan terlama
                        {data.total > data.items.length ? ` · menampilkan ${data.items.length} teratas` : ''}
                        {luarPeriode > 0 ? ` · +${nf(luarPeriode)} dari periode lain` : ''}.
                    </p>
                </div>
                <Link
                    href={listUrl}
                    className="flex items-center gap-1.5 text-sm font-semibold text-[var(--adm-primary)] hover:underline print:hidden"
                >
                    Buka di Manajemen Tiket <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                    <thead className="bg-[var(--adm-surface-2)] text-[11px] font-semibold tracking-[0.06em] text-[var(--adm-text-3)] uppercase">
                        <tr>
                            <th className="px-6 py-3 text-left font-semibold">Tiket</th>
                            <th className="px-3 py-3 text-left font-semibold">Kategori · Kawasan</th>
                            <th className="px-3 py-3 text-left font-semibold">Dampak</th>
                            <th className="px-3 py-3 text-left font-semibold">Tahap</th>
                            <th className="px-3 py-3 text-left font-semibold">Petugas</th>
                            <th className="px-6 py-3 text-left font-semibold">Lewat tenggat</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--adm-border)]">
                        {data.items.map((t) => (
                            <tr key={t.nomor}>
                                <td className="px-6 py-3">
                                    <Link
                                        href={`/admin/tiket/${t.nomor}`}
                                        className="font-[family-name:var(--font-mono)] text-[13px] font-semibold text-[var(--adm-primary)] hover:underline"
                                    >
                                        #{t.nomor}
                                    </Link>
                                    <div className="mt-0.5 max-w-[300px] truncate text-[13px] text-[var(--adm-text-2)]">{t.judul}</div>
                                </td>
                                <td className="px-3 py-3 text-[13px] text-[var(--adm-text-2)]">
                                    {t.kategori ?? '—'} · {t.kawasan ?? '—'}
                                </td>
                                <td className="px-3 py-3">
                                    <ImpactBadge value={t.impact} label={t.impact_label} />
                                </td>
                                <td className="px-3 py-3">
                                    <StatusBadge value={t.status} label={t.status_label} />
                                </td>
                                <td className="px-3 py-3 text-[13px]">
                                    {t.petugas ? (
                                        <span className="flex items-center gap-1.5">
                                            <UserRound className="h-4 w-4 text-[var(--adm-text-3)]" aria-hidden="true" /> {t.petugas}
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5 text-[var(--adm-warning)]">
                                            <UserX className="h-4 w-4" aria-hidden="true" /> Belum ditugaskan
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-3">
                                    <span className="flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[13px] font-semibold text-[var(--adm-danger)]">
                                        <Clock className="h-4 w-4" aria-hidden="true" /> {durasi(t.lewat_menit)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

function EmptyPanel({ rekap }: { rekap: Rekap }) {
    const { dijawab_tara: tara, rujukan } = rekap.alur.tanpa_tiket;
    const target = rekap.dampak;
    const days = (v: string) => target.find((d) => d.value === v)?.selesai_hari ?? '—';

    const entries: { icon: LucideIcon; title: string; text: string; cta: string; href: string; external?: boolean }[] = [
        {
            icon: Globe,
            title: 'Formulir web publik',
            text: 'Warga mengisi formulir pengaduan di portal; tiket langsung terbit dengan nomor TKT-… untuk dilacak.',
            cta: 'Buka formulir',
            href: '/pengaduan/baru',
            external: true,
        },
        {
            icon: FilePenLine,
            title: 'Input manual petugas',
            text: 'Petugas mencatat aduan dari tatap muka, call center, surat, media sosial, atau live chat.',
            cta: 'Input aduan',
            href: '/admin/input-manual',
        },
        {
            icon: MessageCircle,
            title: 'Chat TARA → petugas',
            text: 'Aduan di chat diringkas TARA, diteruskan ke petugas, lalu dijadikan tiket dari Pesan Masuk.',
            cta: 'Buka Pesan Masuk',
            href: '/admin/chat',
        },
    ];

    return (
        <Card className="p-5 md:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]">
                    <Inbox className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                    <h2 className="text-lg font-bold text-[var(--adm-text)]">Matriks akan terisi otomatis begitu tiket pertama tercatat</h2>
                    <p className="mt-1 text-sm text-[var(--adm-text-2)]">
                        {tara > 0 || rujukan > 0
                            ? `Belum ada aduan yang menjadi tiket pada periode ini. TARA sudah melayani ${nf(tara)} percakapan dan ${nf(rujukan)} rujukan ke portal instansi — itu tercatat di Pesan Masuk & Rujukan, bukan di matriks tiket.`
                            : 'Belum ada aduan yang menjadi tiket pada periode ini, dan belum ada percakapan TARA maupun rujukan portal yang tercatat.'}
                    </p>
                </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                {entries.map((e) => {
                    const Icon = e.icon;
                    const cta = (
                        <>
                            {e.cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </>
                    );
                    const ctaClass = 'mt-auto flex items-center gap-1.5 pt-4 text-sm font-semibold text-[var(--adm-primary)] hover:underline';
                    return (
                        <div key={e.title} className="flex flex-col rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-5">
                            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--adm-text)]">
                                <Icon className="h-4 w-4" aria-hidden="true" /> {e.title}
                            </p>
                            <p className="mt-2 text-[13px] text-[var(--adm-text-2)]">{e.text}</p>
                            {e.external ? (
                                <a href={e.href} target="_blank" rel="noopener" className={ctaClass}>
                                    {cta}
                                </a>
                            ) : (
                                <Link href={e.href} className={ctaClass}>
                                    {cta}
                                </Link>
                            )}
                        </div>
                    );
                })}
            </div>

            <p className="mt-5 flex items-start gap-2 rounded-lg bg-[var(--adm-accent-soft)] px-4 py-3 text-[13px] text-[var(--adm-text-2)]">
                <Workflow className="mt-0.5 h-4 w-4 shrink-0 text-[var(--adm-accent)]" aria-hidden="true" />
                Setiap tiket melewati: Menunggu → Diverifikasi → Diproses → Selesai / Ditolak. Tenggat SLA dihitung dari tingkat dampak (Kritis{' '}
                {days('kritis')} · Tinggi {days('tinggi')} · Sedang/Rendah {days('sedang')} hari kerja).
            </p>
        </Card>
    );
}
