import { router, useForm } from '@inertiajs/react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/sigap/data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminLayout from '@/layouts/admin-layout';

interface Region {
    id: number;
    code: string;
    name: string;
    province: string | null;
    latitude: number | null;
    longitude: number | null;
    infrastructure_status: string | null;
    kk_count: number | null;
    is_active: boolean;
    /** A-05: admin kawasan hanya boleh mengubah kawasannya sendiri. */
    can_edit: boolean;
}

interface Props {
    regions: Region[];
    is_super_admin: boolean;
    own_region_id: number | null;
}

const INFRA = ['Memadai', 'Berkembang', 'Tertinggal'];

export default function Kawasan({ regions, is_super_admin: isSuper, own_region_id: ownRegionId }: Props) {
    const [editing, setEditing] = useState<Region | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Region | null>(null);

    const form = useForm({
        code: '',
        name: '',
        province: '',
        latitude: '',
        longitude: '',
        infrastructure_status: '',
        kk_count: '',
    });

    const startEdit = (r: Region) => {
        if (!r.can_edit) return;
        setEditing(r);
        form.setData({
            code: r.code,
            name: r.name,
            province: r.province ?? '',
            latitude: r.latitude != null ? String(r.latitude) : '',
            longitude: r.longitude != null ? String(r.longitude) : '',
            infrastructure_status: r.infrastructure_status ?? '',
            kk_count: r.kk_count != null ? String(r.kk_count) : '',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const reset = () => {
        setEditing(null);
        form.reset();
        form.clearErrors();
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (editing) {
            form.put(`/admin/kawasan/${editing.id}`, { preserveScroll: true, onSuccess: () => reset() });
        } else {
            form.post('/admin/kawasan', { preserveScroll: true, onSuccess: () => reset() });
        }
    };

    const columns: DataTableColumn<Region>[] = [
        {
            accessorKey: 'code',
            header: 'Kode / Kawasan',
            cell: ({ row }) => (
                <div>
                    <div className="text-brand-light font-bold">
                        {row.original.code}
                        {row.original.id === ownRegionId && (
                            <span className="bg-brand-soft text-primary ml-2 rounded px-1.5 py-0.5 text-xs font-medium">Kawasan Anda</span>
                        )}
                    </div>
                    <div className="text-xs text-gray-500">{row.original.name}</div>
                </div>
            ),
        },
        {
            accessorKey: 'province',
            header: 'Provinsi',
            cell: ({ getValue }) => getValue<string | null>() ?? '—',
        },
        {
            id: 'koordinat',
            header: 'Koordinat (GPS)',
            accessorFn: (r) => (r.latitude != null && r.longitude != null ? `${r.latitude}, ${r.longitude}` : ''),
            cell: ({ row }) => (
                <span className="font-mono text-xs text-gray-500">
                    {row.original.latitude != null && row.original.longitude != null ? `${row.original.latitude}, ${row.original.longitude}` : '—'}
                </span>
            ),
        },
        {
            accessorKey: 'kk_count',
            header: 'Jumlah KK',
            meta: { className: 'text-right' },
            cell: ({ getValue }) => getValue<number | null>() ?? '—',
        },
        {
            accessorKey: 'infrastructure_status',
            header: 'Infrastruktur',
            meta: { className: 'text-center' },
            cell: ({ getValue }) => <InfraBadge value={getValue<string | null>()} />,
        },
        {
            id: 'aksi',
            header: 'Aksi',
            meta: { label: 'Aksi', disableToggle: true, disableSorting: true, className: 'text-center' },
            cell: ({ row }) => (
                <div className="flex items-center justify-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0"
                        onClick={() => startEdit(row.original)}
                        disabled={!row.original.can_edit}
                        title={row.original.can_edit ? 'Edit' : 'Anda tidak berwenang mengubah kawasan ini'}
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {isSuper && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0 text-rose-500"
                            onClick={() => setConfirmDelete((prev) => (prev?.id === row.original.id ? null : row.original))}
                            title="Hapus"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                    {isSuper && confirmDelete?.id === row.original.id && (
                        <span className="flex items-center gap-2 text-xs">
                            <button
                                className="font-bold text-rose-600 hover:underline"
                                onClick={() => {
                                    router.delete(`/admin/kawasan/${row.original.id}`, { preserveScroll: true });
                                    setConfirmDelete(null);
                                }}
                            >
                                Yakin hapus
                            </button>
                            <button className="text-gray-400 hover:underline" onClick={() => setConfirmDelete(null)}>
                                Batal
                            </button>
                        </span>
                    )}
                </div>
            ),
        },
    ];

    return (
        <AdminLayout
            title="Direktori Kawasan Transmigrasi"
            subtitle={`${regions.length} kawasan terdaftar.`}
            actions={
                editing ? (
                    <Button variant="outline" size="sm" onClick={reset}>
                        <X className="h-4 w-4" /> Batal Edit
                    </Button>
                ) : undefined
            }
        >
            {!isSuper && !editing && (
                <p className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                    Penambahan dan penghapusan kawasan hanya dapat dilakukan Super Admin. Anda dapat mengubah data kawasan Anda sendiri melalui tombol
                    Edit.
                </p>
            )}
            {(isSuper || editing) && (
                <Card className="mb-6 border-gray-200">
                    <CardHeader className="border-b border-gray-100 pb-3">
                        <CardTitle className="flex items-center gap-2 text-base text-gray-800">
                            {editing ? <Pencil className="text-brand-light h-5 w-5" /> : <Plus className="text-brand-light h-5 w-5" />}
                            {editing ? `Edit Kawasan ${editing.code}` : 'Tambah Kawasan Baru'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <Field label="Kode Kawasan" required error={form.errors.code}>
                                <Input value={form.data.code} onChange={(e) => form.setData('code', e.target.value)} placeholder="KWS-001" />
                            </Field>
                            <Field label="Nama Kawasan" required error={form.errors.name}>
                                <Input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} placeholder="SP1 Merauke" />
                            </Field>
                            <Field label="Provinsi" error={form.errors.province}>
                                <Input
                                    value={form.data.province}
                                    onChange={(e) => form.setData('province', e.target.value)}
                                    placeholder="Papua Selatan"
                                />
                            </Field>
                            <Field label="Latitude" error={form.errors.latitude}>
                                <Input value={form.data.latitude} onChange={(e) => form.setData('latitude', e.target.value)} placeholder="-8.4991" />
                            </Field>
                            <Field label="Longitude" error={form.errors.longitude}>
                                <Input
                                    value={form.data.longitude}
                                    onChange={(e) => form.setData('longitude', e.target.value)}
                                    placeholder="140.4011"
                                />
                            </Field>
                            <Field label="Status Infrastruktur" error={form.errors.infrastructure_status}>
                                <Select value={form.data.infrastructure_status} onValueChange={(v) => form.setData('infrastructure_status', v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {INFRA.map((s) => (
                                            <SelectItem key={s} value={s}>
                                                {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Jumlah KK" error={form.errors.kk_count}>
                                <Input
                                    value={form.data.kk_count}
                                    onChange={(e) => form.setData('kk_count', e.target.value)}
                                    inputMode="numeric"
                                    placeholder="0"
                                />
                            </Field>
                            <div className="flex items-end md:col-span-3 md:justify-end">
                                <Button type="submit" disabled={form.processing} className="w-full md:w-auto">
                                    {editing ? 'Simpan Perubahan' : 'Tambah Kawasan'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <DataTable<Region>
                columns={columns}
                data={regions}
                toolbarTitle="Direktori Kawasan"
                searchPlaceholder="Cari kode / nama / provinsi..."
                itemLabel="kawasan"
                emptyMessage="Belum ada kawasan."
                filters={[
                    {
                        columnId: 'infrastructure_status',
                        placeholder: 'Semua Infrastruktur',
                        options: INFRA.map((s) => ({ value: s, label: s })),
                    },
                ]}
            />
        </AdminLayout>
    );
}

function InfraBadge({ value }: { value: string | null }) {
    const styles: Record<string, string> = {
        Memadai: 'bg-green-100 text-green-700',
        Berkembang: 'bg-yellow-100 text-yellow-700',
        Tertinggal: 'bg-red-100 text-red-700',
    };
    if (!value) return <span className="text-gray-400">—</span>;
    return <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles[value] ?? 'bg-gray-100 text-gray-600'}`}>{value}</span>;
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
