import { DataTable, type DataTableColumn } from '@/components/sigap/data-table';
import AdminLayout, { Pill } from '@/layouts/admin-layout';
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
    'auth.login': 'Masuk',
    'auth.logout': 'Keluar',
    'auth.login_failed': 'Gagal masuk',
    'auth.blocked_inactive': 'Akun nonaktif mencoba masuk',
    'auth.password_reset_requested': 'Minta atur ulang sandi',
    'account.registered': 'Daftar akun warga',
    'account.registered_by_staff': 'Akun didaftarkan petugas',
    'account.activation_resent': 'Kirim ulang aktivasi',
    'account.activated': 'Aktivasi akun',
    'account.recovery_sent': 'Pemulihan akun lewat chat',
    'account.recovery_failed': 'Pemulihan akun ditolak',
    'account.email_verified': 'Verifikasi email',
    'account.password_reset': 'Atur ulang sandi',
    'account.password_changed': 'Ganti sandi',
    'account.profile_updated': 'Ubah profil',
    'admin.created': 'Tambah admin',
    'admin.email_updated': 'Ubah email admin',
    'ticket.status_changed': 'Ubah status tiket',
    'ticket.replied': 'Tanggapi tiket',
    'ticket.created_manual': 'Input manual tiket',
    'ticket.deleted_by_reporter': 'Tiket dihapus pelapor',
    'ticket.attachment_downloaded': 'Unduh lampiran tiket',
    'chat.taken': 'Ambil percakapan',
    'chat.closed': 'Tutup percakapan',
    'chat.referred': 'Rujuk percakapan',
    'chat.data_confirmation_requested': 'Minta konfirmasi data',
    'referral.confirmed': 'Rujukan berhasil',
    'referral.failed': 'Rujukan tidak berhasil',
    'referral.reassigned': 'Alihkan rujukan',
    'knowledge.created': 'Buat artikel',
    'knowledge.updated': 'Ubah artikel',
    'knowledge.deleted': 'Hapus artikel',
    'knowledge.published': 'Terbitkan artikel',
    'knowledge.rejected': 'Tolak artikel',
    'knowledge.document_uploaded': 'Unggah dokumen',
    'knowledge.document_deleted': 'Hapus dokumen',
    'knowledge.drafts_from_document': 'Draf dari dokumen',
    'knowledge.source_added': 'Tambah sumber resmi',
    'knowledge.source_deleted': 'Hapus sumber resmi',
    'knowledge.source_toggled': 'Aktif/nonaktif sumber',
    'knowledge.source_basis': 'Ubah dasar hukum sumber',
    'portal.created': 'Tambah portal',
    'portal.updated': 'Ubah portal',
    'region.created': 'Tambah kawasan',
    'region.updated': 'Ubah kawasan',
    'region.deleted': 'Hapus kawasan',
    'channel.created': 'Tambah kanal',
    'channel.synced': 'Sinkron kanal',
    'settings.updated': 'Ubah pengaturan',
    'category.created': 'Tambah kategori',
    'category.deleted': 'Hapus kategori',
    'data.reset_transaksi': 'Hapus semua data transaksi',
};

/** Warna penanda per jenis tindakan: keamanan & penghapusan lebih mencolok. */
function actionTone(action: string): 'danger' | 'warning' | 'info' | 'success' | 'neutral' | 'primary' {
    if (/failed|blocked|deleted|reset|rejected/.test(action)) return 'danger';
    if (action.startsWith('auth.')) return 'neutral';
    if (/created|published|confirmed|activated/.test(action)) return 'success';
    return 'info';
}

export default function LogAktivitas({ logs, filters, actions }: Props) {
    const columns: DataTableColumn<LogEntry>[] = [
        {
            accessorKey: 'created_at',
            header: 'Waktu',
            cell: ({ getValue }) => (
                <span className="text-[13px] text-[var(--adm-text-2)] tabular-nums">{formatDateTime(getValue<string | null>())}</span>
            ),
        },
        {
            accessorKey: 'username',
            header: 'Pengguna',
            cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
        },
        {
            accessorKey: 'action',
            header: 'Aksi',
            meta: { mobile: 'title' },
            cell: ({ getValue }) => <Pill tone={actionTone(getValue<string>())}>{ACTION_LABEL[getValue<string>()] ?? getValue<string>()}</Pill>,
        },
        {
            accessorKey: 'description',
            header: 'Keterangan',
            cell: ({ getValue }) => (
                <span className="block truncate text-[13px]" title={getValue<string | null>() ?? undefined}>
                    {getValue<string | null>() ?? '—'}
                </span>
            ),
            meta: { className: 'w-[40%] max-w-0 whitespace-normal' },
        },
        {
            accessorKey: 'ip_address',
            header: 'IP',
            meta: { mobile: 'hide' },
            cell: ({ getValue }) => <span className="font-mono text-xs text-[var(--adm-text-3)]">{getValue<string | null>() ?? '—'}</span>,
        },
    ];

    return (
        <AdminLayout title="Log Aktivitas" subtitle="Jejak audit: siapa melakukan apa dan kapan. Tidak dapat diubah.">
            <DataTable<LogEntry>
                columns={columns}
                data={logs.data}
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
