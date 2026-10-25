import { DataTable, type DataTableColumn } from '@/components/sigap/data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminLayout from '@/layouts/admin-layout';
import { formatDateTime } from '@/lib/admin-format';
import { router, useForm } from '@inertiajs/react';
import { Building2, Hash, RefreshCw, RotateCw, ShieldCheck } from 'lucide-react';
import { type FormEvent } from 'react';

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
    // Nama field mengikuti validasi backend (AdminController::storeChannel):
    // name, account_name, url — agar pesan galat tampil di field yang benar.
    // Medsos: name = username akun, account_name = platform.
    // Kantor: name = nama instansi, account_name = PIC.
    const medsos = useForm({ account_name: '', name: '', url: '' });
    const kantor = useForm({ name: '', account_name: '', url: '' });

    const channelColumns: DataTableColumn<Channel>[] = [
        {
            accessorKey: 'name',
            header: 'Nama Kanal / Akun',
            cell: ({ getValue }) => <span className="font-bold text-gray-800">{getValue<string>()}</span>,
        },
        {
            accessorKey: 'type',
            header: 'Jenis Kanal',
            cell: ({ row }) => (
                <span className="text-primary rounded bg-blue-100 px-2 py-0.5 text-xs font-medium">
                    {row.original.type_label ?? row.original.type}
                </span>
            ),
        },
        {
            id: 'info',
            header: 'Informasi / Tautan',
            accessorFn: (c) => c.url ?? c.account_name ?? '',
            cell: ({ row }) => (
                <span className="max-w-[220px] truncate text-xs text-gray-500">{row.original.url ?? row.original.account_name ?? '—'}</span>
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
            cell: ({ getValue }) => <span className="font-bold text-gray-800">{getValue<string | null>() ?? '—'}</span>,
        },
        {
            accessorKey: 'created_at',
            header: 'Waktu',
            cell: ({ getValue }) => <span className="text-xs text-gray-500">{formatDateTime(getValue<string | null>())}</span>,
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
        medsos.transform((d) => ({ ...d, type: 'sosmed' }));
        medsos.post('/admin/kanal', { preserveScroll: true, onSuccess: () => medsos.reset() });
    };

    const submitKantor = (e: FormEvent) => {
        e.preventDefault();
        kantor.transform((d) => ({ ...d, type: 'kantor', url: d.url || null }));
        kantor.post('/admin/kanal', { preserveScroll: true, onSuccess: () => kantor.reset() });
    };

    return (
        <AdminLayout title="Manajemen Kanal Pengaduan" subtitle="Kanal medsos, kantor, dan integrasi nasional.">
            {/* A-05: penambahan kanal hanya untuk Super Admin. */}
            {!is_super_admin && (
                <p className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                    Penambahan kanal dan sinkronisasi integrasi nasional hanya dapat dilakukan Super Admin.
                </p>
            )}
            {is_super_admin && (
                <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card className="border-gray-200">
                        <CardHeader className="border-b border-gray-100 pb-3">
                            <CardTitle className="flex items-center gap-2 text-base text-gray-800">
                                <Hash className="text-brand-light h-5 w-5" /> Tambah Media Sosial
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <form onSubmit={submitMedsos} className="space-y-4">
                                <Field label="Platform" required error={medsos.errors.account_name}>
                                    <Select value={medsos.data.account_name} onValueChange={(v) => medsos.setData('account_name', v)}>
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
                                        value={medsos.data.name}
                                        onChange={(e) => medsos.setData('name', e.target.value)}
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

                    <Card className="border-gray-200">
                        <CardHeader className="border-b border-gray-100 pb-3">
                            <CardTitle className="flex items-center gap-2 text-base text-gray-800">
                                <Building2 className="text-brand-light h-5 w-5" /> Tambah Kantor Pengaduan
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <form onSubmit={submitKantor} className="space-y-4">
                                <Field label="Nama Instansi / Kantor" required error={kantor.errors.name}>
                                    <Input
                                        value={kantor.data.name}
                                        onChange={(e) => kantor.setData('name', e.target.value)}
                                        placeholder="Cth: Dinas Transmigrasi Prov. Papua"
                                    />
                                </Field>
                                <Field label="Nama Admin (PIC)" required error={kantor.errors.account_name}>
                                    <Input
                                        value={kantor.data.account_name}
                                        onChange={(e) => kantor.setData('account_name', e.target.value)}
                                        placeholder="Nama Penanggung Jawab"
                                    />
                                </Field>
                                <Field label="Tautan / URL (Opsional)" error={kantor.errors.url}>
                                    <Input
                                        value={kantor.data.url}
                                        onChange={(e) => kantor.setData('url', e.target.value)}
                                        placeholder="https://..."
                                    />
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
            )}

            <DataTable<Channel>
                columns={channelColumns}
                data={channels}
                toolbarTitle="Daftar Kanal Terdaftar"
                searchPlaceholder="Cari nama kanal / akun..."
                itemLabel="kanal"
                emptyMessage="Belum ada kanal."
            />

            {/* Integrasi nasional */}
            <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-gray-800">
                <RotateCw className="text-brand-light h-5 w-5" /> Integrasi Kanal Nasional
            </h3>
            <p className="mb-4 max-w-2xl text-xs text-gray-500">
                Sinkronisasi data pengaduan dari sistem nasional (Perpres No. 76 Tahun 2013). Adapter masih berupa <strong>stub</strong> (PRD D7).
                Hanya Super Admin yang dapat memicu sinkronisasi.
            </p>

            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                {integrations.map((integ) => {
                    const lastLog = logs.find((l) => (l.channel ?? '').toLowerCase().includes(integ.key));
                    return (
                        <Card key={integ.key} className="border-gray-200">
                            <CardContent className="p-6">
                                <div className="mb-4 flex items-start justify-between border-b border-gray-100 pb-3">
                                    <h4 className="flex items-center gap-2 font-bold text-gray-800">
                                        <ShieldCheck className="text-brand-light h-4 w-4" /> {integ.label}
                                    </h4>
                                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-600">
                                        Terhubung (stub)
                                    </span>
                                </div>
                                <p className="mb-4 text-[11px] text-gray-400">
                                    Terakhir sinkron:{' '}
                                    <span className="font-semibold text-gray-600">
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
            <Label className="text-xs font-bold text-gray-600">
                {label} {required && <span className="text-red-500">*</span>}
            </Label>
            {children}
            {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
        </div>
    );
}
