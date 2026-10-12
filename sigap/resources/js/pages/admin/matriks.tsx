import { Link } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, Clock, Eye, Printer, Table2 } from 'lucide-react';

import { DataTable, type DataTableColumn } from '@/components/sigap/data-table';
import { Button } from '@/components/ui/button';
import AdminLayout, { AdminStat, ImpactBadge, StatusBadge } from '@/layouts/admin-layout';
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

interface Options {
    regions: { id: number; name: string; province: string | null }[];
    categories: { id: number; name: string }[];
}

interface Props {
    tickets: { data: TicketRow[]; meta: PaginationMeta };
    rekap: { total: number; ews: number; sla_pct: number; by_status: Record<string, number> };
    filters: Record<string, string>;
    options: Options;
}

type PaginationMeta = { total: number; current_page: number; last_page: number; per_page: number; from: number | null; to: number | null };

export default function Matriks({ tickets, rekap, filters, options }: Props) {
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
            title="Matriks Rekapitulasi Tiket"
            actions={
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" /> Print
                </Button>
            }
        >
            {/* KPI */}
            <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
                <AdminStat label="Total Tiket Rekapan" value={rekap.total.toLocaleString('id-ID')} tone="brand" icon={Table2} />
                <AdminStat
                    label="Peringatan EWS"
                    value={
                        <>
                            {rekap.ews} <span className="text-xs font-normal text-red-400">Terlambat</span>
                        </>
                    }
                    tone="red"
                    icon={AlertTriangle}
                />
                <AdminStat
                    label="SLA Terpenuhi"
                    value={
                        <>
                            {rekap.sla_pct}% <span className="text-xs font-normal text-green-500">Tepat Waktu</span>
                        </>
                    }
                    tone="green"
                    icon={CheckCircle2}
                />
            </div>

            <DataTable<TicketRow>
                columns={columns}
                data={tickets.data}
                toolbarTitle="Rekapitulasi"
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
                        options: [
                            { value: 'baru', label: 'Menunggu' },
                            { value: 'verifikasi', label: 'Diverifikasi' },
                            { value: 'diproses', label: 'Diproses' },
                            { value: 'selesai', label: 'Selesai' },
                            { value: 'ditolak', label: 'Ditolak' },
                        ],
                    },
                ]}
                rowClassName={(row) => cn(row.overdue && 'bg-red-50/40 hover:bg-red-50/60')}
                serverSide={{
                    url: '/admin/matriks',
                    meta: tickets.meta,
                    currentValues: filters,
                }}
            />
        </AdminLayout>
    );
}

export function formatDate(value: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
