import { DataTable, type DataTableColumn } from '@/components/sigap/data-table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminLayout, { Pill } from '@/layouts/admin-layout';
import { formatDateTime } from '@/lib/admin-format';
import { cn } from '@/lib/utils';
import { router, useForm } from '@inertiajs/react';
import { Building2, ExternalLink, Hash, Info, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';

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

type Jenis = 'sosmed' | 'kantor';

const PLATFORMS = ['Instagram', 'Facebook', 'X / Twitter', 'TikTok'];

/** Label isian per jenis. Nama field mengikuti validasi backend (AdminController::storeChannel). */
const FORM_COPY: Record<Jenis, { name: string; namePh: string; account: string; url: string; urlPh: string }> = {
    // Medsos: name = username akun, account_name = platform.
    sosmed: { name: 'Nama akun / username', namePh: 'Cth: @KemenTransRI', account: 'Platform', url: 'Tautan akun', urlPh: 'https://instagram.com/…' },
    // Kantor: name = nama instansi, account_name = PIC.
    kantor: {
        name: 'Nama instansi / kantor',
        namePh: 'Cth: Dinas Transmigrasi Prov. Papua',
        account: 'Penanggung jawab (PIC)',
        url: 'Tautan (opsional)',
        urlPh: 'https://…',
    },
};

export default function Kanal({ channels, integrations, logs, is_super_admin }: Props) {
    const [open, setOpen] = useState(false);
    const form = useForm<{ type: Jenis; name: string; account_name: string; url: string }>({ type: 'sosmed', name: '', account_name: '', url: '' });
    const copy = FORM_COPY[form.data.type];
    const failed = logs.filter((l) => l.status !== 'berhasil').length;

    const close = () => {
        setOpen(false);
        form.reset();
        form.clearErrors();
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((d) => ({ ...d, url: d.url || null }));
        form.post('/admin/kanal', { preserveScroll: true, onSuccess: close });
    };

    const channelColumns: DataTableColumn<Channel>[] = [
        {
            accessorKey: 'name',
            header: 'Kanal',
            meta: { label: 'Kanal', mobile: 'title', className: 'w-[36%] max-w-0 whitespace-normal' },
            cell: ({ row }) => {
                const Icon = row.original.type === 'kantor' ? Building2 : row.original.type === 'sosmed' ? Hash : ShieldCheck;
                return (
                    <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--adm-primary-soft)] text-[var(--acd-link,var(--adm-primary))]">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                            <span className="block truncate font-semibold text-[var(--adm-text)]">{row.original.name}</span>
                            {row.original.account_name && (
                                <span className="block truncate text-xs text-[var(--adm-text-3)]">{row.original.account_name}</span>
                            )}
                        </span>
                    </span>
                );
            },
        },
        {
            accessorKey: 'type',
            header: 'Jenis',
            meta: { label: 'Jenis' },
            cell: ({ row }) => <Pill tone="neutral">{row.original.type_label ?? row.original.type ?? '—'}</Pill>,
        },
        {
            id: 'url',
            header: 'Tautan',
            accessorFn: (c) => c.url ?? '',
            meta: { label: 'Tautan', className: 'w-[30%] max-w-0' },
            cell: ({ row }) =>
                row.original.url ? (
                    <a
                        href={row.original.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 items-center gap-1 text-[13px] text-[var(--acd-link,var(--adm-primary))] hover:underline"
                    >
                        <span className="truncate">{row.original.url.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="sr-only">(tab baru)</span>
                    </a>
                ) : (
                    <span className="text-[var(--adm-text-3)]">—</span>
                ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            meta: { label: 'Status', mobile: 'end' },
            cell: ({ getValue }) => {
                const s = getValue<string | null>() ?? 'Aktif';
                return <Pill tone={/aktif/i.test(s) && !/non/i.test(s) ? 'success' : 'neutral'}>{s.charAt(0).toUpperCase() + s.slice(1)}</Pill>;
            },
        },
    ];

    const logColumns: DataTableColumn<Log>[] = [
        {
            accessorKey: 'channel',
            header: 'Kanal',
            meta: { label: 'Kanal', mobile: 'title' },
            cell: ({ getValue }) => <span className="font-semibold text-[var(--adm-text)]">{getValue<string | null>() ?? '—'}</span>,
        },
        {
            accessorKey: 'created_at',
            header: 'Waktu',
            meta: { label: 'Waktu' },
            cell: ({ getValue }) => <span className="text-[13px] text-[var(--adm-text-2)]">{formatDateTime(getValue<string | null>())}</span>,
        },
        {
            accessorKey: 'pulled_count',
            header: 'Data ditarik',
            meta: { label: 'Data ditarik', className: 'text-right' },
            cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()} tiket</span>,
        },
        {
            accessorKey: 'status',
            header: 'Hasil',
            meta: { label: 'Hasil', mobile: 'end' },
            cell: ({ row }) => (
                <span title={row.original.message ?? undefined}>
                    <Pill tone={row.original.status === 'berhasil' ? 'success' : 'danger'}>
                        {row.original.status === 'berhasil' ? 'Berhasil' : 'Gagal'}
                    </Pill>
                </span>
            ),
        },
    ];

    return (
        <AdminLayout
            title="Manajemen Kanal"
            subtitle={`${channels.length} kanal terdaftar · ${integrations.length} integrasi nasional${failed ? ` · ${failed} sinkronisasi gagal` : ''}.`}
            actions={
                is_super_admin ? (
                    <Button className="h-10" onClick={() => setOpen(true)}>
                        <Plus className="h-4 w-4" aria-hidden="true" /> Tambah kanal
                    </Button>
                ) : undefined
            }
        >
            {/* A-05: penambahan kanal & sinkronisasi hanya untuk Super Admin. */}
            {!is_super_admin && (
                <p className="mb-6 flex items-start gap-2 rounded-lg border border-[var(--adm-border)] bg-[var(--adm-info-soft)] px-4 py-3 text-sm text-[var(--adm-text)]">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--adm-info)]" aria-hidden="true" />
                    Penambahan kanal dan sinkronisasi integrasi nasional hanya dapat dilakukan Super Admin.
                </p>
            )}

            <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
                <DialogContent className="max-h-[calc(100dvh-32px)] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Tambah kanal</DialogTitle>
                        <DialogDescription>Akun media sosial resmi atau kantor yang menerima pengaduan warga.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submit} className="space-y-4">
                        <fieldset>
                            <legend className="mb-1.5 text-[13px] font-semibold text-[var(--adm-text)]">Jenis kanal</legend>
                            <div className="grid grid-cols-2 gap-2">
                                {(
                                    [
                                        { value: 'sosmed', label: 'Media sosial', Icon: Hash },
                                        { value: 'kantor', label: 'Kantor pengaduan', Icon: Building2 },
                                    ] as const
                                ).map(({ value, label, Icon }) => {
                                    const active = form.data.type === value;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            aria-pressed={active}
                                            onClick={() => {
                                                form.setData({ type: value, name: '', account_name: '', url: '' });
                                                form.clearErrors();
                                            }}
                                            className={cn(
                                                'flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors',
                                                active
                                                    ? 'border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] text-[var(--acd-link,var(--adm-primary))]'
                                                    : 'border-[var(--adm-border)] text-[var(--adm-text-2)] hover:border-[var(--adm-border-strong)]',
                                            )}
                                        >
                                            <Icon className="h-4 w-4" aria-hidden="true" /> {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </fieldset>

                        {form.data.type === 'sosmed' ? (
                            <Field label={copy.account} required error={form.errors.account_name}>
                                <Select value={form.data.account_name} onValueChange={(v) => form.setData('account_name', v)}>
                                    <SelectTrigger aria-label={copy.account}>
                                        <SelectValue placeholder="Pilih platform" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PLATFORMS.map((p) => (
                                            <SelectItem key={p} value={p}>
                                                {p}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        ) : null}
                        <Field label={copy.name} required error={form.errors.name}>
                            <Input
                                value={form.data.name}
                                onChange={(e) => form.setData('name', e.target.value)}
                                placeholder={copy.namePh}
                                autoFocus
                            />
                        </Field>
                        {form.data.type === 'kantor' && (
                            <Field label={copy.account} required error={form.errors.account_name}>
                                <Input
                                    value={form.data.account_name}
                                    onChange={(e) => form.setData('account_name', e.target.value)}
                                    placeholder="Nama penanggung jawab"
                                />
                            </Field>
                        )}
                        <Field label={copy.url} required={form.data.type === 'sosmed'} error={form.errors.url}>
                            <Input type="url" value={form.data.url} onChange={(e) => form.setData('url', e.target.value)} placeholder={copy.urlPh} />
                        </Field>
                        <div className="flex justify-end gap-2 pt-1">
                            <Button type="button" variant="outline" onClick={close}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={form.processing}>
                                Simpan kanal
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <DataTable<Channel>
                columns={channelColumns}
                data={channels}
                toolbarTitle="Kanal terdaftar"
                searchPlaceholder="Cari nama kanal atau akun…"
                itemLabel="kanal"
                emptyMessage="Belum ada kanal."
            />

            <section aria-labelledby="integrasi-heading" className="mt-8">
                <h2 id="integrasi-heading" className="text-[15px] font-semibold text-[var(--adm-text)]">
                    Integrasi kanal nasional
                </h2>
                <p className="mt-1 mb-4 max-w-2xl text-[13px] text-[var(--adm-text-2)]">
                    Menarik pengaduan dari sistem nasional (Perpres No. 76 Tahun 2013). Adapter masih berupa uji coba (stub), jadi data yang ditarik
                    belum berasal dari sistem sungguhan.
                </p>

                <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {integrations.map((integ) => {
                        const lastLog = logs.find((l) => (l.channel ?? '').toLowerCase().includes(integ.key));
                        return (
                            <div
                                key={integ.key}
                                className="flex flex-col gap-4 rounded-xl border border-[var(--adm-border)] bg-[var(--acd-surface,#fff)] p-5 sm:flex-row sm:items-center"
                            >
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--adm-primary-soft)] text-[var(--acd-link,var(--adm-primary))]">
                                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <h3 className="flex flex-wrap items-center gap-2 font-semibold text-[var(--adm-text)]">
                                        {integ.label}
                                        <Pill tone="warning">Uji coba</Pill>
                                    </h3>
                                    <p className="mt-1 text-[13px] text-[var(--adm-text-2)]">
                                        {lastLog ? (
                                            <>
                                                Terakhir sinkron {formatDateTime(lastLog.created_at)} · {lastLog.pulled_count} tiket
                                            </>
                                        ) : (
                                            'Belum pernah disinkronkan'
                                        )}
                                    </p>
                                </div>
                                {is_super_admin && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 shrink-0"
                                        onClick={() => router.post(`/admin/integrasi/${integ.key}`, {}, { preserveScroll: true })}
                                    >
                                        <RefreshCw className="h-4 w-4" aria-hidden="true" /> Sinkron sekarang
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>

                <DataTable<Log>
                    columns={logColumns}
                    data={logs}
                    toolbarTitle="Riwayat sinkronisasi"
                    searchPlaceholder="Cari kanal…"
                    itemLabel="log"
                    emptyMessage="Belum ada riwayat sinkronisasi."
                />
            </section>
        </AdminLayout>
    );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
    return (
        // <label> pembungkus: label tertaut ke isian di dalamnya.
        <label className="block space-y-1.5">
            <span className="block text-[13px] font-semibold text-[var(--adm-text)]">
                {label} {required && <span className="text-[var(--adm-danger)]">*</span>}
            </span>
            {children}
            {error && <span className="block text-xs font-semibold text-[var(--adm-danger)]">{error}</span>}
        </label>
    );
}
