import { DataTable, type DataTableColumn } from '@/components/sigap/data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminLayout from '@/layouts/admin-layout';
import { useForm } from '@inertiajs/react';
import { UserPlus } from 'lucide-react';
import { type FormEvent } from 'react';

interface Admin {
    id: number;
    nama: string;
    inisial: string;
    nip: string | null;
    wilayah: string;
    role: string | null;
    role_value: string | null;
    status: string;
}

interface Props {
    admins: Admin[];
    regions: { id: number; name: string }[];
    roles: { value: string; label: string }[];
}

export default function Admins({ admins, regions, roles }: Props) {
    const { data, setData, post, processing, errors, reset, transform } = useForm({
        name: '',
        nip: '',
        role: '',
        region_id: '',
        password: '',
    });

    // A-05: admin kawasan WAJIB memiliki kawasan tugas; super admin = Pusat.
    const isKawasan = data.role === 'admin_kawasan';
    const regionMissing = isKawasan && (data.region_id === '' || data.region_id === 'pusat');

    const submit = (e: FormEvent) => {
        e.preventDefault();
        transform((d) => ({
            ...d,
            region_id: d.region_id === '' || d.region_id === 'pusat' ? null : Number(d.region_id),
        }));
        post('/admin/petugas', { preserveScroll: true, onSuccess: () => reset() });
    };

    const columns: DataTableColumn<Admin>[] = [
        {
            accessorKey: 'nama',
            header: 'Nama Admin',
            cell: ({ row }) => (
                <span className="flex items-center gap-3">
                    <span className="bg-brand-light/20 text-brand-light flex h-8 w-8 items-center justify-center rounded-full font-bold">
                        {row.original.inisial}
                    </span>
                    <span className="font-bold">{row.original.nama}</span>
                </span>
            ),
        },
        {
            accessorKey: 'nip',
            header: 'NIP / ID',
            cell: ({ getValue }) => getValue<string | null>() ?? '—',
        },
        {
            accessorKey: 'wilayah',
            header: 'Wilayah Tugas',
        },
        {
            accessorKey: 'role_value',
            header: 'Peran',
            cell: ({ getValue }) => (
                <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700">
                    {getValue<string | null>() === 'super_admin' ? 'Super Admin' : 'Admin Biasa'}
                </span>
            ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            meta: { className: 'text-center' },
            cell: ({ getValue }) => (
                <span className={getValue<string>() === 'Aktif' ? 'text-xs font-bold text-green-500' : 'text-xs font-bold text-gray-400'}>
                    ● {getValue<string>()}
                </span>
            ),
        },
    ];

    return (
        <AdminLayout title="Daftar Admin SIGAP" subtitle="Kelola akun petugas dan admin kawasan.">
            <Card className="mb-6 border-gray-200">
                <CardHeader className="border-b border-gray-100 pb-3">
                    <CardTitle className="flex items-center gap-2 text-base text-gray-800">
                        <UserPlus className="text-brand-light h-5 w-5" /> Formulir Tambah Admin Baru
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field label="Nama Lengkap Admin" required error={errors.name}>
                            <Input value={data.name} onChange={(e) => setData('name', e.target.value)} placeholder="Nama Lengkap" />
                        </Field>
                        <Field label="NIP / ID Pegawai" required error={errors.nip}>
                            <Input value={data.nip} onChange={(e) => setData('nip', e.target.value)} placeholder="NIP Pegawai" />
                        </Field>
                        <Field
                            label="Wilayah Tugas (Kawasan)"
                            required={isKawasan}
                            error={errors.region_id}
                            hint={regionMissing ? 'Admin kawasan wajib memilih kawasan tugas.' : undefined}
                        >
                            <Select value={data.region_id} onValueChange={(v) => setData('region_id', v)}>
                                <SelectTrigger aria-label="Wilayah Tugas (Kawasan)" aria-invalid={Boolean(errors.region_id) || regionMissing}>
                                    <SelectValue placeholder="Pilih Kawasan" />
                                </SelectTrigger>
                                <SelectContent>
                                    {regions.map((r) => (
                                        <SelectItem key={r.id} value={String(r.id)}>
                                            {r.name}
                                        </SelectItem>
                                    ))}
                                    {!isKawasan && <SelectItem value="pusat">Pusat (Kementerian)</SelectItem>}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Peran (Role)" required error={errors.role}>
                            <Select
                                value={data.role}
                                onValueChange={(v) => {
                                    setData((prev) => ({
                                        ...prev,
                                        role: v,
                                        region_id: v === 'admin_kawasan' && prev.region_id === 'pusat' ? '' : prev.region_id,
                                    }));
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Peran" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map((r) => (
                                        <SelectItem key={r.value} value={r.value}>
                                            {r.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Kata Sandi Awal" required error={errors.password} hint="Min. 12 karakter, huruf besar, huruf kecil, angka.">
                            <Input
                                type="password"
                                autoComplete="new-password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                placeholder="Min. 12 karakter"
                            />
                        </Field>
                        <div className="flex items-end justify-end md:col-span-2">
                            <Button type="submit" disabled={processing} className="w-full md:w-auto">
                                Simpan Admin
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <DataTable<Admin>
                columns={columns}
                data={admins}
                toolbarTitle="Daftar Petugas"
                searchPlaceholder="Cari nama / NIP petugas..."
                itemLabel="petugas"
                emptyMessage="Belum ada petugas."
                filters={[
                    {
                        columnId: 'role_value',
                        placeholder: 'Semua Peran',
                        options: roles.map((r) => ({ value: r.value, label: r.label })),
                    },
                    {
                        columnId: 'status',
                        placeholder: 'Semua Status',
                        options: [
                            { value: 'Aktif', label: 'Aktif' },
                            { value: 'Nonaktif', label: 'Nonaktif' },
                        ],
                    },
                ]}
            />
        </AdminLayout>
    );
}

function Field({
    label,
    required,
    error,
    hint,
    children,
}: {
    label: string;
    required?: boolean;
    error?: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">
                {label} {required && <span className="text-red-500">*</span>}
            </Label>
            {children}
            {hint && !error && <p className="text-[11px] text-gray-400">{hint}</p>}
            {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
        </div>
    );
}
