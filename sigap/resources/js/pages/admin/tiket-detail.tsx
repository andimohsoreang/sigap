import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AdminLayout, { ImpactBadge, StatusBadge } from '@/layouts/admin-layout';
import { formatDateTime, OPEN_STATUSES, slaDeadline, SOURCE_LABEL } from '@/lib/admin-format';
import { cn } from '@/lib/utils';
import { Link, useForm } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, Check, Copy, Download, ExternalLink, Lock, MessageSquareText, Network, RotateCcw, Undo2 } from 'lucide-react';
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
    /** Unit Kerja penangan hasil disposisi. */
    unit_penangan?: string | null;
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

interface DisposisiItem {
    id: number;
    unit: string | null;
    status: string;
    status_label: string;
    aktif: boolean;
    catatan: string | null;
    tenggat: string | null;
    oleh: string | null;
    pada: string | null;
    ditutup_oleh: string | null;
    ditutup_pada: string | null;
    alasan: string | null;
}

interface Disposisi {
    boleh_ubah: boolean;
    unit_options: { id: number; name: string; depth: number }[];
    riwayat: DisposisiItem[];
}

interface Jawaban {
    nilai: number | null;
    jawaban: string | null;
}

/** Hasil survei kepuasan: versi 1 = bintang 1–5 (lama), versi 2 = kuesioner skala 1–4. */
type Survei =
    | { versi: 1; rating: number | null; komentar: string | null; dikirim: string | null }
    | {
          versi: 2;
          indeks: number | null;
          mutu: { huruf: string; mutu: string } | null;
          aspek: ({ aspek: string } & Jawaban)[];
          keseluruhan: Jawaban;
          teratasi: string | null;
          kembali: Jawaban;
          baik: string | null;
          perbaikan: string | null;
          profil: Record<string, string>;
          dikirim: string | null;
      };

interface Tinjau {
    perlu: boolean;
    alasan: string | null;
    diminta: string;
    ditinjau: string | null;
    oleh: string | null;
}

interface Props {
    ticket: Detail;
    statuses: Record<string, string>;
    disposisi: Disposisi;
    survei: Survei | null;
    tinjau: Tinjau | null;
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
export default function TiketDetail({ ticket, statuses, disposisi, survei, tinjau }: Props) {
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
                    {ticket.unit_penangan && <span className="mt-0.5 block text-xs text-[var(--adm-text-3)]">{ticket.unit_penangan}</span>}
                </Summary>
            </dl>

            {tinjau?.perlu && <TinjauBanner nomor={ticket.nomor} tinjau={tinjau} />}

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
                    {survei && <SurveiPanel survei={survei} tinjau={tinjau} />}
                </div>

                {/* Kanan: tindak lanjut & pelapor (menempel di layar lebar) */}
                <aside className="space-y-6 lg:sticky lg:top-[88px] lg:max-h-[calc(100dvh-112px)] lg:overflow-y-auto lg:pr-1">
                    <DisposisiPanel
                        nomor={ticket.nomor}
                        terbuka={OPEN_STATUSES.includes(ticket.status)}
                        tenggatSla={ticket.tenggat_sla}
                        disposisi={disposisi}
                    />

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

/** Nilai awal input datetime-local (waktu lokal) dari ISO; kosong bila sudah lewat. */
function toLocalInput(iso: string | null): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Disposisi ke Unit Kerja (PRD-UNIT-KERJA F2). Satu langkah berikutnya:
 * belum didisposisi → formulir; sudah → unit aktif + Alihkan / Tarik.
 * Hanya Super Admin yang mengubah; peran lain melihat unitnya saja.
 */
function DisposisiPanel({
    nomor,
    terbuka,
    tenggatSla,
    disposisi,
}: {
    nomor: string;
    terbuka: boolean;
    tenggatSla: string | null;
    disposisi: Disposisi;
}) {
    const aktif = disposisi.riwayat.find((d) => d.aktif) ?? null;
    const lampau = disposisi.riwayat.filter((d) => !d.aktif);
    const [mode, setMode] = useState<'lihat' | 'alihkan' | 'tarik'>('lihat');
    const form = useForm({ unit_id: '', catatan: '', tenggat: toLocalInput(tenggatSla) });
    const tarik = useForm({ alasan: '' });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((d) => ({ ...d, unit_id: Number(d.unit_id), tenggat: d.tenggat ? new Date(d.tenggat).toISOString() : null }));
        form.post(`/admin/tiket/${nomor}/disposisi`, {
            preserveScroll: true,
            onSuccess: () => {
                form.reset('unit_id', 'catatan');
                setMode('lihat');
            },
        });
    };

    const submitTarik = (e: FormEvent) => {
        e.preventDefault();
        tarik.delete(`/admin/tiket/${nomor}/disposisi`, {
            preserveScroll: true,
            onSuccess: () => {
                tarik.reset();
                setMode('lihat');
            },
        });
    };

    const showForm = disposisi.boleh_ubah && terbuka && (aktif === null || mode === 'alihkan');

    return (
        <Panel title="Disposisi unit">
            {aktif ? (
                <div className="space-y-2">
                    <div className="flex items-start gap-2.5">
                        <Network className="mt-0.5 h-4 w-4 shrink-0 text-[var(--acd-link,var(--adm-primary))]" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="font-semibold text-[var(--adm-text)]">{aktif.unit}</p>
                            <p className="text-xs text-[var(--adm-text-2)]">
                                {aktif.status_label}
                                {aktif.tenggat && <> · tenggat {formatDateTime(aktif.tenggat)}</>}
                            </p>
                        </div>
                    </div>
                    {aktif.catatan && (
                        <p className="rounded-lg bg-[var(--adm-surface-2)] px-3 py-2 text-sm whitespace-pre-line text-[var(--adm-text)]">
                            {aktif.catatan}
                        </p>
                    )}
                    <p className="text-xs text-[var(--adm-text-3)]">
                        Oleh {aktif.oleh ?? '—'} · {formatDateTime(aktif.pada)}
                    </p>
                    {disposisi.boleh_ubah && terbuka && mode === 'lihat' && (
                        <div className="flex gap-2 pt-1">
                            <Button type="button" variant="outline" size="sm" className="h-9 flex-1" onClick={() => setMode('alihkan')}>
                                Alihkan
                            </Button>
                            <Button type="button" variant="outline" size="sm" className="h-9 flex-1" onClick={() => setMode('tarik')}>
                                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> Tarik
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                !showForm && (
                    <p className="text-sm text-[var(--adm-text-2)]">
                        {terbuka ? 'Belum didisposisikan ke unit kerja.' : 'Tiket tidak didisposisikan ke unit kerja.'}
                    </p>
                )
            )}

            {mode === 'tarik' && aktif && (
                <form onSubmit={submitTarik} className="mt-4 space-y-3 border-t border-[var(--adm-border)] pt-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="alasan-tarik" className="text-[13px] font-semibold text-[var(--adm-text)]">
                            Alasan menarik (opsional)
                        </Label>
                        <Textarea id="alasan-tarik" rows={2} value={tarik.data.alasan} onChange={(e) => tarik.setData('alasan', e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setMode('lihat')}>
                            Batal
                        </Button>
                        <Button type="submit" className="flex-1" disabled={tarik.processing}>
                            Tarik disposisi
                        </Button>
                    </div>
                </form>
            )}

            {showForm && (
                <form onSubmit={submit} className={cn('space-y-4', aktif && 'mt-4 border-t border-[var(--adm-border)] pt-4')}>
                    {disposisi.unit_options.length === 0 ? (
                        <p className="text-sm text-[var(--adm-text-2)]">
                            Belum ada unit kerja aktif.{' '}
                            <Link href="/admin/unit-kerja" className="font-semibold text-[var(--acd-link,var(--adm-primary))] hover:underline">
                                Tambah unit
                            </Link>
                        </p>
                    ) : (
                        <>
                            <div className="space-y-1.5">
                                <Label className="text-[13px] font-semibold text-[var(--adm-text)]">{aktif ? 'Alihkan ke unit' : 'Unit kerja'}</Label>
                                <Select value={form.data.unit_id} onValueChange={(v) => form.setData('unit_id', v)}>
                                    <SelectTrigger aria-label="Unit kerja" aria-invalid={Boolean(form.errors.unit_id)}>
                                        <SelectValue placeholder="Pilih unit" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {disposisi.unit_options.map((u) => (
                                            <SelectItem key={u.id} value={String(u.id)}>
                                                {'\u00a0\u00a0'.repeat(u.depth)}
                                                {u.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {form.errors.unit_id && <p className="text-xs font-semibold text-[var(--adm-danger)]">{form.errors.unit_id}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="tenggat-disposisi" className="text-[13px] font-semibold text-[var(--adm-text)]">
                                    Tenggat
                                </Label>
                                <Input
                                    id="tenggat-disposisi"
                                    type="datetime-local"
                                    value={form.data.tenggat}
                                    onChange={(e) => form.setData('tenggat', e.target.value)}
                                />
                                {form.errors.tenggat ? (
                                    <p className="text-xs font-semibold text-[var(--adm-danger)]">{form.errors.tenggat}</p>
                                ) : (
                                    <p className="text-xs text-[var(--adm-text-3)]">
                                        {toLocalInput(tenggatSla)
                                            ? 'Terisi tenggat SLA tiket. Boleh diubah atau dikosongkan.'
                                            : tenggatSla
                                              ? 'Tenggat SLA tiket sudah lewat. Isi tenggat baru untuk unit bila perlu.'
                                              : 'Opsional.'}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="catatan-disposisi" className="text-[13px] font-semibold text-[var(--adm-text)]">
                                    Instruksi untuk unit (opsional)
                                </Label>
                                <Textarea
                                    id="catatan-disposisi"
                                    rows={3}
                                    value={form.data.catatan}
                                    onChange={(e) => form.setData('catatan', e.target.value)}
                                    placeholder="Mis. mohon dicek status sertifikat di lokasi SP 2"
                                />
                            </div>
                            <div className="flex gap-2">
                                {aktif && (
                                    <Button type="button" variant="outline" className="flex-1" onClick={() => setMode('lihat')}>
                                        Batal
                                    </Button>
                                )}
                                <Button type="submit" className="flex-1" disabled={form.processing || !form.data.unit_id}>
                                    {aktif ? 'Alihkan' : 'Disposisikan'}
                                </Button>
                            </div>
                        </>
                    )}
                </form>
            )}

            {lampau.length > 0 && (
                <details className="mt-4 border-t border-[var(--adm-border)] pt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-[var(--adm-text-2)]">Riwayat disposisi ({lampau.length})</summary>
                    <ol className="mt-2 space-y-2">
                        {lampau.map((d) => (
                            <li key={d.id} className="text-xs text-[var(--adm-text-2)]">
                                <span className="font-semibold text-[var(--adm-text)]">{d.unit}</span> · {d.status_label}
                                <span className="block text-[var(--adm-text-3)]">
                                    {formatDateTime(d.pada)}
                                    {d.ditutup_pada && <> → {formatDateTime(d.ditutup_pada)}</>}
                                    {d.ditutup_oleh && <> oleh {d.ditutup_oleh}</>}
                                </span>
                                {d.alasan && <span className="block italic">“{d.alasan}”</span>}
                            </li>
                        ))}
                    </ol>
                </details>
            )}
        </Panel>
    );
}

/** Permintaan tinjau ulang dari survei: buka kembali lewat Tindak lanjut, atau tutup tanpa membuka. */
function TinjauBanner({ nomor, tinjau }: { nomor: string; tinjau: Tinjau }) {
    const [closing, setClosing] = useState(false);
    const form = useForm({ note: '' });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(`/admin/tiket/${nomor}/tinjau-ulang`, { preserveScroll: true });
    };

    return (
        <section
            role="status"
            className="mb-6 rounded-xl border border-[var(--adm-warning)]/40 bg-[var(--adm-warning-soft,#fdf3e1)] p-4 text-[var(--adm-text)] sm:p-5"
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                    <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-[var(--adm-warning)]" aria-hidden="true" />
                    <div>
                        <p className="font-semibold">Perlu tinjau ulang · {tinjau.alasan}</p>
                        <p className="mt-0.5 text-sm text-[var(--adm-text-2)]">
                            Ditandai {formatDateTime(tinjau.diminta)} dari survei kepuasan. Buka kembali tiket lewat Tindak lanjut → Diproses, atau
                            tutup tinjauan bila penanganan sudah tepat.
                        </p>
                    </div>
                </div>
                {!closing && (
                    <Button type="button" variant="outline" className="h-9 shrink-0 bg-[var(--acd-surface,#fff)]" onClick={() => setClosing(true)}>
                        Tandai sudah ditinjau
                    </Button>
                )}
            </div>
            {closing && (
                <form onSubmit={submit} className="mt-4 space-y-2 sm:pl-8">
                    <Label htmlFor="catatan-tinjau" className="text-[13px] font-semibold">
                        Catatan internal (opsional)
                    </Label>
                    <Textarea
                        id="catatan-tinjau"
                        value={form.data.note}
                        onChange={(e) => form.setData('note', e.target.value)}
                        placeholder="Mis. sudah dikonfirmasi ke pelapor lewat telepon, penanganan sesuai."
                        className="bg-[var(--acd-surface,#fff)]"
                    />
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" className="h-9" onClick={() => setClosing(false)}>
                            Batal
                        </Button>
                        <Button type="submit" className="h-9" disabled={form.processing}>
                            Tutup tinjauan
                        </Button>
                    </div>
                </form>
            )}
        </section>
    );
}

function SurveiPanel({ survei, tinjau }: { survei: Survei; tinjau: Tinjau | null }) {
    if (survei.versi === 1) {
        return (
            <Panel title="Survei kepuasan">
                <p className="text-sm text-[var(--adm-text-2)]">Survei format lama (bintang 1–5), tidak dihitung dalam indeks SKM.</p>
                <p className="mt-2 text-[15px] font-semibold text-[var(--adm-text)]">{survei.rating ?? '—'} dari 5 bintang</p>
                {survei.komentar && <p className="mt-1 text-sm whitespace-pre-line text-[var(--adm-text)]">“{survei.komentar}”</p>}
                <p className="mt-2 text-xs text-[var(--adm-text-3)]">Dikirim {formatDateTime(survei.dikirim)}</p>
            </Panel>
        );
    }

    return (
        <Panel title="Survei kepuasan">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <div>
                    <p className="text-xs font-medium text-[var(--adm-text-3)]">Indeks SKM (25–100)</p>
                    <p className="text-2xl font-semibold text-[var(--adm-text)] tabular-nums">
                        {survei.indeks?.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}
                        {survei.mutu && (
                            <span className="ml-2 text-sm font-semibold text-[var(--adm-text-2)]">
                                {survei.mutu.huruf} · {survei.mutu.mutu}
                            </span>
                        )}
                    </p>
                </div>
                <dl className="flex flex-wrap gap-x-6 gap-y-2">
                    <Item label="Kepuasan keseluruhan">{survei.keseluruhan.jawaban ?? '—'}</Item>
                    <Item label="Masalah teratasi">{survei.teratasi ?? '—'}</Item>
                    <Item label="Menggunakan kembali">{survei.kembali.jawaban ?? '—'}</Item>
                </dl>
            </div>
            <table className="mt-5 w-full text-sm">
                <caption className="sr-only">Jawaban per aspek, skala 1 sampai 4</caption>
                <thead>
                    <tr className="border-b border-[var(--adm-border)] text-left text-xs text-[var(--adm-text-3)]">
                        <th className="py-2 font-medium">Aspek</th>
                        <th className="py-2 font-medium">Jawaban</th>
                        <th className="py-2 text-right font-medium">Nilai</th>
                    </tr>
                </thead>
                <tbody>
                    {survei.aspek.map((a) => (
                        <tr key={a.aspek} className="border-b border-[var(--adm-border)] last:border-0">
                            <td className="py-2 pr-3 text-[var(--adm-text-2)]">{a.aspek}</td>
                            <td className="py-2 pr-3 text-[var(--adm-text)]">{a.jawaban ?? '—'}</td>
                            <td
                                className={cn(
                                    'py-2 text-right font-semibold tabular-nums',
                                    a.nilai !== null && a.nilai <= 2 ? 'text-[var(--adm-danger)]' : 'text-[var(--adm-text)]',
                                )}
                            >
                                {a.nilai ?? '—'}/4
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {(survei.baik || survei.perbaikan) && (
                <dl className="mt-5 space-y-3 text-sm">
                    {survei.baik && (
                        <div>
                            <dt className="text-xs font-medium text-[var(--adm-text-3)]">Yang sudah baik</dt>
                            <dd className="mt-0.5 whitespace-pre-line text-[var(--adm-text)]">{survei.baik}</dd>
                        </div>
                    )}
                    {survei.perbaikan && (
                        <div>
                            <dt className="text-xs font-medium text-[var(--adm-text-3)]">Yang perlu diperbaiki</dt>
                            <dd className="mt-0.5 whitespace-pre-line text-[var(--adm-text)]">{survei.perbaikan}</dd>
                        </div>
                    )}
                </dl>
            )}
            <p className="mt-4 text-xs text-[var(--adm-text-3)]">
                Dikirim {formatDateTime(survei.dikirim)}
                {Object.keys(survei.profil).length > 0 && ` · ${Object.values(survei.profil).join(' · ')}`}
                {tinjau &&
                    !tinjau.perlu &&
                    tinjau.ditinjau &&
                    ` · Tinjau ulang ditutup ${formatDateTime(tinjau.ditinjau)} oleh ${tinjau.oleh ?? 'petugas'}`}
            </p>
        </Panel>
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
