import { Link } from '@inertiajs/react';
import { AlertTriangle, CalendarDays, ChevronRight, LoaderCircle, Tag, Timer } from 'lucide-react';

import { DataTable, type DataTableColumn } from '@/components/sigap/data-table';
import { Button } from '@/components/ui/button';
import AdminLayout, { AdminStat, ImpactBadge, StatusBadge } from '@/layouts/admin-layout';
import { formatDate, OPEN_STATUSES, slaDeadline } from '@/lib/admin-format';
import { cn } from '@/lib/utils';

interface Row {
    nomor: string;
    judul: string;
    nama: string | null;
    kontak: string | null;
    nip: string | null;
    unit: string | null;
    lokasi: string | null;
    kategori: string | null;
    urgensi: string | null;
    impact: string | null;
    status: string;
    status_label: string;
    petugas: string | null;
    created_at: string | null;
    tenggat_sla: string | null;
    overdue: boolean;
}

interface Props {
    tickets: {
        data: Row[];
        meta: { total: number; current_page: number; last_page: number; per_page: number; from: number | null; to: number | null };
    };
    stats: { today: number; this_month: number; top_category: string; avg_resolution_hours: number; berjalan: number; ews: number };
    filters: { q: string; status: string };
    statuses: Record<string, string>;
}

/** Rata-rata penyelesaian: jam di bawah 2 hari, selebihnya hari (227,9 jam → "9,5 hari"). */
function durasi(jam: number): { value: string; unit: string } {
    if (!jam) return { value: '—', unit: '' };
    if (jam < 48) return { value: jam.toLocaleString('id-ID', { maximumFractionDigits: 1 }), unit: 'jam' };
    return { value: (jam / 24).toLocaleString('id-ID', { maximumFractionDigits: 1 }), unit: 'hari' };
}

export default function Internal({ tickets, stats, filters, statuses }: Props) {
    const rata = durasi(stats.avg_resolution_hours);

    const columns: DataTableColumn<Row>[] = [
        {
            accessorKey: 'nomor',
            header: 'Tiket',
            meta: { label: 'Tiket', mobile: 'title', className: 'w-[32%] max-w-0 whitespace-normal' },
            cell: ({ row }) => (
                <Link href={`/admin/tiket/${row.original.nomor}`} className="group block min-w-0">
                    <span className="block font-mono text-[12.5px] font-semibold text-[var(--acd-link,var(--adm-primary))] group-hover:underline">
                        {row.original.nomor}
                    </span>
                    <span className="mt-0.5 block truncate font-medium text-[var(--adm-text)]">{row.original.judul}</span>
                    <span className="mt-0.5 block text-xs text-[var(--adm-text-3)]">
                        {row.original.kategori ?? 'Tanpa kategori'} · {formatDate(row.original.created_at)}
                    </span>
                </Link>
            ),
        },
        {
            accessorKey: 'nama',
            header: 'Pegawai',
            meta: { label: 'Pegawai', className: 'w-[24%] max-w-0 whitespace-normal' },
            cell: ({ row }) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-[var(--adm-text)]">{row.original.nama ?? '—'}</div>
                    <div
                        className="truncate text-xs text-[var(--adm-text-3)]"
                        title={[row.original.unit, row.original.lokasi].filter(Boolean).join(' · ')}
                    >
                        {[row.original.unit, row.original.lokasi].filter(Boolean).join(' · ') || '—'}
                    </div>
                    {row.original.nip && <div className="font-mono text-[11px] text-[var(--adm-text-3)]">NIP {row.original.nip}</div>}
                </div>
            ),
        },
        {
            accessorKey: 'urgensi',
            header: 'Dampak',
            meta: { label: 'Dampak', disableSorting: true },
            cell: ({ row }) => <ImpactBadge value={row.original.impact} label={row.original.urgensi} />,
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
            meta: { label: 'Status', disableSorting: true },
            cell: ({ row }) => <StatusBadge value={row.original.status} label={row.original.status_label} />,
        },
        {
            accessorKey: 'petugas',
            header: 'Petugas',
            meta: { label: 'Petugas', disableSorting: true },
            cell: ({ getValue }) =>
                getValue<string | null>() ?? <span className="text-xs font-medium whitespace-nowrap text-[var(--adm-warning)]">Belum ada</span>,
        },
        {
            id: 'aksi',
            header: '',
            // Desktop: nomor tiket sudah berupa tautan; kolom ini hanya untuk kartu ponsel.
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
        <AdminLayout title="Tiket Internal" subtitle="Laporan gangguan sarana & TIK kantor dari pegawai. Hanya terlihat oleh Super Admin.">
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <AdminStat label="Sedang berjalan" value={stats.berjalan} unit="tiket" icon={LoaderCircle} />
                <AdminStat
                    label="Lewat SLA"
                    value={stats.ews}
                    unit="tiket"
                    tone={stats.ews > 0 ? 'red' : 'brand'}
                    icon={AlertTriangle}
                    hint={stats.ews > 0 ? 'Segera tindak lanjuti' : undefined}
                />
                <AdminStat
                    label="Masuk bulan ini"
                    value={stats.this_month}
                    unit="tiket"
                    icon={CalendarDays}
                    hint={stats.today > 0 ? `${stats.today} hari ini` : 'Belum ada hari ini'}
                />
                <AdminStat
                    label="Rata-rata penyelesaian"
                    value={rata.value}
                    unit={rata.unit}
                    icon={Timer}
                    hint={`Kategori terbanyak: ${stats.top_category}`}
                />
            </div>

            <DataTable<Row>
                columns={columns}
                data={tickets.data}
                searchPlaceholder="Cari nomor, judul, pegawai, atau unit…"
                itemLabel="tiket internal"
                emptyMessage="Belum ada tiket internal."
                rowClassName={(r) => (r.overdue ? 'bg-[var(--adm-danger-soft)]/40' : undefined)}
                filters={[
                    {
                        columnId: 'status',
                        placeholder: 'Semua status',
                        options: Object.entries(statuses).map(([value, label]) => ({ value, label })),
                    },
                ]}
                serverSide={{
                    url: '/admin/tiket-internal',
                    meta: tickets.meta,
                    currentValues: { q: filters.q, status: filters.status },
                }}
            />
            <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--adm-text-2)]">
                <Tag className="h-3.5 w-3.5" aria-hidden="true" /> Pegawai melapor lewat formulir internal; tiket ini tidak tampil di halaman publik.
            </p>
        </AdminLayout>
    );
}
