import { router, useForm } from '@inertiajs/react';
import { CircleCheckBig, ExternalLink, Globe, Info, Pencil, Plus, RefreshCw, Send, Unplug } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/sigap/data-table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import AdminLayout, { AdminStat, Pill } from '@/layouts/admin-layout';
import { cn } from '@/lib/utils';

type Audience = 'publik' | 'internal';

interface Portal {
    id: number;
    code: string;
    name: string;
    url: string;
    action_url: string | null;
    action_label: string | null;
    audience: Audience;
    purpose: string;
    description: string | null;
    keywords: string | null;
    steps: string | null;
    prepare: string | null;
    proof_label: string | null;
    track_completion: boolean;
    managed_by: string | null;
    contact: string | null;
    is_active: boolean;
    sort: number;
    is_reachable: boolean;
    last_status: number | null;
    last_checked_at: string | null;
    rujukan_30: number;
    berhasil_30: number;
}

interface Props {
    portals: Portal[];
    can_edit: boolean;
}

const AUDIENCE_LABEL: Record<Audience, string> = { publik: 'Publik', internal: 'Khusus pegawai' };

const EMPTY = {
    code: '',
    name: '',
    url: '',
    action_url: '',
    action_label: '',
    audience: 'publik' as Audience,
    purpose: '',
    description: '',
    keywords: '',
    steps: '',
    prepare: '',
    proof_label: '',
    track_completion: false,
    managed_by: '',
    contact: '',
    is_active: true,
    sort: 0,
};

export default function PortalPage({ portals, can_edit: canEdit }: Props) {
    const [editing, setEditing] = useState<Portal | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [checking, setChecking] = useState<number | null>(null);
    const form = useForm(EMPTY);

    const active = portals.filter((p) => p.is_active);
    const stats = {
        publik: active.filter((p) => p.audience === 'publik').length,
        dilacak: active.filter((p) => p.audience === 'publik' && p.track_completion).length,
        putus: active.filter((p) => !p.is_reachable).length,
        rujukan: portals.reduce((sum, p) => sum + p.rujukan_30, 0),
    };

    const openNew = () => {
        setEditing(null);
        form.clearErrors();
        form.setData({ ...EMPTY });
        setFormOpen(true);
    };

    const openEdit = (p: Portal) => {
        setEditing(p);
        form.clearErrors();
        form.setData({
            code: p.code,
            name: p.name,
            url: p.url,
            action_url: p.action_url ?? '',
            action_label: p.action_label ?? '',
            audience: p.audience,
            purpose: p.purpose,
            description: p.description ?? '',
            keywords: p.keywords ?? '',
            steps: p.steps ?? '',
            prepare: p.prepare ?? '',
            proof_label: p.proof_label ?? '',
            track_completion: p.track_completion,
            managed_by: p.managed_by ?? '',
            contact: p.contact ?? '',
            is_active: p.is_active,
            sort: p.sort,
        });
        setFormOpen(true);
    };

    const close = () => {
        setFormOpen(false);
        setEditing(null);
        form.reset();
        form.clearErrors();
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: close };
        if (editing) form.put(`/admin/portal/${editing.id}`, options);
        else form.post('/admin/portal', options);
    };

    const check = (p: Portal) => {
        setChecking(p.id);
        router.post(`/admin/portal/${p.id}/cek`, {}, { preserveScroll: true, onFinish: () => setChecking(null) });
    };

    const setAudience = (value: Audience) => {
        form.setData((d) => ({ ...d, audience: value, track_completion: value === 'internal' ? false : d.track_completion }));
    };

    const isInternal = form.data.audience === 'internal';

    const columns: DataTableColumn<Portal>[] = [
        {
            id: 'name',
            accessorFn: (p) => `${p.name} ${p.code} ${p.purpose}`,
            header: 'Portal',
            meta: { label: 'Portal', mobile: 'title', className: 'w-[40%] max-w-0 whitespace-normal' },
            cell: ({ row }) => {
                const p = row.original;
                return (
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                            {canEdit ? (
                                <button
                                    type="button"
                                    onClick={() => openEdit(p)}
                                    className="text-left font-semibold text-[var(--adm-text)] hover:text-[var(--acd-link,var(--adm-primary))] hover:underline"
                                >
                                    {p.name}
                                </button>
                            ) : (
                                <span className="font-semibold text-[var(--adm-text)]">{p.name}</span>
                            )}
                            <code className="text-xs text-[var(--adm-text-3)]">{p.code}</code>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-[var(--adm-text-2)]" title={p.purpose}>
                            {p.purpose}
                        </p>
                        <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 inline-flex max-w-full items-center gap-1 text-xs text-[var(--acd-link,var(--adm-primary))] hover:underline"
                        >
                            <span className="truncate">{p.url.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="sr-only">(buka di tab baru)</span>
                        </a>
                    </div>
                );
            },
        },
        {
            accessorKey: 'audience',
            header: 'Untuk',
            meta: { label: 'Untuk' },
            cell: ({ row }) => (
                <div className="flex flex-col items-start gap-1">
                    <Pill tone={row.original.audience === 'publik' ? 'primary' : 'neutral'}>{AUDIENCE_LABEL[row.original.audience]}</Pill>
                    {row.original.track_completion && row.original.audience === 'publik' && (
                        <span className="text-xs text-[var(--adm-text-2)]">Dilacak sampai berhasil</span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: 'is_active',
            header: 'Status',
            meta: { label: 'Status' },
            cell: ({ row }) => <Pill tone={row.original.is_active ? 'success' : 'neutral'}>{row.original.is_active ? 'Aktif' : 'Nonaktif'}</Pill>,
        },
        {
            accessorKey: 'is_reachable',
            header: 'Tautan',
            meta: { label: 'Tautan' },
            cell: ({ row }) => <Reachability portal={row.original} />,
        },
        {
            accessorKey: 'rujukan_30',
            header: '30 hari',
            meta: { label: 'Rujukan 30 hari' },
            cell: ({ row }) => (
                <span className="text-sm whitespace-nowrap text-[var(--adm-text)] tabular-nums">
                    {row.original.rujukan_30} rujukan
                    {row.original.track_completion && (
                        <span className="block text-xs text-[var(--adm-text-2)]">{row.original.berhasil_30} berhasil</span>
                    )}
                </span>
            ),
        },
        {
            id: 'aksi',
            header: '',
            meta: { label: 'Aksi', disableToggle: true, disableSorting: true, mobile: 'end' },
            cell: ({ row }) => (
                <div className="flex items-center justify-end gap-1.5">
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs"
                        disabled={checking === row.original.id}
                        onClick={() => check(row.original)}
                        aria-label={`Cek tautan ${row.original.name}`}
                    >
                        <RefreshCw className={cn('h-3.5 w-3.5', checking === row.original.id && 'animate-spin')} aria-hidden="true" />
                        Cek
                    </Button>
                    {canEdit && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => openEdit(row.original)}
                            title={`Ubah ${row.original.name}`}
                            aria-label={`Ubah ${row.original.name}`}
                        >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <AdminLayout
            title="Katalog Portal"
            subtitle="Portal Kementerian Transmigrasi yang dapat dirujuk asisten AI dan petugas. Portal internal tidak pernah ditawarkan ke warga."
            actions={
                canEdit ? (
                    <Button className="h-10" onClick={openNew}>
                        <Plus className="h-4 w-4" aria-hidden="true" /> Portal baru
                    </Button>
                ) : undefined
            }
        >
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <AdminStat label="Portal publik aktif" value={stats.publik} icon={Globe} />
                <AdminStat label="Dilacak sampai berhasil" value={stats.dilacak} tone="green" icon={CircleCheckBig} />
                <AdminStat label="Tidak dapat diakses" value={stats.putus} tone={stats.putus > 0 ? 'red' : 'brand'} icon={Unplug} />
                <AdminStat label="Rujukan 30 hari" value={stats.rujukan} tone="indigo" icon={Send} />
            </div>

            {!canEdit && (
                <p className="mb-6 flex items-start gap-2 rounded-lg border border-[var(--adm-border)] bg-[var(--adm-info-soft)] px-4 py-3 text-sm text-[var(--adm-text)]">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--adm-info)]" aria-hidden="true" />
                    Katalog ini hanya dapat diubah oleh Super Admin. Anda tetap dapat mengecek tautan portal.
                </p>
            )}

            <Sheet open={canEdit && formOpen} onOpenChange={(v) => !v && close()}>
                <SheetContent
                    side="right"
                    className="flex w-full flex-col gap-0 border-[var(--adm-border)] bg-[var(--acd-surface,#fff)] p-0 sm:max-w-2xl"
                >
                    <SheetHeader className="border-b border-[var(--adm-border)] px-6 py-4 pr-12 text-left">
                        <SheetTitle className="text-[17px] text-[var(--adm-text)]">{editing ? `Ubah ${editing.name}` : 'Portal baru'}</SheetTitle>
                        <SheetDescription className="text-[13px] text-[var(--adm-text-2)]">
                            Kolom bertanda * wajib diisi. Portal internal tidak pernah ditawarkan ke warga.
                        </SheetDescription>
                    </SheetHeader>
                    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
                        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
                            <Section title="Identitas">
                                <Field id="portal-name" label="Nama" required error={form.errors.name} className="md:col-span-2">
                                    <Input
                                        id="portal-name"
                                        value={form.data.name}
                                        onChange={(e) => form.setData('name', e.target.value)}
                                        placeholder="Trans Tuntas"
                                    />
                                </Field>
                                <Field id="portal-code" label="Kode" required error={form.errors.code} help="Huruf kecil, angka, dan tanda hubung">
                                    <Input
                                        id="portal-code"
                                        value={form.data.code}
                                        onChange={(e) => form.setData('code', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                        placeholder="trans-tuntas"
                                        autoCapitalize="none"
                                        spellCheck={false}
                                    />
                                </Field>
                                <Field id="portal-audience" label="Untuk" required error={form.errors.audience}>
                                    <Select value={form.data.audience} onValueChange={(v) => setAudience(v as Audience)}>
                                        <SelectTrigger id="portal-audience">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="publik">Publik</SelectItem>
                                            <SelectItem value="internal">Internal (khusus pegawai)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field id="portal-sort" label="Urutan" error={form.errors.sort} help="Angka kecil tampil lebih dulu">
                                    <Input
                                        id="portal-sort"
                                        type="number"
                                        min={0}
                                        max={999}
                                        value={form.data.sort}
                                        onChange={(e) => form.setData('sort', Number(e.target.value) || 0)}
                                    />
                                </Field>
                                <div className="flex items-end">
                                    <CheckRow
                                        id="portal-active"
                                        label="Aktif"
                                        hint="Portal nonaktif tidak dirujuk AI"
                                        checked={form.data.is_active}
                                        onChange={(v) => form.setData('is_active', v)}
                                    />
                                </div>
                            </Section>

                            <Section title="Tautan">
                                <Field id="portal-url" label="Alamat beranda" required error={form.errors.url} className="md:col-span-3">
                                    <Input
                                        id="portal-url"
                                        type="url"
                                        value={form.data.url}
                                        onChange={(e) => form.setData('url', e.target.value)}
                                        placeholder="https://…transmigrasi.go.id"
                                    />
                                </Field>
                                <Field
                                    id="portal-action-url"
                                    label="Halaman layanan"
                                    error={form.errors.action_url}
                                    help="Tujuan tombol utama di halaman pengantar, mis. halaman Buat Pengaduan"
                                    className="md:col-span-2"
                                >
                                    <Input
                                        id="portal-action-url"
                                        type="url"
                                        value={form.data.action_url}
                                        onChange={(e) => form.setData('action_url', e.target.value)}
                                        placeholder="https://…/pengaduan/baru"
                                    />
                                </Field>
                                <Field id="portal-action-label" label="Teks tombol" error={form.errors.action_label}>
                                    <Input
                                        id="portal-action-label"
                                        value={form.data.action_label}
                                        onChange={(e) => form.setData('action_label', e.target.value)}
                                        placeholder="Buat pengaduan"
                                    />
                                </Field>
                            </Section>

                            <Section title="Untuk AI">
                                <Field
                                    id="portal-purpose"
                                    label="Kegunaan"
                                    required
                                    error={form.errors.purpose}
                                    help="Dibaca AI untuk memilih portal"
                                    className="md:col-span-3"
                                >
                                    <Input
                                        id="portal-purpose"
                                        value={form.data.purpose}
                                        onChange={(e) => form.setData('purpose', e.target.value)}
                                        placeholder="Melaporkan dan melacak penyelesaian masalah lahan transmigrasi"
                                    />
                                </Field>
                                <Field id="portal-description" label="Keterangan" error={form.errors.description} className="md:col-span-2">
                                    <Textarea
                                        id="portal-description"
                                        rows={4}
                                        value={form.data.description}
                                        onChange={(e) => form.setData('description', e.target.value)}
                                    />
                                </Field>
                                <Field
                                    id="portal-keywords"
                                    label="Kata kunci"
                                    error={form.errors.keywords}
                                    help="Istilah warga, pisahkan dengan koma"
                                >
                                    <Textarea
                                        id="portal-keywords"
                                        rows={4}
                                        value={form.data.keywords}
                                        onChange={(e) => form.setData('keywords', e.target.value)}
                                        placeholder="sertifikat, lahan usaha, tumpang tindih"
                                    />
                                </Field>
                            </Section>

                            <Section title="Pengantar untuk warga">
                                <Field
                                    id="portal-steps"
                                    label="Langkah"
                                    error={form.errors.steps}
                                    help="Satu langkah per baris"
                                    className="md:col-span-2"
                                >
                                    <Textarea
                                        id="portal-steps"
                                        rows={5}
                                        value={form.data.steps}
                                        onChange={(e) => form.setData('steps', e.target.value)}
                                    />
                                </Field>
                                <Field id="portal-prepare" label="Yang perlu disiapkan" error={form.errors.prepare} help="Satu butir per baris">
                                    <Textarea
                                        id="portal-prepare"
                                        rows={5}
                                        value={form.data.prepare}
                                        onChange={(e) => form.setData('prepare', e.target.value)}
                                    />
                                </Field>
                                <Field id="portal-managed-by" label="Pengelola" error={form.errors.managed_by} className="md:col-span-2">
                                    <Input
                                        id="portal-managed-by"
                                        value={form.data.managed_by}
                                        onChange={(e) => form.setData('managed_by', e.target.value)}
                                        placeholder="Nama unit kerja"
                                    />
                                </Field>
                                <Field id="portal-contact" label="Kontak" error={form.errors.contact}>
                                    <Input
                                        id="portal-contact"
                                        value={form.data.contact}
                                        onChange={(e) => form.setData('contact', e.target.value)}
                                        placeholder="Email atau nomor layanan"
                                    />
                                </Field>
                            </Section>

                            <Section title="Pelacakan">
                                <div className="md:col-span-2">
                                    <CheckRow
                                        id="portal-track"
                                        label="Lacak sampai warga berhasil"
                                        hint={
                                            isInternal
                                                ? 'Tidak tersedia untuk portal internal.'
                                                : 'Rujukan ke portal ini punya petugas penanggung jawab dan baru selesai setelah warga memasukkan bukti.'
                                        }
                                        checked={form.data.track_completion && !isInternal}
                                        disabled={isInternal}
                                        onChange={(v) => form.setData('track_completion', v)}
                                    />
                                    {form.errors.track_completion && (
                                        <p className="mt-1.5 text-xs font-semibold text-[var(--adm-danger)]">{form.errors.track_completion}</p>
                                    )}
                                </div>
                                {form.data.track_completion && !isInternal && (
                                    <Field
                                        id="portal-proof-label"
                                        label="Label bukti"
                                        error={form.errors.proof_label}
                                        help="Nama bukti yang diminta dari warga"
                                    >
                                        <Input
                                            id="portal-proof-label"
                                            value={form.data.proof_label}
                                            onChange={(e) => form.setData('proof_label', e.target.value)}
                                            placeholder="Kode tracking"
                                        />
                                    </Field>
                                )}
                            </Section>
                        </div>
                        <div className="flex flex-col-reverse gap-2 border-t border-[var(--adm-border)] px-6 py-4 sm:flex-row sm:justify-end">
                            <Button type="button" variant="outline" onClick={close}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={form.processing}>
                                {editing ? 'Simpan perubahan' : 'Simpan portal'}
                            </Button>
                        </div>
                    </form>
                </SheetContent>
            </Sheet>

            <DataTable<Portal>
                columns={columns}
                data={portals}
                toolbarTitle="Portal"
                searchPlaceholder="Cari nama, kode, atau kegunaan…"
                itemLabel="portal"
                emptyMessage="Belum ada portal di katalog."
                rowClassName={(p) => (p.is_active ? undefined : 'opacity-60')}
                filters={[
                    {
                        columnId: 'audience',
                        placeholder: 'Semua pengguna',
                        options: (Object.keys(AUDIENCE_LABEL) as Audience[]).map((a) => ({ value: a, label: AUDIENCE_LABEL[a] })),
                    },
                ]}
            />
        </AdminLayout>
    );
}

function Reachability({ portal }: { portal: Portal }) {
    if (!portal.last_checked_at) {
        return <span className="text-sm text-[var(--adm-text-3)]">Belum dicek</span>;
    }
    const ok = portal.is_reachable;
    return (
        <div className="text-sm whitespace-nowrap">
            <span className={cn('inline-flex items-center gap-1.5 font-medium', ok ? 'text-[var(--adm-success)]' : 'text-[var(--adm-danger)]')}>
                <span className={cn('h-2 w-2 rounded-full', 'bg-current')} aria-hidden="true" />
                {ok ? 'Dapat diakses' : 'Tidak dapat diakses'}
            </span>
            <div className="text-xs text-[var(--adm-text-3)]" title={formatDateTime(portal.last_checked_at)}>
                {portal.last_status !== null && <span className="tabular-nums">HTTP {portal.last_status} · </span>}
                {relativeTime(portal.last_checked_at)}
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <fieldset className="space-y-3">
            <legend className="text-[13px] font-semibold tracking-[0.04em] text-[var(--adm-text-2)] uppercase">{title}</legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{children}</div>
        </fieldset>
    );
}

function CheckRow({
    id,
    label,
    hint,
    checked,
    disabled,
    onChange,
}: {
    id: string;
    label: string;
    hint?: string;
    checked: boolean;
    disabled?: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <div
            className={cn(
                'flex w-full items-start gap-3 rounded-lg border border-[var(--adm-border)] p-3',
                disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-[var(--adm-surface-2)]',
            )}
        >
            <Checkbox
                id={id}
                checked={checked}
                disabled={disabled}
                onCheckedChange={(v) => onChange(v === true)}
                aria-describedby={hint ? `${id}-hint` : undefined}
                className="mt-0.5"
            />
            <div className="min-w-0">
                <Label htmlFor={id} className={cn('text-sm font-semibold text-[var(--adm-text)]', !disabled && 'cursor-pointer')}>
                    {label}
                </Label>
                {hint && (
                    <p id={`${id}-hint`} className="mt-0.5 text-xs text-[var(--adm-text-2)]">
                        {hint}
                    </p>
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

function relativeTime(value: string): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const diff = (d.getTime() - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' });
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
        ['day', 86400],
        ['hour', 3600],
        ['minute', 60],
    ];
    for (const [unit, seconds] of units) {
        if (Math.abs(diff) >= seconds) return rtf.format(Math.round(diff / seconds), unit);
    }
    return 'baru saja';
}

function formatDateTime(value: string): string {
    const d = new Date(value);
    return Number.isNaN(d.getTime())
        ? value
        : d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
