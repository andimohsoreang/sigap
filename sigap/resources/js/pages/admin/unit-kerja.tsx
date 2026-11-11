import { router, useForm } from '@inertiajs/react';
import { Building2, CornerDownRight, Network, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { type FormEvent, type ReactNode, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminLayout, { AdminStat, Pill } from '@/layouts/admin-layout';
import { cn } from '@/lib/utils';

interface Unit {
    id: number;
    code: string;
    name: string;
    short_name: string | null;
    parent_id: number | null;
    level: string;
    email: string | null;
    is_active: boolean;
    sort: number;
    depth: number;
    petugas: number;
    anak: number;
    /** Alasan unit tidak boleh dihapus; null bila belum dirujuk apa pun. */
    blokir_hapus: string | null;
}

interface Props {
    units: Unit[];
    levels: { value: string; label: string }[];
}

const NO_PARENT = 'none';

const EMPTY = {
    code: '',
    name: '',
    short_name: '',
    parent_id: NO_PARENT,
    level: 'eselon_2',
    email: '',
    is_active: true,
    sort: 0,
};

/** Level anak yang lazim untuk induk tertentu, agar isian awal tidak perlu diubah. */
const CHILD_LEVEL: Record<string, string> = { eselon_1: 'eselon_2' };

export default function UnitKerja({ units, levels }: Props) {
    const [editing, setEditing] = useState<Unit | null>(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const form = useForm(EMPTY);

    const levelLabel = (value: string) => levels.find((l) => l.value === value)?.label ?? value;
    const active = units.filter((u) => u.is_active);
    const stats = {
        eselon1: active.filter((u) => u.level === 'eselon_1').length,
        total: active.length,
        petugas: units.reduce((sum, u) => sum + u.petugas, 0),
        kosong: active.filter((u) => u.petugas === 0).length,
    };

    // Kelompok per unit akar (Eselon I) dalam urutan pohon dari server.
    const groups = useMemo(() => {
        const q = query.trim().toLowerCase();
        const matches = (u: Unit) => !q || [u.name, u.short_name ?? '', u.code].some((v) => v.toLowerCase().includes(q));
        const result: { root: Unit; rows: Unit[] }[] = [];
        for (const unit of units) {
            if (unit.depth === 0) result.push({ root: unit, rows: [] });
            else result[result.length - 1]?.rows.push(unit);
        }
        return result
            .map((g) => ({ ...g, rows: g.rows.filter((u) => (showInactive || u.is_active) && matches(u)) }))
            .filter((g) => (showInactive || g.root.is_active) && (matches(g.root) || g.rows.length > 0));
    }, [units, query, showInactive]);

    // Unit yang tidak boleh menjadi induk saat mengubah: unit itu sendiri dan turunannya.
    const blockedParents = useMemo(() => {
        if (!editing) return new Set<number>();
        const blocked = new Set<number>([editing.id]);
        for (const u of units) if (u.parent_id !== null && blocked.has(u.parent_id)) blocked.add(u.id);
        return blocked;
    }, [editing, units]);

    const openNew = (parent?: Unit) => {
        setEditing(null);
        form.clearErrors();
        form.setData({
            ...EMPTY,
            parent_id: parent ? String(parent.id) : NO_PARENT,
            level: parent ? (CHILD_LEVEL[parent.level] ?? 'lainnya') : 'eselon_1',
            code: parent ? `${parent.code}-` : '',
            sort: parent ? parent.anak + 1 : 0,
        });
        setOpen(true);
    };

    const openEdit = (u: Unit) => {
        setEditing(u);
        form.clearErrors();
        form.setData({
            code: u.code,
            name: u.name,
            short_name: u.short_name ?? '',
            parent_id: u.parent_id ? String(u.parent_id) : NO_PARENT,
            level: u.level,
            email: u.email ?? '',
            is_active: u.is_active,
            sort: u.sort,
        });
        setOpen(true);
    };

    const close = () => {
        setOpen(false);
        setEditing(null);
        form.reset();
        form.clearErrors();
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((d) => ({ ...d, parent_id: d.parent_id === NO_PARENT ? null : Number(d.parent_id) }));
        const options = { preserveScroll: true, onSuccess: close };
        if (editing) form.put(`/admin/unit-kerja/${editing.id}`, options);
        else form.post('/admin/unit-kerja', options);
    };

    return (
        <AdminLayout
            title="Unit Kerja"
            subtitle="Struktur unit Kementerian Transmigrasi. Pengaduan nanti didisposisikan ke unit ini, dan petugas unit hanya melihat tiket unitnya."
            actions={
                <Button className="h-10" onClick={() => openNew()}>
                    <Plus className="h-4 w-4" aria-hidden="true" /> Unit baru
                </Button>
            }
        >
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <AdminStat label="Unit Eselon I" value={stats.eselon1} icon={Building2} />
                <AdminStat label="Unit aktif" value={stats.total} tone="indigo" icon={Network} />
                <AdminStat label="Petugas terhubung" value={stats.petugas} tone="green" icon={Users} />
                <AdminStat label="Unit tanpa petugas" value={stats.kosong} tone={stats.kosong > 0 ? 'orange' : 'brand'} icon={Users} />
            </div>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-sm">
                    <Search
                        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--adm-text-3)]"
                        aria-hidden="true"
                    />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Cari nama, singkatan, atau kode…"
                        aria-label="Cari unit kerja"
                        className="h-10 pl-9"
                    />
                </div>
                <label className="flex items-center gap-2 text-sm text-[var(--adm-text-2)]">
                    <Checkbox checked={showInactive} onCheckedChange={(v) => setShowInactive(v === true)} />
                    Tampilkan unit nonaktif
                </label>
            </div>

            {groups.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--adm-border)] px-6 py-10 text-center text-sm text-[var(--adm-text-2)]">
                    {units.length === 0 ? 'Belum ada unit kerja. Tambahkan unit Eselon I terlebih dahulu.' : 'Tidak ada unit yang cocok.'}
                </p>
            ) : (
                <div className="space-y-4">
                    {groups.map(({ root, rows }) => (
                        <section key={root.id} className="overflow-hidden rounded-xl border border-[var(--adm-border)] bg-[var(--acd-surface,#fff)]">
                            <UnitRow unit={root} levelLabel={levelLabel} onEdit={openEdit} onAddChild={openNew} isRoot />
                            {rows.length > 0 && (
                                <ul className="divide-y divide-[var(--adm-border)] border-t border-[var(--adm-border)]">
                                    {rows.map((u) => (
                                        <li key={u.id}>
                                            <UnitRow unit={u} levelLabel={levelLabel} onEdit={openEdit} onAddChild={openNew} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    ))}
                </div>
            )}

            <Dialog open={open} onOpenChange={(v) => !v && close()}>
                <DialogContent className="flex max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] flex-col gap-0 overflow-hidden rounded-lg border-[var(--adm-border)] bg-[var(--acd-surface,#fff)] p-0 sm:max-w-xl">
                    <DialogHeader className="border-b border-[var(--adm-border)] px-6 py-4 pr-12 text-left">
                        <DialogTitle className="text-[17px] text-[var(--adm-text)]">
                            {editing ? `Ubah ${editing.short_name ?? editing.name}` : 'Unit baru'}
                        </DialogTitle>
                        <DialogDescription className="text-[13px] text-[var(--adm-text-2)]">
                            Unit yang sudah punya sub-unit, petugas, atau tiket tidak bisa dihapus. Nonaktifkan saja agar riwayat tiket tetap merujuk
                            unitnya.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
                        <div className="grid flex-1 grid-cols-1 content-start gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
                            <Field id="unit-name" label="Nama resmi" required error={form.errors.name} className="sm:col-span-2">
                                <Input
                                    id="unit-name"
                                    value={form.data.name}
                                    onChange={(e) => form.setData('name', e.target.value)}
                                    placeholder="Biro Hukum"
                                    autoFocus
                                />
                            </Field>
                            <Field id="unit-short" label="Singkatan" error={form.errors.short_name} help="Untuk tampilan ringkas, mis. Pusdatin">
                                <Input id="unit-short" value={form.data.short_name} onChange={(e) => form.setData('short_name', e.target.value)} />
                            </Field>
                            <Field id="unit-code" label="Kode" required error={form.errors.code} help="Huruf besar, angka, tanda hubung">
                                <Input
                                    id="unit-code"
                                    value={form.data.code}
                                    onChange={(e) => form.setData('code', e.target.value.toUpperCase().replace(/\s+/g, '-'))}
                                    placeholder="SETJEN-HUKUM"
                                    autoCapitalize="characters"
                                    spellCheck={false}
                                />
                            </Field>
                            <Field id="unit-parent" label="Induk" error={form.errors.parent_id} className="sm:col-span-2">
                                <Select value={form.data.parent_id} onValueChange={(v) => form.setData('parent_id', v)}>
                                    <SelectTrigger id="unit-parent">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NO_PARENT}>Tanpa induk (unit teratas)</SelectItem>
                                        {units
                                            .filter((u) => !blockedParents.has(u.id) && (u.is_active || String(u.id) === form.data.parent_id))
                                            .map((u) => (
                                                <SelectItem key={u.id} value={String(u.id)}>
                                                    {'  '.repeat(u.depth)}
                                                    {u.short_name ?? u.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field id="unit-level" label="Tingkat" required error={form.errors.level}>
                                <Select value={form.data.level} onValueChange={(v) => form.setData('level', v)}>
                                    <SelectTrigger id="unit-level">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {levels.map((l) => (
                                            <SelectItem key={l.value} value={l.value}>
                                                {l.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field id="unit-sort" label="Urutan" error={form.errors.sort} help="Angka kecil tampil lebih dulu">
                                <Input
                                    id="unit-sort"
                                    type="number"
                                    min={0}
                                    max={999}
                                    value={form.data.sort}
                                    onChange={(e) => form.setData('sort', Number(e.target.value))}
                                />
                            </Field>
                            <Field
                                id="unit-email"
                                label="Email unit"
                                error={form.errors.email}
                                help="Opsional. Notifikasi tetap dikirim ke email masing-masing petugas."
                                className="sm:col-span-2"
                            >
                                <Input
                                    id="unit-email"
                                    type="email"
                                    value={form.data.email}
                                    onChange={(e) => form.setData('email', e.target.value)}
                                    placeholder="biro.hukum@transmigrasi.go.id"
                                />
                            </Field>
                            <label className="flex items-start gap-3 rounded-lg border border-[var(--adm-border)] p-3 text-sm sm:col-span-2">
                                <Checkbox
                                    checked={form.data.is_active}
                                    onCheckedChange={(v) => form.setData('is_active', v === true)}
                                    className="mt-0.5"
                                />
                                <span>
                                    <span className="block font-semibold text-[var(--adm-text)]">Aktif</span>
                                    <span className="block text-xs text-[var(--adm-text-2)]">
                                        Unit nonaktif tidak bisa dipilih untuk petugas atau disposisi baru.
                                    </span>
                                </span>
                            </label>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-[var(--adm-border)] px-6 py-4">
                            <Button type="button" variant="outline" onClick={close}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={form.processing}>
                                {editing ? 'Simpan perubahan' : 'Tambah unit'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}

function UnitRow({
    unit,
    levelLabel,
    onEdit,
    onAddChild,
    isRoot = false,
}: {
    unit: Unit;
    levelLabel: (value: string) => string;
    onEdit: (u: Unit) => void;
    onAddChild: (u: Unit) => void;
    isRoot?: boolean;
}) {
    const [confirming, setConfirming] = useState(false);

    return (
        <div
            className={cn(
                'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5',
                isRoot && 'bg-[var(--adm-primary-soft)]',
                !unit.is_active && 'opacity-60',
            )}
            style={isRoot ? undefined : { paddingLeft: `${1 + unit.depth * 1.25}rem` }}
        >
            <div className="flex min-w-0 flex-1 basis-full items-start gap-2 sm:basis-0">
                {!isRoot && <CornerDownRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--adm-text-3)]" aria-hidden="true" />}
                <div className="min-w-0">
                    <button
                        type="button"
                        onClick={() => onEdit(unit)}
                        className={cn(
                            'text-left text-[var(--adm-text)] hover:text-[var(--acd-link,var(--adm-primary))] hover:underline',
                            isRoot ? 'text-[15px] font-semibold' : 'text-sm font-medium',
                        )}
                    >
                        {unit.name}
                    </button>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--adm-text-3)]">
                        <code>{unit.code}</code>
                        {unit.short_name && <span>· {unit.short_name}</span>}
                        <span>· {levelLabel(unit.level)}</span>
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {unit.is_active ? (
                    <span className="text-xs whitespace-nowrap text-[var(--adm-text-2)] tabular-nums">
                        {unit.petugas > 0 ? `${unit.petugas} petugas` : 'Belum ada petugas'}
                    </span>
                ) : (
                    <Pill tone="neutral">Nonaktif</Pill>
                )}
                {unit.is_active && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs"
                        onClick={() => onAddChild(unit)}
                        aria-label={`Tambah sub-unit di bawah ${unit.name}`}
                    >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Sub-unit
                    </Button>
                )}
                <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => onEdit(unit)}
                    aria-label={`Ubah ${unit.name}`}
                    title="Ubah"
                >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
                {confirming ? (
                    <span className="flex items-center gap-2 text-xs" role={unit.blokir_hapus ? 'alert' : undefined}>
                        {unit.blokir_hapus ? (
                            <span className="text-[var(--adm-text-2)]">Tidak bisa dihapus: {unit.blokir_hapus}.</span>
                        ) : (
                            <button
                                type="button"
                                className="font-bold text-[var(--adm-danger)] hover:underline"
                                onClick={() => router.delete(`/admin/unit-kerja/${unit.id}`, { preserveScroll: true })}
                            >
                                Yakin hapus
                            </button>
                        )}
                        <button type="button" className="text-[var(--adm-text-2)] hover:underline" onClick={() => setConfirming(false)}>
                            {unit.blokir_hapus ? 'Tutup' : 'Batal'}
                        </button>
                    </span>
                ) : (
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 text-[var(--adm-danger)]"
                        onClick={() => setConfirming(true)}
                        aria-label={`Hapus ${unit.name}`}
                        title="Hapus"
                    >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                )}
            </div>
        </div>
    );
}

function Field({
    id,
    label,
    required,
    error,
    help,
    className,
    children,
}: {
    id: string;
    label: string;
    required?: boolean;
    error?: string;
    help?: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={cn('space-y-1.5', className)}>
            <Label htmlFor={id} className="text-[13px] font-semibold text-[var(--adm-text)]">
                {label} {required && <span className="text-[var(--adm-danger)]">*</span>}
            </Label>
            {children}
            {help && !error && <p className="text-xs text-[var(--adm-text-3)]">{help}</p>}
            {error && <p className="text-xs font-semibold text-[var(--adm-danger)]">{error}</p>}
        </div>
    );
}
