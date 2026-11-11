import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { AlertTriangle, ChevronRight, FilePenLine, X } from 'lucide-react';

import { DataTable, type DataTableColumn } from '@/components/sigap/data-table';
import { Button } from '@/components/ui/button';
import AdminLayout, { ImpactBadge, StatusBadge } from '@/layouts/admin-layout';
import { OPEN_STATUSES, slaDeadline } from '@/lib/admin-format';
import { PROVINCE_OPTIONS } from '@/lib/provinces';
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
    petugas: string | null;
    unit_penangan: string | null;
    created_at: string | null;
    tenggat_sla: string | null;
    overdue: boolean;
}

type TabKey = 'semua' | 'aktif' | 'ews' | 'belum' | 'belum_disposisi' | 'tinjau' | 'selesai';

interface Props {
    tickets: {
        data: TicketRow[];
        meta: { total: number; current_page: number; last_page: number; per_page: number; from: number | null; to: number | null };
    };
    filters: Record<string, string>;
    /** Saringan aktif tanpa kontrol di halaman ini (mis. dari klik sel Matriks Rekapitulasi). */
    chips: { key: string; label: string }[];
    statuses: Record<string, string>;
    impacts: Record<string, string>;
    tab_counts: Record<TabKey, number>;
}

/** Tab cepat: saringan yang paling sering dipakai petugas saat memilah antrean. */
const TABS: { key: TabKey; label: string; params: Record<string, string>; superAdminOnly?: boolean }[] = [
    { key: 'aktif', label: 'Aktif', params: { status: 'aktif' } },
    { key: 'ews', label: 'Lewat SLA', params: { ews: '1' } },
    { key: 'belum_disposisi', label: 'Belum didisposisi', params: { status: 'aktif', unit: 'none' }, superAdminOnly: true },
    { key: 'belum', label: 'Belum ditugaskan', params: { status: 'aktif', petugas: 'none' } },
    { key: 'tinjau', label: 'Perlu tinjau ulang', params: { tinjau: '1' } },
    { key: 'selesai', label: 'Selesai', params: { status: 'selesai' } },
    { key: 'semua', label: 'Semua', params: {} },
];
const TAB_KEYS = ['status', 'ews', 'petugas', 'unit', 'tinjau'];

export default function ManajemenTiket({ tickets, filters, chips, impacts, tab_counts: counts }: Props) {
    const { auth } = usePage<SharedData>().props;
    const isSuper = auth?.user?.role === 'super_admin';
    const tabs = TABS.filter((t) => !t.superAdminOnly || isSuper);
    const url = (params: Record<string, string>) => {
        const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
        return `/admin/tiket${q.toString() ? `?${q}` : ''}`;
    };
    /** URL halaman ini tanpa satu/semua saringan chip. */
    const withoutFilters = (keys: string[]) => url(Object.fromEntries(Object.entries(filters).filter(([k]) => !keys.includes(k))));
    const tabUrl = (params: Record<string, string>) =>
        url({ ...Object.fromEntries(Object.entries(filters).filter(([k]) => !TAB_KEYS.includes(k) && k !== 'page')), ...params });
    const activeTab =
        tabs.find((t) => TAB_KEYS.every((k) => (filters[k] ?? '') === (t.params[k] ?? '')))?.key ??
        (TAB_KEYS.some((k) => filters[k]) ? null : 'semua');

    const columns: DataTableColumn<TicketRow>[] = [
        {
            accessorKey: 'nomor',
            header: 'Tiket',
            meta: { label: 'Tiket', mobile: 'title', className: 'w-[34%] max-w-0 whitespace-normal' },
            cell: ({ row }) => (
                <Link href={`/admin/tiket/${row.original.nomor}`} className="group block min-w-0">
                    <span className="block font-mono text-[12.5px] font-semibold text-[var(--acd-link,var(--adm-primary))] group-hover:underline">
                        {row.original.nomor}
                    </span>
                    <span className="mt-0.5 block truncate font-medium text-[var(--adm-text)]">{row.original.judul}</span>
                    <span className="mt-0.5 block text-xs text-[var(--adm-text-3)]">{row.original.pelapor ?? 'Tanpa nama'}</span>
                </Link>
            ),
        },
        {
            id: 'kategori',
            header: 'Kategori & wilayah',
            meta: { label: 'Kategori & wilayah', className: 'w-[24%] max-w-0 whitespace-normal' },
            accessorFn: (row) => `${row.kategori ?? ''} ${row.kawasan ?? ''}`,
            cell: ({ row }) => (
                <div className="min-w-0">
                    <div className="truncate">{row.original.kategori ?? 'Tanpa kategori'}</div>
                    <div className="truncate text-xs text-[var(--adm-text-3)]" title={row.original.kawasan ?? undefined}>
                        {row.original.kawasan ?? '—'}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'impact',
            header: 'Dampak',
            cell: ({ row }) => <ImpactBadge value={row.original.impact} label={row.original.impact_label} />,
        },
        {
            id: 'tenggat_sla',
            accessorKey: 'tenggat_sla',
            header: 'Tenggat SLA',
            meta: { label: 'Tenggat SLA' },
            cell: ({ row }) => {
                const d = slaDeadline(row.original.tenggat_sla, OPEN_STATUSES.includes(row.original.status));
                return (
                    <span
                        className={cn(
                            'inline-flex items-center gap-1 text-[13px] whitespace-nowrap tabular-nums',
                            d.tone === 'late' && 'font-semibold text-[var(--adm-danger)]',
                            d.tone === 'soon' && 'font-semibold text-[var(--adm-warning)]',
                            d.tone === 'ok' && 'text-[var(--adm-text-2)]',
                            d.tone === 'none' && 'text-[var(--adm-text-3)]',
                        )}
                    >
                        {d.tone === 'late' && <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
                        {d.text}
                    </span>
                );
            },
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => <StatusBadge value={row.original.status} label={row.original.status_label} />,
            meta: { disableSorting: true },
        },
        {
            id: 'petugas',
            accessorKey: 'petugas',
            header: 'Petugas',
            meta: { disableSorting: true },
            cell: ({ row }) => (
                <span className="block">
                    {row.original.petugas ?? <span className="text-xs font-medium whitespace-nowrap text-[var(--adm-warning)]">Belum ada</span>}
                    {row.original.unit_penangan && (
                        <span className="block text-xs whitespace-nowrap text-[var(--adm-text-3)]">{row.original.unit_penangan}</span>
                    )}
                </span>
            ),
        },
        {
            id: 'aksi',
            header: '',
            // Desktop: judul tiket sudah berupa tautan, kolom aksi hanya untuk kartu ponsel.
            meta: { label: 'Buka', disableToggle: true, disableSorting: true, className: 'hidden', mobile: 'end' },
            cell: ({ row }) => (
                <Button asChild size="sm" variant="ghost" className="h-8 gap-1 px-2 text-[var(--adm-text-2)]">
                    <Link href={`/admin/tiket/${row.original.nomor}`} aria-label={`Buka tiket ${row.original.nomor}`}>
                        <span className="md:hidden">Buka</span>
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </Button>
            ),
        },
    ];

    return (
        <AdminLayout
            title="Manajemen Tiket"
            subtitle="Pengaduan masyarakat dari seluruh kanal. Mulai dari tab Lewat SLA dan Belum ditugaskan."
            actions={
                <Button asChild className="h-10">
                    <Link href="/admin/input-manual">
                        <FilePenLine className="h-4 w-4" aria-hidden="true" /> Input manual
                    </Link>
                </Button>
            }
        >
            <nav aria-label="Tampilan tiket" className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1">
                {tabs.map((t) => {
                    const active = activeTab === t.key;
                    const n = counts[t.key] ?? 0;
                    return (
                        <Link
                            key={t.key}
                            href={tabUrl(t.params)}
                            preserveScroll
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                                'flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-[13.5px] font-medium transition-colors',
                                active
                                    ? 'border-[var(--adm-primary)] bg-[var(--adm-primary)] text-white'
                                    : 'border-[var(--adm-border)] bg-[var(--acd-surface,#fff)] text-[var(--adm-text-2)] hover:border-[var(--adm-border-strong)] hover:text-[var(--adm-text)]',
                            )}
                        >
                            {t.label}
                            <span
                                className={cn(
                                    'rounded-full px-1.5 text-xs font-semibold tabular-nums',
                                    active
                                        ? 'bg-black/25 text-white'
                                        : t.key === 'ews' && n > 0
                                          ? 'bg-[var(--adm-danger-soft)] text-[var(--adm-danger)]'
                                          : 'bg-[var(--adm-surface-2)] text-[var(--adm-text-3)]',
                                )}
                            >
                                {n}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            {chips.length > 0 && (
                <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-[var(--adm-text-3)]">Disaring:</span>
                    {chips.map((c) => (
                        <Link
                            key={c.key}
                            href={withoutFilters([c.key])}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--adm-border-strong)] bg-[var(--acd-surface,#fff)] px-3 py-1 text-xs font-medium hover:bg-[var(--adm-surface-2)]"
                        >
                            {c.label}
                            <X className="h-3.5 w-3.5" aria-label="Hapus saringan" />
                        </Link>
                    ))}
                    <Link
                        href={withoutFilters(chips.map((c) => c.key))}
                        className="text-xs font-semibold text-[var(--acd-link,var(--adm-primary))] hover:underline"
                    >
                        Hapus semua
                    </Link>
                </div>
            )}

            <DataTable<TicketRow>
                columns={columns}
                data={tickets.data}
                searchPlaceholder="Cari nomor atau judul…"
                itemLabel="tiket"
                emptyMessage="Tidak ada tiket di tampilan ini."
                rowClassName={(r) => (r.overdue ? 'bg-[var(--adm-danger-soft)]/40' : undefined)}
                filters={[
                    {
                        columnId: 'impact',
                        placeholder: 'Semua dampak',
                        options: Object.entries(impacts).map(([value, label]) => ({ value, label })),
                    },
                    {
                        columnId: 'provinsi',
                        placeholder: 'Semua provinsi',
                        options: PROVINCE_OPTIONS.map((p) => ({ value: p, label: p })),
                    },
                ]}
                serverSide={{
                    url: '/admin/tiket',
                    meta: tickets.meta,
                    currentValues: filters,
                }}
            />
        </AdminLayout>
    );
}
