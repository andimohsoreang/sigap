import { Link } from '@inertiajs/react';
import { CalendarDays, Eye, Timer, Wifi } from 'lucide-react';

import { DataTable, type DataTableColumn } from '@/components/sigap/data-table';
import { Button } from '@/components/ui/button';
import AdminLayout, { AdminStat, ImpactBadge, StatusBadge } from '@/layouts/admin-layout';
import { formatDate } from './matriks';

interface Row {
    nomor: string;
    nama: string | null;
    kontak: string | null;
    kategori: string | null;
    urgensi: string | null;
    status: string;
    status_label: string;
    created_at: string | null;
}

interface Props {
    tickets: {
        data: Row[];
        meta: { total: number; current_page: number; last_page: number; per_page: number; from: number | null; to: number | null };
    };
    stats: { today: number; this_month: number; top_category: string; avg_resolution_hours: number };
    filters: { q: string; status: string };
    statuses: Record<string, string>;
}

export default function Internal({ tickets, stats, filters, statuses }: Props) {
    const columns: DataTableColumn<Row>[] = [
        {
            accessorKey: 'nomor',
            header: 'ID Tiket',
            cell: ({ getValue }) => <span className="font-bold text-orange-500">#{getValue<string>()}</span>,
        },
        {
            accessorKey: 'nama',
            header: 'Pegawai / Kontak',
            cell: ({ row }) => (
                <div>
                    <span className="font-semibold text-gray-800 dark:text-white">{row.original.nama ?? '—'}</span>
                    <br />
                    <span className="text-[11px] text-gray-400">
                        {row.original.kontak ?? '—'} · {formatDate(row.original.created_at)}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: 'kategori',
            header: 'Kategori',
            cell: ({ getValue }) => getValue<string | null>() ?? '—',
        },
        {
            accessorKey: 'urgensi',
            header: 'Urgensi',
            cell: ({ row }) => <ImpactBadge value={row.original.urgensi?.toLowerCase()} label={row.original.urgensi} />,
            meta: { disableSorting: true },
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => <StatusBadge value={row.original.status} label={row.original.status_label} />,
            meta: { disableSorting: true },
        },
        {
            id: 'aksi',
            header: 'Aksi',
            meta: { label: 'Aksi', disableToggle: true, disableSorting: true, className: 'text-center' },
            cell: ({ row }) => (
                <Button asChild size="sm" variant="outline" className="h-8 w-8 p-0">
                    <Link href={`/admin/tiket/${row.original.nomor}`} title="Lihat detail">
                        <Eye className="h-4 w-4" />
                    </Link>
                </Button>
            ),
        },
    ];

    return (
        <AdminLayout title="Tiket Internal Pegawai" subtitle="Laporan gangguan sarana & TIK kantor dari pegawai internal.">
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <AdminStat label="Laporan Hari Ini" value={stats.today} tone="orange" icon={CalendarDays} />
                <AdminStat label="Laporan Bulan Ini" value={stats.this_month} tone="indigo" icon={CalendarDays} />
                <AdminStat label="Top Kategori" value={<span className="text-sm">{stats.top_category}</span>} tone="red" icon={Wifi} />
                <AdminStat
                    label="Rata-rata Penyelesaian"
                    value={
                        <>
                            {stats.avg_resolution_hours}
                            <span className="text-xs font-normal text-gray-500"> Jam</span>
                        </>
                    }
                    tone="green"
                    icon={Timer}
                />
            </div>

            <DataTable<Row>
                columns={columns}
                data={tickets.data}
                toolbarTitle="Laporan Internal"
                searchPlaceholder="Cari nomor / pelapor..."
                itemLabel="tiket internal"
                emptyMessage="Belum ada tiket internal."
                filters={[
                    {
                        columnId: 'status',
                        placeholder: 'Semua Status',
                        options: Object.entries(statuses).map(([value, label]) => ({ value, label })),
                    },
                ]}
                serverSide={{
                    url: '/admin/tiket-internal',
                    meta: tickets.meta,
                    currentValues: { q: filters.q, status: filters.status },
                }}
            />
        </AdminLayout>
    );
}
