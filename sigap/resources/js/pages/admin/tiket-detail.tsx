import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AdminLayout, { ImpactBadge, StatusBadge } from '@/layouts/admin-layout';
import { Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Building2, Clock, Download, Eye, History, Link2, MapPin, Send, Tag, User2 } from 'lucide-react';
import { type FormEvent } from 'react';
import { formatDate, formatDateTime } from './matriks';

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

export default function TiketDetail({ ticket, statuses }: Props) {
    const transisi = ticket.transisi ?? [];
    const statusForm = useForm({ status: '', note: '' });
    const replyForm = useForm({ body: '', is_public: true as boolean });

    const submitStatus = (e: FormEvent) => {
        e.preventDefault();
        statusForm.post(`/admin/tiket/${ticket.nomor}/status`, { preserveScroll: true, onSuccess: () => statusForm.reset('status', 'note') });
    };

    const submitReply = (e: FormEvent) => {
        e.preventDefault();
        replyForm.post(`/admin/tiket/${ticket.nomor}/tanggapan`, { preserveScroll: true, onSuccess: () => replyForm.reset('body') });
    };

    return (
        <AdminLayout
            title={`Tiket #${ticket.nomor}`}
            subtitle={ticket.judul}
            actions={
                <Button asChild variant="outline" size="sm">
                    <Link href="/admin/tiket">
                        <ArrowLeft className="h-4 w-4" /> Kembali
                    </Link>
                </Button>
            }
        >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Kolom kiri: detail */}
                <div className="space-y-6 lg:col-span-2">
                    <Card className="border-gray-200">
                        <CardHeader className="border-b border-gray-100 pb-3">
                            <CardTitle className="text-base text-gray-800">Detail Laporan</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 p-6">
                            <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge value={ticket.status} label={ticket.status_label} />
                                <ImpactBadge value={ticket.impact} label={ticket.impact_label} />
                                {ticket.overdue && (
                                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold text-red-700 uppercase">
                                        EWS · Melewati SLA
                                    </span>
                                )}
                            </div>

                            <p className="text-gray-700">{ticket.deskripsi}</p>

                            <dl className="grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
                                <Info icon={Tag} label="Kategori" value={ticket.kategori} />
                                <Info icon={MapPin} label="Kawasan" value={ticket.kawasan} />
                                <Info icon={User2} label="Pelapor" value={ticket.pelapor} />
                                <Info icon={User2} label="NIK" value={ticket.nik} />
                                <Info icon={Send} label="Kontak" value={[ticket.telepon, ticket.email].filter(Boolean).join(' · ') || null} />
                                {ticket.kode_akses && <Info icon={Tag} label="Kode Akses Lacak" value={ticket.kode_akses} />}
                                <Info icon={Clock} label="Tenggat SLA" value={ticket.tenggat_sla ? formatDateTime(ticket.tenggat_sla) : '—'} />
                                {ticket.visibility && (
                                    <Info icon={Eye} label="Visibilitas" value={VISIBILITY_LABEL[ticket.visibility] ?? ticket.visibility} />
                                )}
                                {ticket.nip && <Info icon={User2} label="NIP" value={ticket.nip} />}
                                {ticket.unit && <Info icon={Building2} label="Unit Kerja" value={ticket.unit} />}
                                {ticket.lokasi && <Info icon={MapPin} label="Lokasi" value={ticket.lokasi} />}
                                {ticket.sumber_laporan && <Info icon={Send} label="Sumber Laporan" value={ticket.sumber_laporan} />}
                                {ticket.admin_penerima && <Info icon={User2} label="Admin Penerima" value={ticket.admin_penerima} />}
                                {ticket.tautan && (
                                    <div className="flex items-start gap-2 sm:col-span-2">
                                        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                                        <div className="min-w-0">
                                            <dt className="text-[10px] font-bold text-gray-400 uppercase">Tautan Sumber</dt>
                                            <dd className="text-sm break-all text-gray-700">
                                                {isHttpUrl(ticket.tautan) ? (
                                                    <a
                                                        href={ticket.tautan}
                                                        target="_blank"
                                                        rel="noopener noreferrer nofollow"
                                                        className="text-brand-light hover:underline"
                                                    >
                                                        {ticket.tautan}
                                                    </a>
                                                ) : (
                                                    ticket.tautan
                                                )}
                                            </dd>
                                        </div>
                                    </div>
                                )}
                            </dl>

                            {ticket.has_attachment && (
                                <Button asChild variant="outline" size="sm">
                                    <a href={`/admin/tiket/${ticket.nomor}/lampiran`}>
                                        <Download className="h-4 w-4" /> Unduh Lampiran
                                    </a>
                                </Button>
                            )}
                        </CardContent>
                    </Card>

                    {/* Tanggapan */}
                    <Card className="border-gray-200">
                        <CardHeader className="border-b border-gray-100 pb-3">
                            <CardTitle className="text-base text-gray-800">Tanggapan</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 p-6">
                            {ticket.tanggapan.length === 0 ? (
                                <p className="text-sm text-gray-400">Belum ada tanggapan.</p>
                            ) : (
                                <div className="space-y-3">
                                    {ticket.tanggapan.map((r) => (
                                        <div
                                            key={r.id}
                                            className={`rounded-lg border p-3 text-sm ${r.is_public ? 'border-gray-100 bg-white' : 'border-amber-200 bg-amber-50'}`}
                                        >
                                            <div className="mb-1 flex items-center justify-between">
                                                <span className="text-xs font-bold text-gray-700">{r.penulis}</span>
                                                <span className="text-[10px] text-gray-400">
                                                    {r.is_public ? 'Publik' : 'Catatan internal'} · {formatDateTime(r.pada)}
                                                </span>
                                            </div>
                                            <p className="text-gray-700">{r.body}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <form onSubmit={submitReply} className="space-y-3 border-t border-gray-100 pt-4">
                                <Textarea
                                    value={replyForm.data.body}
                                    onChange={(e) => replyForm.setData('body', e.target.value)}
                                    rows={3}
                                    placeholder="Tulis tanggapan..."
                                />
                                {replyForm.errors.body && <p className="text-xs text-rose-500">{replyForm.errors.body}</p>}
                                <label className="flex items-center gap-2 text-sm text-gray-600">
                                    <Checkbox
                                        checked={replyForm.data.is_public}
                                        onCheckedChange={(v) => replyForm.setData('is_public', Boolean(v))}
                                    />
                                    Tampilkan ke pelapor (tanggapan publik)
                                </label>
                                <Button type="submit" disabled={replyForm.processing}>
                                    <Send className="h-4 w-4" /> Kirim Tanggapan
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* Kolom kanan: aksi + riwayat */}
                <div className="space-y-6">
                    <Card className="border-gray-200">
                        <CardHeader className="border-b border-gray-100 pb-3">
                            <CardTitle className="text-base text-gray-800">Ubah Status</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            {transisi.length === 0 ? (
                                <p className="text-sm text-gray-500">Tidak ada perubahan status yang diizinkan dari status saat ini.</p>
                            ) : (
                                <form onSubmit={submitStatus} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label>Status Baru</Label>
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
                                        {statusForm.errors.status && <p className="text-xs text-rose-500">{statusForm.errors.status}</p>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="catatan-status">Catatan (opsional)</Label>
                                        <Textarea
                                            id="catatan-status"
                                            name="note"
                                            value={statusForm.data.note}
                                            onChange={(e) => statusForm.setData('note', e.target.value)}
                                            rows={2}
                                        />
                                        {statusForm.errors.note && <p className="text-xs text-rose-500">{statusForm.errors.note}</p>}
                                    </div>
                                    <Button type="submit" disabled={statusForm.processing || !statusForm.data.status} className="w-full">
                                        Simpan Status
                                    </Button>
                                </form>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-gray-200">
                        <CardHeader className="border-b border-gray-100 pb-3">
                            <CardTitle className="flex items-center gap-2 text-base text-gray-800">
                                <History className="text-brand-light h-4 w-4" /> Riwayat
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <ol className="space-y-4">
                                {ticket.riwayat.map((h, i) => (
                                    <li key={i} className="border-l-2 border-gray-100 pl-4">
                                        <p className="text-sm font-semibold text-gray-800">
                                            {h.dari ? `${statuses[h.dari] ?? h.dari} → ` : ''}
                                            {statuses[h.ke] ?? h.ke}
                                        </p>
                                        {h.catatan && <p className="text-xs text-gray-500">{h.catatan}</p>}
                                        <p className="mt-0.5 text-[10px] text-gray-400">
                                            {h.oleh ?? 'Sistem'} · {formatDate(h.pada)}
                                        </p>
                                    </li>
                                ))}
                            </ol>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AdminLayout>
    );
}

function Info({ icon: Icon, label, value }: { icon: typeof Tag; label: string; value: string | null }) {
    return (
        <div className="flex items-start gap-2">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <div>
                <dt className="text-[10px] font-bold text-gray-400 uppercase">{label}</dt>
                <dd className="text-sm text-gray-700">{value || '—'}</dd>
            </div>
        </div>
    );
}
