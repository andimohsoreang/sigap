import { Link } from '@inertiajs/react';
import { Eye } from 'lucide-react';

import { DataTable, type DataTableColumn } from '@/components/sigap/data-table';
import { Button } from '@/components/ui/button';
import AdminLayout, { StatusBadge } from '@/layouts/admin-layout';

interface TicketRow {
    nomor: string;
    judul: string;
    pelapor: string | null;
    status: string;
    status_label: string;
    prioritas: string | null;
    kategori: string | null;
    kawasan: string | null;
    created_at: string | null;
}

interface Props {
    tickets: {
        data: TicketRow[];
        meta: { total: number; current_page: number; last_page: number; per_page: number; from: number | null; to: number | null };
    };
    filters: { status: string; q: string };
    statuses: Record<string, string>;
}

export default function ManajemenTiket({ tickets, filters, statuses }: Props) {
    const columns: DataTableColumn<TicketRow>[] = [
        {
            accessorKey: 'nomor',
            header: 'ID Tiket',
            meta: { label: 'ID Tiket' },
            cell: ({ row }) => (
                <div>
                    <div className="text-brand-light font-bold">#{row.original.nomor}</div>
                    <div className="mt-0.5 max-w-[240px] truncate text-xs text-gray-500 dark:text-gray-400">{row.original.judul}</div>
                </div>
            ),
        },
        {
            accessorKey: 'pelapor',
            header: 'Pelapor',
            cell: ({ getValue }) => getValue<string | null>() ?? '—',
        },
        {
            id: 'kategori',
            header: 'Kategori / Kawasan',
            accessorFn: (row) => `${row.kategori ?? ''} ${row.kawasan ?? ''}`,
            cell: ({ row }) => (
                <div>
                    <div>{row.original.kategori ?? '—'}</div>
                    <div className="text-xs text-gray-400">{row.original.kawasan ?? '—'}</div>
                </div>
            ),
        },
        {
            accessorKey: 'prioritas',
            header: 'Prioritas',
            cell: ({ getValue }) => (
                <span className="bg-brand-soft text-primary dark:bg-primary-light/20 dark:text-brand-light rounded px-2 py-0.5 text-[10px] font-bold uppercase">
                    {getValue<string | null>() ?? 'umum'}
                </span>
            ),
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
        <AdminLayout title="Manajemen Tiket Aktif" subtitle="Pengaduan masyarakat dari seluruh kanal.">
            <DataTable<TicketRow>
                columns={columns}
                data={tickets.data}
                toolbarTitle="Daftar Tiket"
                searchPlaceholder="Cari nomor / judul tiket..."
                itemLabel="tiket"
                emptyMessage="Belum ada tiket."
                filters={[
                    {
                        columnId: 'status',
                        placeholder: 'Semua Status',
                        options: Object.entries(statuses).map(([value, label]) => ({ value, label })),
                    },
                ]}
                serverSide={{
                    url: '/admin/tiket',
                    meta: tickets.meta,
                    currentValues: { status: filters.status, q: filters.q },
                }}
            />
        </AdminLayout>
    );
}
