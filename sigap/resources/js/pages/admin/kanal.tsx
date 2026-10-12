import { DataTable, type DataTableColumn } from '@/components/sigap/data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminLayout from '@/layouts/admin-layout';
import { router, useForm } from '@inertiajs/react';
import { Building2, Hash, RefreshCw, RotateCw, ShieldCheck } from 'lucide-react';
import { type FormEvent } from 'react';
import { formatDateTime } from './matriks';

interface Channel {
    id: number;
    type: string | null;
    type_label: string | null;
    name: string;
    account_name: string | null;
    url: string | null;
    status: string | null;
    last_synced_at: string | null;
}

interface Log {
    channel: string | null;
    pulled_count: number;
    status: string;
    message: string | null;
    created_at: string | null;
}

interface Props {
    channels: Channel[];
    integrations: { key: string; label: string }[];
    logs: Log[];
    is_super_admin: boolean;
}

export default function Kanal({ channels, integrations, logs, is_super_admin }: Props) {
    const medsos = useForm({ platform: '', account: '', url: '' });
    const kantor = useForm({ instansi: '', pic: '', url: '' });

    const channelColumns: DataTableColumn<Channel>[] = [
        {
            accessorKey: 'name',
            header: 'Nama Kanal / Akun',
            cell: ({ getValue }) => <span className="font-bold text-gray-800 dark:text-white">{getValue<string>()}</span>,
        },
        {
            accessorKey: 'type',
            header: 'Jenis Kanal',
            cell: ({ row }) => (
                <span className="text-primary dark:text-brand-light rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase dark:bg-blue-900/30">
                    {row.original.type_label ?? row.original.type}
                </span>
            ),
        },
        {
            id: 'info',
            header: 'Informasi / Tautan',
            accessorFn: (c) => c.url ?? c.account_name ?? '',
            cell: ({ row }) => (
                <span className="max-w-[220px] truncate text-xs text-gray-500 dark:text-gray-400">
                    {row.original.url ?? row.original.account_name ?? '—'}
                </span>
            ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            meta: { className: 'text-center' },
            cell: ({ getValue }) => <span className="text-xs font-bold text-green-500">● {getValue<string | null>() ?? 'Aktif'}</span>,
        },
    ];

    const logColumns: DataTableColumn<Log>[] = [
        {
            accessorKey: 'channel',
            header: 'Kanal',
            cell: ({ getValue }) => <span className="font-bold text-gray-800 dark:text-white">{getValue<string | null>() ?? '—'}</span>,
        },
        {
            accessorKey: 'created_at',
            header: 'Waktu',
            cell: ({ getValue }) => <span className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(getValue<string | null>())}</span>,
        },
        {
            accessorKey: 'pulled_count',
            header: 'Data Ditarik',
            meta: { className: 'text-right' },
            cell: ({ getValue }) => <>{getValue<number>()} tiket</>,
        },
        {
            accessorKey: 'status',
            header: 'Status',
            meta: { className: 'text-center' },
            cell: ({ getValue }) => (
                <span className={getValue<string>() === 'berhasil' ? 'text-xs font-bold text-green-500' : 'text-xs font-bold text-red-500'}>
                    ✓ {getValue<string>()}
                </span>
            ),
        },
    ];

    const submitMedsos = (e: FormEvent) => {
        e.preventDefault();
        medsos.transform((d) => ({ type: 'sosmed', name: d.account, account_name: d.platform, url: d.url }));
        medsos.post('/admin/kanal', { preserveScroll: true, onSuccess: () => medsos.reset() });
    };

    const submitKantor = (e: FormEvent) => {
        e.preventDefault();
        kantor.transform((d) => ({ type: 'kantor', name: d.instansi, account_name: d.pic, url: d.url || null }));
        kantor.post('/admin/kanal', { preserveScroll: true, onSuccess: () => kantor.reset() });
    };

    return (
        <AdminLayout title="Manajemen Kanal Pengaduan" subtitle="Kanal medsos, kantor, dan integrasi nasional.">
            <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card className="dark:bg-dark-card border-gray-200 dark:border-gray-700">
                    <CardHeader className="border-b border-gray-100 pb-3 dark:border-gray-700">
                        <CardTitle className="flex items-center gap-2 text-base text-gray-800 dark:text-white">
                            <Hash className="text-brand-light h-5 w-5" /> Tambah Media Sosial
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <form onSubmit={submitMedsos} className="space-y-4">
                            <Field label="Platform" required error={medsos.errors.account_name}>
                                <Select value={medsos.data.platform} onValueChange={(v) => medsos.setData('platform', v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih Platform" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {['Instagram', 'Facebook', 'X / Twitter', 'TikTok'].map((p) => (
                                            <SelectItem key={p} value={p}>
                                                {p}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Nama Akun / Username" required error={medsos.errors.name}>
                                <Input
                                    value={medsos.data.account}
                                    onChange={(e) => medsos.setData('account', e.target.value)}
                                    placeholder="Cth: @KemenTransRI"
                                />
                            </Field>
                            <Field label="Tautan / URL Akun" required error={medsos.errors.url}>
                                <Input
                                    value={medsos.data.url}
                                    onChange={(e) => medsos.setData('url', e.target.value)}
                                    placeholder="https://instagram.com/..."
                                />
                            </Field>
                            <div className="flex justify-end">
                                <Button type="submit" disabled={medsos.processing} className="w-full lg:w-auto">
                                    Simpan Medsos
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card className="dark:bg-dark-card border-gray-200 dark:border-gray-700">
                    <CardHeader className="border-b border-gray-100 pb-3 dark:border-gray-700">
                        <CardTitle className="flex items-center gap-2 text-base text-gray-800 dark:text-white">
                            <Building2 className="text-brand-light h-5 w-5" /> Tambah Kantor Pengaduan
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <form onSubmit={submitKantor} className="space-y-4">
                            <Field label="Nama Instansi / Kantor" required error={kantor.errors.name}>
                                <Input
                                    value={kantor.data.instansi}
                                    onChange={(e) => kantor.setData('instansi', e.target.value)}
                                    placeholder="Cth: Dinas Transmigrasi Prov. Papua"
                                />
                            </Field>
                            <Field label="Nama Admin (PIC)" required error={kantor.errors.account_name}>
                                <Input
                                    value={kantor.data.pic}
                                    onChange={(e) => kantor.setData('pic', e.target.value)}
                                    placeholder="Nama Penanggung Jawab"
                                />
                            </Field>
                            <Field label="Tautan / URL (Opsional)" error={kantor.errors.url}>
                                <Input value={kantor.data.url} onChange={(e) => kantor.setData('url', e.target.value)} placeholder="https://..." />
                            </Field>
                            <div className="flex justify-end">
                                <Button type="submit" disabled={kantor.processing} className="w-full lg:w-auto">
                                    Simpan Kantor
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>

            <DataTable<Channel>
                columns={channelColumns}
                data={channels}
                toolbarTitle="Daftar Kanal Terdaftar"
                searchPlaceholder="Cari nama kanal / akun..."
                itemLabel="kanal"
                emptyMessage="Belum ada kanal."
            />

            {/* Integrasi nasional */}
            <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-gray-800 dark:text-white">
                <RotateCw className="text-brand-light h-5 w-5" /> Integrasi Kanal Nasional
            </h3>
            <p className="mb-4 max-w-2xl text-xs text-gray-500 dark:text-gray-400">
                Sinkronisasi data pengaduan dari sistem nasional (Perpres No. 76 Tahun 2013). Adapter masih berupa <strong>stub</strong> (PRD D7).
                Hanya Super Admin yang dapat memicu sinkronisasi.
            </p>

            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                {integrations.map((integ) => {
                    const lastLog = logs.find((l) => (l.channel ?? '').toLowerCase().includes(integ.key));
                    return (
                        <Card key={integ.key} className="dark:bg-dark-card border-gray-200 dark:border-gray-700">
                            <CardContent className="p-6">
                                <div className="mb-4 flex items-start justify-between border-b border-gray-100 pb-3 dark:border-gray-700">
                                    <h4 className="flex items-center gap-2 font-bold text-gray-800 dark:text-white">
                                        <ShieldCheck className="text-brand-light h-4 w-4" /> {integ.label}
                                    </h4>
                                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-600 dark:bg-green-900/20 dark:text-green-400">
                                        Terhubung (stub)
                                    </span>
                                </div>
                                <p className="mb-4 text-[11px] text-gray-400 dark:text-gray-500">
                                    Terakhir sinkron:{' '}
                                    <span className="font-semibold text-gray-600 dark:text-gray-300">
                                        {lastLog ? formatDateTime(lastLog.created_at) : 'Belum pernah'}
                                    </span>
                                    {lastLog && <> · {lastLog.pulled_count} tiket ditarik</>}
                                </p>
                                {is_super_admin ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => router.post(`/admin/integrasi/${integ.key}`, {}, { preserveScroll: true })}
                                    >
                                        <RefreshCw className="h-4 w-4" /> Sinkron Sekarang
                                    </Button>
                                ) : (
                                    <p className="text-xs text-gray-400 italic">Hanya Super Admin.</p>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <DataTable<Log>
                columns={logColumns}
                data={logs}
                toolbarTitle="Log Sinkronisasi Kanal Nasional"
                searchPlaceholder="Cari kanal..."
                itemLabel="log sinkronisasi"
                emptyMessage="Belum ada log sinkronisasi."
            />
        </AdminLayout>
    );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600 dark:text-gray-400">
                {label} {required && <span className="text-red-500">*</span>}
            </Label>
            {children}
            {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
        </div>
    );
}
