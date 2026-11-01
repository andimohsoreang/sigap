import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AdminLayout, { ImpactBadge, StatusBadge } from '@/layouts/admin-layout';
import { formatDateTime, OPEN_STATUSES, slaDeadline, SOURCE_LABEL } from '@/lib/admin-format';
import { cn } from '@/lib/utils';
import { Link, useForm } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, Check, Copy, Download, ExternalLink, Lock, MessageSquareText } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';

interface Detail {
    nomor: string;
    judul: string;
    deskripsi: string;
    status: string;
    status_label: string;
    prioritas: string | null;
    impact: string | null;
    impact_label: string | null;
    kategori: string | null;
    kawasan: string | null;
    kanal: string | null;
    pelapor: string | null;
    nik: string | null;
    email: string | null;
    telepon: string | null;
    petugas: string | null;
    created_at: string | null;
    tenggat_sla: string | null;
    overdue: boolean;
    has_attachment: boolean;
    /** Status tujuan yang diizinkan dari status saat ini (A-20). */
    transisi: string[];
    /** Kode akses pelacakan publik (diberikan kepada pelapor bila diminta). */
    kode_akses?: string | null;
    visibility?: string | null;
    nip?: string | null;
    unit?: string | null;
    lokasi?: string | null;
    sumber_laporan?: string | null;
    tautan?: string | null;
    admin_penerima?: string | null;
    riwayat: { dari: string | null; ke: string; catatan: string | null; oleh: string | null; pada: string | null }[];
    tanggapan: { id: number; penulis: string; body: string; is_public: boolean; pada: string | null }[];
}

interface Props {
    ticket: Detail;
    statuses: Record<string, string>;
}

const VISIBILITY_LABEL: Record<string, string> = {
    publik: 'Publik',
    anonim: 'Anonim',
    rahasia: 'Rahasia',
};

/** Tautan sumber hanya dirender sebagai link bila skema http(s). */
function isHttpUrl(value: string): boolean {
    return /^https?:\/\//i.test(value);
}

/**
 * Detail tiket: ringkasan (status, dampak, tenggat, petugas) di atas; isi
 * laporan, tanggapan & riwayat di kiri; tindak lanjut dan pelapor di panel
 * kanan yang menempel saat digulir (layar lebar).
 */
export default function TiketDetail({ ticket, statuses }: Props) {
    const transisi = ticket.transisi ?? [];
    const statusForm = useForm({ status: '', note: '' });
    const replyForm = useForm({ body: '', is_public: true as boolean });
    const sla = slaDeadline(ticket.tenggat_sla, OPEN_STATUSES.includes(ticket.status));

    const submitStatus = (e: FormEvent) => {
        e.preventDefault();
        statusForm.post(`/admin/tiket/${ticket.nomor}/status`, { preserveScroll: true, onSuccess: () => statusForm.reset('status', 'note') });
    };

    const submitReply = (e: FormEvent) => {
        e.preventDefault();
        replyForm.post(`/admin/tiket/${ticket.nomor}/tanggapan`, { preserveScroll: true, onSuccess: () => replyForm.reset('body') });
    };

    const sumber = ticket.sumber_laporan ? (SOURCE_LABEL[ticket.sumber_laporan] ?? ticket.sumber_laporan) : null;
    const kontak = [ticket.telepon, ticket.email].filter(Boolean).join(' · ') || null;

    return (
        <AdminLayout
            title={`Tiket #${ticket.nomor}`}
            subtitle={ticket.judul}
            actions={
                <Button asChild variant="outline" className="h-10">
                    <Link href="/admin/tiket">
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Semua tiket
                    </Link>
                </Button>
            }
        >
            {/* Ringkasan: empat hal yang paling sering dicek petugas. */}
            <dl className="mb-6 grid grid-cols-2 overflow-hidden rounded-xl border border-[var(--adm-border)] bg-[var(--acd-surface,#fff)] lg:grid-cols-4">
                <Summary label="Status">
                    <StatusBadge value={ticket.status} label={ticket.status_label} />
                </Summary>
                <Summary label="Dampak">
                    <ImpactBadge value={ticket.impact} label={ticket.impact_label} />
                </Summary>
                <Summary label="Tenggat SLA">
                    <span
                        className={cn(
                            'inline-flex items-center gap-1 font-semibold tabular-nums',
                            sla.tone === 'late' && 'text-[var(--adm-danger)]',
                            sla.tone === 'soon' && 'text-[var(--adm-warning)]',
                            sla.tone === 'ok' && 'text-[var(--adm-text)]',
                            sla.tone === 'none' && 'font-normal text-[var(--adm-text-3)]',
                        )}
                    >
                        {sla.tone === 'late' && <AlertTriangle className="h-4 w-4" aria-hidden="true" />}
                        {sla.tone === 'none' ? (ticket.tenggat_sla ? 'Tidak berlaku' : '—') : sla.text}
                    </span>
                    {ticket.tenggat_sla && (
                        <span className="mt-0.5 block text-xs text-[var(--adm-text-3)]">{formatDateTime(ticket.tenggat_sla)}</span>
                    )}
                </Summary>
                <Summary label="Petugas">
                    {ticket.petugas ? (
                        <span className="font-semibold text-[var(--adm-text)]">{ticket.petugas}</span>
                    ) : (
                        <span className="font-semibold text-[var(--adm-warning)]">Belum ditugaskan</span>
                    )}
                </Summary>
            </dl>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
                {/* Kiri: isi laporan + tanggapan */}
                <div className="min-w-0 space-y-6">
                    <Panel title="Laporan">
                        <p className="text-[15px] leading-relaxed whitespace-pre-line text-[var(--adm-text)]">{ticket.deskripsi}</p>

                        {ticket.has_attachment && (
                            <Button asChild variant="outline" size="sm" className="mt-4">
                                <a href={`/admin/tiket/${ticket.nomor}/lampiran`}>
                                    <Download className="h-4 w-4" aria-hidden="true" /> Unduh lampiran
                                </a>
                            </Button>
                        )}

                        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-[var(--adm-border)] pt-4 sm:grid-cols-2">
                            <Item label="Kategori" value={ticket.kategori} />
                            <Item label="Wilayah asal" value={ticket.kawasan} />
                            {ticket.kanal && <Item label="Kanal" value={ticket.kanal} />}
                            {sumber && <Item label="Sumber laporan" value={sumber} />}
                            <Item label="Tanggal masuk" value={formatDateTime(ticket.created_at)} />
                            {ticket.admin_penerima && <Item label="Diterima oleh" value={ticket.admin_penerima} />}
                            {ticket.tautan && (
                                <Item label="Tautan sumber" wide>
                                    {isHttpUrl(ticket.tautan) ? (
                                        <a
                                            href={ticket.tautan}
                                            target="_blank"
                                            rel="noopener noreferrer nofollow"
                                            className="inline-flex items-center gap-1 break-all text-[var(--acd-link,var(--adm-primary))] hover:underline"
                                        >
                                            {ticket.tautan}
                                            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                                            <span className="sr-only">(tab baru)</span>
                                        </a>
                                    ) : (
                                        <span className="break-all">{ticket.tautan}</span>
                                    )}
                                </Item>
                            )}
                        </dl>
                    </Panel>

                    <Panel title="Tanggapan" count={ticket.tanggapan.length}>
                        {ticket.tanggapan.length === 0 ? (
                            <p className="text-sm text-[var(--adm-text-2)]">Belum ada tanggapan. Pelapor menunggu kabar dari petugas.</p>
                        ) : (
                            <ol className="space-y-3">
                                {ticket.tanggapan.map((r) => (
                                    <li
                                        key={r.id}
                                        className={cn(
                                            'rounded-lg border p-3.5 text-sm',
                                            r.is_public
                                                ? 'border-[var(--adm-border)] bg-[var(--adm-surface-2)]'
                                                : 'border-[var(--adm-border)] bg-[var(--adm-warning-soft)]',
                                        )}
                                    >
                                        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                                            <span className="font-semibold text-[var(--adm-text)]">{r.penulis}</span>
                                            <span className="inline-flex items-center gap-1 text-[var(--adm-text-2)]">
                                                {r.is_public ? (
                                                    <>
                                                        <MessageSquareText className="h-3 w-3" aria-hidden="true" /> Ke pelapor
                                                    </>
                                                ) : (
                                                    <>
                                                        <Lock className="h-3 w-3" aria-hidden="true" /> Catatan internal
                                                    </>
                                                )}
                                            </span>
                                            <span className="text-[var(--adm-text-2)]">· {formatDateTime(r.pada)}</span>
                                        </div>
                                        <p className="whitespace-pre-line text-[var(--adm-text)]">{r.body}</p>
                                    </li>
                                ))}
                            </ol>
                        )}

                        <form onSubmit={submitReply} className="mt-5 border-t border-[var(--adm-border)] pt-4">
                            <div
                                className="mb-2 inline-flex rounded-lg border border-[var(--adm-border)] p-0.5"
                                role="group"
                                aria-label="Jenis tanggapan"
                            >
                                {(
                                    [
                                        { publik: true, label: 'Balas ke pelapor', Icon: MessageSquareText },
                                        { publik: false, label: 'Catatan internal', Icon: Lock },
                                    ] as const
                                ).map(({ publik, label, Icon }) => (
                                    <button
                                        key={label}
                                        type="button"
                                        aria-pressed={replyForm.data.is_public === publik}
                                        onClick={() => replyForm.setData('is_public', publik)}
                                        className={cn(
                                            'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors',
                                            replyForm.data.is_public === publik
                                                ? 'bg-[var(--adm-primary)] text-white'
                                                : 'text-[var(--adm-text-2)] hover:text-[var(--adm-text)]',
                                        )}
                                    >
                                        <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
                                    </button>
                                ))}
                            </div>
                            <Label htmlFor="tanggapan-body" className="sr-only">
                                Isi tanggapan
                            </Label>
                            <Textarea
                                id="tanggapan-body"
                                value={replyForm.data.body}
                                onChange={(e) => replyForm.setData('body', e.target.value)}
                                rows={4}
                                placeholder={replyForm.data.is_public ? 'Tulis tanggapan untuk pelapor…' : 'Catatan untuk sesama petugas…'}
                                aria-describedby="tanggapan-hint"
                            />
                            {replyForm.errors.body && <p className="mt-1 text-xs font-semibold text-[var(--adm-danger)]">{replyForm.errors.body}</p>}
                            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p id="tanggapan-hint" className="text-xs text-[var(--adm-text-2)]">
                                    {replyForm.data.is_public
                                        ? 'Pelapor menerima tanggapan ini lewat email bila alamatnya tersedia.'
                                        : 'Hanya terlihat oleh petugas. Tidak dikirim ke pelapor.'}
                                </p>
                                <Button type="submit" disabled={replyForm.processing || !replyForm.data.body.trim()} className="shrink-0">
                                    {replyForm.data.is_public ? 'Kirim tanggapan' : 'Simpan catatan'}
                                </Button>
                            </div>
                        </form>
                    </Panel>
                    <Panel title="Riwayat status">
                        <ol className="relative space-y-4 border-l border-[var(--adm-border)] pl-4">
                            {ticket.riwayat.map((h, i) => (
                                <li key={i} className="relative">
                                    <span
                                        className={cn(
                                            'absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full border-2 border-[var(--acd-surface,#fff)]',
                                            i === ticket.riwayat.length - 1 ? 'bg-[var(--adm-primary)]' : 'bg-[var(--adm-border-strong)]',
                                        )}
                                        aria-hidden="true"
                                    />
                                    <p className="text-sm font-semibold text-[var(--adm-text)]">
                                        {h.dari ? `${statuses[h.dari] ?? h.dari} → ` : ''}
                                        {statuses[h.ke] ?? h.ke}
                                    </p>
                                    {h.catatan && <p className="mt-0.5 text-[13px] text-[var(--adm-text-2)]">{h.catatan}</p>}
                                    <p className="mt-0.5 text-xs text-[var(--adm-text-3)]">
                                        {h.oleh ?? 'Sistem'} · {formatDateTime(h.pada)}
                                    </p>
                                </li>
                            ))}
                        </ol>
                    </Panel>
                </div>

                {/* Kanan: tindak lanjut & pelapor (menempel di layar lebar) */}
                <aside className="space-y-6 lg:sticky lg:top-[88px] lg:max-h-[calc(100dvh-112px)] lg:overflow-y-auto lg:pr-1">
                    <Panel title="Tindak lanjut">
                        {transisi.length === 0 ? (
                            <p className="text-sm text-[var(--adm-text-2)]">Tidak ada perubahan status yang diizinkan dari status saat ini.</p>
                        ) : (
                            <form onSubmit={submitStatus} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[13px] font-semibold text-[var(--adm-text)]">Status Baru</Label>
                                    <Select value={statusForm.data.status} onValueChange={(v) => statusForm.setData('status', v)}>
                                        <SelectTrigger aria-label="Status Baru" aria-invalid={Boolean(statusForm.errors.status)}>
                                            <SelectValue placeholder="Pilih status tujuan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {transisi.map((value) => (
                                                <SelectItem key={value} value={value}>
                                                    {statuses[value] ?? value}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {statusForm.errors.status && (
                                        <p className="text-xs font-semibold text-[var(--adm-danger)]">{statusForm.errors.status}</p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="catatan-status" className="text-[13px] font-semibold text-[var(--adm-text)]">
                                        Catatan (opsional)
                                    </Label>
                                    <Textarea
                                        id="catatan-status"
                                        name="note"
                                        value={statusForm.data.note}
                                        onChange={(e) => statusForm.setData('note', e.target.value)}
                                        rows={3}
                                        placeholder={statusForm.data.status === 'ditolak' ? 'Jelaskan alasan penolakan' : undefined}
                                    />
                                    {statusForm.errors.note && (
                                        <p className="text-xs font-semibold text-[var(--adm-danger)]">{statusForm.errors.note}</p>
                                    )}
                                </div>
                                <Button type="submit" disabled={statusForm.processing || !statusForm.data.status} className="w-full">
                                    Simpan Status
                                </Button>
                            </form>
                        )}
                    </Panel>

                    <Panel title="Pelapor">
                        <dl className="space-y-3">
                            <Item label="Nama" value={ticket.pelapor ?? 'Tanpa nama'} />
                            {ticket.nik && <Item label="NIK" value={ticket.nik} mono />}
                            {ticket.nip && <Item label="NIP" value={ticket.nip} mono />}
                            {ticket.unit && <Item label="Unit kerja" value={ticket.unit} />}
                            <Item label="Kontak" value={kontak} />
                            {ticket.visibility && <Item label="Visibilitas" value={VISIBILITY_LABEL[ticket.visibility] ?? ticket.visibility} />}
                            {ticket.kode_akses && (
                                <Item label="Kode akses lacak">
                                    <CopyValue value={ticket.kode_akses} />
                                </Item>
                            )}
                        </dl>
                    </Panel>
                </aside>
            </div>
        </AdminLayout>
    );
}

function Panel({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
    return (
        <section className="rounded-xl border border-[var(--adm-border)] bg-[var(--acd-surface,#fff)]">
            <h2 className="flex items-center gap-2 border-b border-[var(--adm-border)] px-5 py-3.5 text-[15px] font-semibold text-[var(--adm-text)]">
                {title}
                {count !== undefined && count > 0 && (
                    <span className="rounded-full bg-[var(--adm-surface-2)] px-1.5 text-xs font-semibold text-[var(--adm-text-2)] tabular-nums">
                        {count}
                    </span>
                )}
            </h2>
            <div className="p-5">{children}</div>
        </section>
    );
}

function Summary({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="border-[var(--adm-border)] px-5 py-4 lg:[&:not(:last-child)]:border-r [&:nth-child(-n+2)]:border-b lg:[&:nth-child(-n+2)]:border-b-0 [&:nth-child(odd)]:border-r">
            <dt className="mb-1.5 text-xs font-medium text-[var(--adm-text-3)]">{label}</dt>
            <dd className="text-sm">{children}</dd>
        </div>
    );
}

function Item({
    label,
    value,
    mono,
    wide,
    children,
}: {
    label: string;
    value?: string | null;
    mono?: boolean;
    wide?: boolean;
    children?: ReactNode;
}) {
    return (
        <div className={cn('min-w-0', wide && 'sm:col-span-2')}>
            <dt className="text-xs text-[var(--adm-text-3)]">{label}</dt>
            <dd className={cn('mt-0.5 text-sm break-words text-[var(--adm-text)]', mono && 'font-mono')}>{children ?? (value || '—')}</dd>
        </div>
    );
}

/** Nilai yang sering disalin petugas (kode akses lacak untuk pelapor). */
function CopyValue({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <span className="flex items-center gap-2">
            <code className="truncate rounded bg-[var(--adm-surface-2)] px-1.5 py-0.5 font-mono text-[13px]">{value}</code>
            <button
                type="button"
                onClick={() => {
                    void navigator.clipboard?.writeText(value).then(() => {
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1500);
                    });
                }}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-[var(--acd-link,var(--adm-primary))] hover:bg-[var(--adm-surface-2)]"
                aria-label="Salin kode akses lacak"
            >
                {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                <span aria-live="polite">{copied ? 'Tersalin' : 'Salin'}</span>
            </button>
        </span>
    );
}
