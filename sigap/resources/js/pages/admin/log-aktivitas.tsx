import { History } from 'lucide-react';

import { DataTable, type DataTableColumn } from '@/components/sigap/data-table';
import AdminLayout from '@/layouts/admin-layout';
import { formatDateTime } from '@/lib/sigap';

interface LogEntry {
    id: number;
    username: string;
    action: string;
    description: string | null;
    ip_address: string | null;
    created_at: string | null;
}

interface Props {
    logs: {
        data: LogEntry[];
        meta: {
            total: number;
            current_page: number;
            last_page: number;
            per_page: number;
            from: number | null;
            to: number | null;
        };
    };
    filters: { action: string; q: string };
    actions: string[];
}

const ACTION_LABEL: Record<string, string> = {
    'ticket.status_changed': 'Ubah Status Tiket',
    'account.registered': 'Daftar Akun Warga',
    'account.registered_by_staff': 'Akun Didaftarkan Petugas',
    'account.activation_resent': 'Kirim Ulang Aktivasi',
    'account.activated': 'Aktivasi Akun',
    'account.recovery_sent': 'Pemulihan Akun via Chat',
    'account.recovery_failed': 'Pemulihan Akun Ditolak',
    'account.email_verified': 'Verifikasi Email',
    'account.password_reset': 'Atur Ulang Sandi',
    'auth.password_reset_requested': 'Minta Atur Ulang Sandi',
    'ticket.replied': 'Tanggapan Tiket',
    'ticket.created_manual': 'Input Manual Tiket',
    'admin.created': 'Tambah Admin',
    'admin.email_updated': 'Ubah Email Admin',
    'region.created': 'Tambah Kawasan',
    'region.updated': 'Ubah Kawasan',
    'region.deleted': 'Hapus Kawasan',
    'channel.created': 'Tambah Kanal',
    'channel.synced': 'Sinkron Kanal',
    'settings.updated': 'Ubah Pengaturan',
    'category.created': 'Tambah Kategori',
    'category.deleted': 'Hapus Kategori',
};

export default function LogAktivitas({ logs, filters, actions }: Props) {
    const columns: DataTableColumn<LogEntry>[] = [
        {
            accessorKey: 'created_at',
            header: 'Waktu',
            cell: ({ getValue }) => <span className="text-xs text-gray-500">{formatDateTime(getValue<string | null>())}</span>,
        },
        {
            accessorKey: 'username',
            header: 'Pengguna',
            cell: ({ getValue }) => (
                <span className="flex items-center gap-2 font-bold">
                    <History className="text-brand-light h-4 w-4" />
                    {getValue<string>()}
                </span>
            ),
        },
        {
            accessorKey: 'action',
            header: 'Aksi',
            cell: ({ getValue }) => (
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                    {ACTION_LABEL[getValue<string>()] ?? getValue<string>()}
                </span>
            ),
        },
        {
            accessorKey: 'description',
            header: 'Keterangan',
            cell: ({ getValue }) => <span className="text-xs">{getValue<string | null>() ?? '—'}</span>,
            meta: { className: 'max-w-[320px] truncate' },
        },
        {
            accessorKey: 'ip_address',
            header: 'IP',
            cell: ({ getValue }) => <span className="font-mono text-xs text-gray-400">{getValue<string | null>() ?? '—'}</span>,
        },
    ];

    return (
        <AdminLayout title="Log Aktivitas" subtitle="Jejak audit tindakan admin (SEC-08).">
            <DataTable<LogEntry>
                columns={columns}
                data={logs.data}
                toolbarTitle="Jejak Audit"
                searchPlaceholder="Cari pengguna atau keterangan..."
                itemLabel="aktivitas"
                emptyMessage="Belum ada aktivitas tercatat."
                filters={[
                    {
                        columnId: 'action',
                        placeholder: 'Semua aksi',
                        options: actions.map((a) => ({ value: a, label: ACTION_LABEL[a] ?? a })),
                    },
                ]}
                serverSide={{
                    url: '/admin/log-aktivitas',
                    meta: logs.meta,
                    currentValues: { action: filters.action, q: filters.q },
                }}
            />
        </AdminLayout>
    );
}
