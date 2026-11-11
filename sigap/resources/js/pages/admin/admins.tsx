import { DataTable, type DataTableColumn } from '@/components/sigap/data-table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminLayout, { Pill } from '@/layouts/admin-layout';
import { router, useForm } from '@inertiajs/react';
import { Check, Mail, Pencil, UserPlus, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';

interface Admin {
    id: number;
    nama: string;
    inisial: string;
    nip: string | null;
    email: string | null;
    wilayah: string;
    unit_id: number | null;
    unit: string | null;
    role: string | null;
    role_value: string | null;
    status: string;
}

interface UnitOption {
    id: number;
    name: string;
    depth: number;
}

interface Props {
    admins: Admin[];
    roles: { value: string; label: string }[];
    units: UnitOption[];
}

const NO_UNIT = 'none';

/** Penjelasan singkat tiap peran di formulir (sejak 31-10-2026 akses tidak dibatasi kawasan). */
const ROLE_HINT: Record<string, string> = {
    admin_kawasan: 'Menangani semua pengaduan publik, chat, dan rujukan.',
    super_admin: 'Semua akses, termasuk tiket internal, daftar admin, dan log aktivitas.',
};

export default function Admins({ admins, roles, units }: Props) {
    const [open, setOpen] = useState(false);
    const { data, setData, post, processing, errors, reset, clearErrors, transform } = useForm({
        name: '',
        nip: '',
        email: '',
        role: '',
        unit_id: NO_UNIT,
        password: '',
    });
    const roleLabel = (value: string | null) => roles.find((r) => r.value === value)?.label ?? value ?? '—';
    const active = admins.filter((a) => a.status === 'Aktif').length;
    const noEmail = admins.filter((a) => !a.email).length;

    const close = () => {
        setOpen(false);
        reset();
        clearErrors();
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        transform((d) => ({ ...d, unit_id: d.unit_id === NO_UNIT ? null : Number(d.unit_id) }));
        post('/admin/petugas', { preserveScroll: true, onSuccess: close });
    };

    const columns: DataTableColumn<Admin>[] = [
        {
            accessorKey: 'nama',
            header: 'Petugas',
            meta: { label: 'Petugas', mobile: 'title' },
            cell: ({ row }) => (
                <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--adm-primary-soft)] text-sm font-semibold text-[var(--acd-link,var(--adm-primary))]">
                        {row.original.inisial}
                    </span>
                    <span className="min-w-0">
                        <span className="block font-semibold">{row.original.nama}</span>
                        <span className="block font-mono text-xs text-[var(--adm-text-3)]">{row.original.nip ?? '—'}</span>
                    </span>
                </span>
            ),
        },
        {
            accessorKey: 'email',
            header: 'Email Notifikasi',
            enableSorting: false,
            cell: ({ row }) => <EmailCell admin={row.original} />,
        },
        {
            accessorKey: 'unit',
            header: 'Unit Kerja',
            enableSorting: false,
            cell: ({ row }) => <UnitCell admin={row.original} units={units} />,
        },
        {
            accessorKey: 'role_value',
            header: 'Peran',
            cell: ({ getValue }) => (
                <Pill tone={getValue<string | null>() === 'super_admin' ? 'primary' : 'neutral'}>{roleLabel(getValue<string | null>())}</Pill>
            ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ getValue }) => <Pill tone={getValue<string>() === 'Aktif' ? 'success' : 'neutral'}>{getValue<string>()}</Pill>,
        },
    ];

    return (
        <AdminLayout
            title="Daftar Admin"
            subtitle={`${admins.length} akun petugas · ${active} aktif${noEmail ? ` · ${noEmail} belum punya email notifikasi` : ''}.`}
            actions={
                <Button className="h-10" onClick={() => setOpen(true)}>
                    <UserPlus className="h-4 w-4" aria-hidden="true" /> Tambah admin
                </Button>
            }
        >
            <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
                <DialogContent className="max-h-[calc(100dvh-32px)] overflow-y-auto sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Tambah admin</DialogTitle>
                        <DialogDescription>Akun langsung aktif. Sampaikan kata sandi awal secara langsung, bukan lewat chat.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Nama lengkap" required error={errors.name}>
                            <Input value={data.name} onChange={(e) => setData('name', e.target.value)} autoFocus />
                        </Field>
                        <Field label="NIP / ID pegawai" required error={errors.nip}>
                            <Input value={data.nip} onChange={(e) => setData('nip', e.target.value)} />
                        </Field>
                        <div className="sm:col-span-2">
                            <Field
                                label="Email notifikasi"
                                error={errors.email}
                                hint="Untuk tiket baru, perubahan status, EWS, dan rujukan. Tanpa email, notifikasi hanya muncul di panel."
                            >
                                <Input
                                    type="email"
                                    autoComplete="off"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    placeholder="nama@transmigrasi.go.id"
                                />
                            </Field>
                        </div>
                        <Field label="Peran" required error={errors.role} hint={ROLE_HINT[data.role]}>
                            <Select value={data.role} onValueChange={(v) => setData('role', v)}>
                                <SelectTrigger aria-label="Peran">
                                    <SelectValue placeholder="Pilih peran" />
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
                        <div className="sm:col-span-2">
                            <Field label="Unit kerja" error={errors.unit_id} hint="Unit tempat petugas bertugas. Bisa diubah nanti di tabel.">
                                <UnitSelect value={data.unit_id} onChange={(v) => setData('unit_id', v)} units={units} />
                            </Field>
                        </div>
                        <Field label="Kata sandi awal" required error={errors.password} hint="Min. 12 karakter, huruf besar, huruf kecil, angka.">
                            <Input
                                type="password"
                                autoComplete="new-password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                            />
                        </Field>
                        <div className="flex justify-end gap-2 sm:col-span-2">
                            <Button type="button" variant="outline" onClick={close}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={processing}>
                                Simpan admin
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <DataTable<Admin>
                columns={columns}
                data={admins}
                searchPlaceholder="Cari nama atau NIP…"
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

function UnitSelect({
    value,
    onChange,
    units,
    label = 'Unit kerja',
}: {
    value: string;
    onChange: (v: string) => void;
    units: UnitOption[];
    label?: string;
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger aria-label={label}>
                <SelectValue placeholder="Pilih unit" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NO_UNIT}>Tanpa unit</SelectItem>
                {units.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                        {'\u00a0\u00a0'.repeat(u.depth)}
                        {u.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

/** Kolom unit kerja: pilih langsung di tabel, tersimpan saat dipilih (super admin). */
function UnitCell({ admin, units }: { admin: Admin; units: UnitOption[] }) {
    const [saving, setSaving] = useState(false);
    const save = (value: string) => {
        setSaving(true);
        router.put(
            `/admin/petugas/${admin.id}/unit`,
            { unit_id: value === NO_UNIT ? null : Number(value) },
            { preserveScroll: true, onFinish: () => setSaving(false) },
        );
    };

    return (
        <div className={saving ? 'pointer-events-none min-w-48 opacity-60' : 'min-w-48'}>
            <UnitSelect value={admin.unit_id ? String(admin.unit_id) : NO_UNIT} onChange={save} units={units} label={`Unit kerja ${admin.nama}`} />
        </div>
    );
}

/** Kolom email di tabel petugas: tampil + ubah di tempat (super admin). */
function EmailCell({ admin }: { admin: Admin }) {
    const [editing, setEditing] = useState(false);
    const form = useForm({ email: admin.email ?? '' });

    const save = (e: FormEvent) => {
        e.preventDefault();
        form.put(`/admin/petugas/${admin.id}/email`, {
            preserveScroll: true,
            onSuccess: () => setEditing(false),
        });
    };

    if (editing) {
        return (
            <form onSubmit={save} className="flex min-w-64 flex-col gap-1">
                <div className="flex items-center gap-1">
                    <Input
                        type="email"
                        autoFocus
                        aria-label={`Email ${admin.nama}`}
                        value={form.data.email}
                        onChange={(e) => form.setData('email', e.target.value)}
                        placeholder="nama@transmigrasi.go.id"
                        className="h-8 text-sm"
                    />
                    <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={form.processing} aria-label="Simpan email">
                        <Check className="h-4 w-4" />
                    </Button>
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        aria-label="Batal"
                        onClick={() => {
                            form.reset();
                            form.clearErrors();
                            setEditing(false);
                        }}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                {form.errors.email && <p className="text-xs font-semibold text-rose-500">{form.errors.email}</p>}
            </form>
        );
    }

    return (
        <span className="flex items-center gap-2">
            {admin.email ? (
                <span className="flex items-center gap-1.5 text-sm text-gray-700">
                    <Mail className="h-3.5 w-3.5 text-gray-400" />
                    {admin.email}
                </span>
            ) : (
                <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Belum ada email</span>
            )}
            <button
                type="button"
                onClick={() => setEditing(true)}
                className="hover:text-brand-light rounded p-1 text-gray-400"
                aria-label={admin.email ? `Ubah email ${admin.nama}` : `Tambah email ${admin.nama}`}
                title={admin.email ? 'Ubah email' : 'Tambah email'}
            >
                <Pencil className="h-3.5 w-3.5" />
            </button>
        </span>
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
            <Label className="text-[13px] font-semibold text-[var(--adm-text)]">
                {label} {required && <span className="text-[var(--adm-danger)]">*</span>}
            </Label>
            {children}
            {hint && !error && <p className="text-xs text-[var(--adm-text-3)]">{hint}</p>}
            {error && <p className="text-xs font-semibold text-[var(--adm-danger)]">{error}</p>}
        </div>
    );
}
