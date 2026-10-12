import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AdminLayout, { ImpactBadge, StatusBadge } from '@/layouts/admin-layout';
import { Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Clock, Download, History, MapPin, Send, Tag, User2 } from 'lucide-react';
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
    riwayat: { dari: string | null; ke: string; catatan: string | null; oleh: string | null; pada: string | null }[];
    tanggapan: { id: number; penulis: string; body: string; is_public: boolean; pada: string | null }[];
}

interface Props {
    ticket: Detail;
    statuses: Record<string, string>;
}

export default function TiketDetail({ ticket, statuses }: Props) {
    const statusForm = useForm({ status: ticket.status, note: '' });
    const replyForm = useForm({ body: '', is_public: true });

    const submitStatus = (e: FormEvent) => {
        e.preventDefault();
        statusForm.post(`/admin/tiket/${ticket.nomor}/status`, { preserveScroll: true, onSuccess: () => statusForm.reset('note') });
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
                    <Card className="dark:bg-dark-card border-gray-200 dark:border-gray-700">
                        <CardHeader className="border-b border-gray-100 pb-3 dark:border-gray-700">
                            <CardTitle className="text-base text-gray-800 dark:text-white">Detail Laporan</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 p-6">
                            <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge value={ticket.status} label={ticket.status_label} />
                                <ImpactBadge value={ticket.impact} label={ticket.impact_label} />
                                {ticket.overdue && (
                                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold text-red-700 uppercase dark:bg-red-900/30 dark:text-red-400">
                                        EWS · Melewati SLA
                                    </span>
                                )}
                            </div>

                            <p className="text-gray-700 dark:text-gray-200">{ticket.deskripsi}</p>

                            <dl className="grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2 dark:border-gray-700">
                                <Info icon={Tag} label="Kategori" value={ticket.kategori} />
                                <Info icon={MapPin} label="Kawasan" value={ticket.kawasan} />
                                <Info icon={User2} label="Pelapor" value={ticket.pelapor} />
                                <Info icon={User2} label="NIK" value={ticket.nik} />
                                <Info icon={Send} label="Kontak" value={[ticket.telepon, ticket.email].filter(Boolean).join(' · ') || null} />
                                <Info icon={Clock} label="Tenggat SLA" value={ticket.tenggat_sla ? formatDateTime(ticket.tenggat_sla) : '—'} />
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
                    <Card className="dark:bg-dark-card border-gray-200 dark:border-gray-700">
                        <CardHeader className="border-b border-gray-100 pb-3 dark:border-gray-700">
                            <CardTitle className="text-base text-gray-800 dark:text-white">Tanggapan</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 p-6">
                            {ticket.tanggapan.length === 0 ? (
                                <p className="text-sm text-gray-400">Belum ada tanggapan.</p>
                            ) : (
                                <div className="space-y-3">
                                    {ticket.tanggapan.map((r) => (
                                        <div
                                            key={r.id}
                                            className={`rounded-lg border p-3 text-sm ${r.is_public ? 'border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800' : 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10'}`}
                                        >
                                            <div className="mb-1 flex items-center justify-between">
                                                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{r.penulis}</span>
                                                <span className="text-[10px] text-gray-400">
                                                    {r.is_public ? 'Publik' : 'Catatan internal'} · {formatDateTime(r.pada)}
                                                </span>
                                            </div>
                                            <p className="text-gray-700 dark:text-gray-200">{r.body}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <form onSubmit={submitReply} className="space-y-3 border-t border-gray-100 pt-4 dark:border-gray-700">
                                <Textarea
                                    value={replyForm.data.body}
                                    onChange={(e) => replyForm.setData('body', e.target.value)}
                                    rows={3}
                                    placeholder="Tulis tanggapan..."
                                />
                                {replyForm.errors.body && <p className="text-xs text-rose-500">{replyForm.errors.body}</p>}
                                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
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
                    <Card className="dark:bg-dark-card border-gray-200 dark:border-gray-700">
                        <CardHeader className="border-b border-gray-100 pb-3 dark:border-gray-700">
                            <CardTitle className="text-base text-gray-800 dark:text-white">Ubah Status</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <form onSubmit={submitStatus} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label>Status Baru</Label>
                                    <Select value={statusForm.data.status} onValueChange={(v) => statusForm.setData('status', v)}>
                                        <SelectTrigger aria-label="Status Baru">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(statuses).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
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
                                </div>
                                <Button type="submit" disabled={statusForm.processing} className="w-full">
                                    Simpan Status
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="dark:bg-dark-card border-gray-200 dark:border-gray-700">
                        <CardHeader className="border-b border-gray-100 pb-3 dark:border-gray-700">
                            <CardTitle className="flex items-center gap-2 text-base text-gray-800 dark:text-white">
                                <History className="text-brand-light h-4 w-4" /> Riwayat
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <ol className="space-y-4">
                                {ticket.riwayat.map((h, i) => (
                                    <li key={i} className="border-l-2 border-gray-100 pl-4 dark:border-gray-700">
                                        <p className="text-sm font-semibold text-gray-800 dark:text-white">
                                            {h.dari ? `${statuses[h.dari] ?? h.dari} → ` : ''}
                                            {statuses[h.ke] ?? h.ke}
                                        </p>
                                        {h.catatan && <p className="text-xs text-gray-500 dark:text-gray-400">{h.catatan}</p>}
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
                <dd className="text-sm text-gray-700 dark:text-gray-200">{value || '—'}</dd>
            </div>
        </div>
    );
}
