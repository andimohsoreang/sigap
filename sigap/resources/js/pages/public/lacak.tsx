import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import PublicLayout from '@/layouts/public-layout';
import { formatDateTime, statusClass, statusLabel } from '@/lib/sigap';
import { cn } from '@/lib/utils';
import { Head, router, useForm } from '@inertiajs/react';
import { CheckCircle2, CircleDot, Search, Star, Ticket, XCircle } from 'lucide-react';
import { type FormEvent, useState } from 'react';

interface TicketData {
    nomor: string;
    judul: string;
    deskripsi: string;
    status: string;
    prioritas: string;
    impact: string | null;
    kategori: string | null;
    kawasan: string | null;
    pelapor: string | null;
    created_at: string | null;
    tenggat_sla: string | null;
    riwayat: { dari: string | null; ke: string; pada: string | null }[];
    tanggapan: { id: number; author: string | null; body: string; created_at: string | null }[];
    sudah_disurvei?: boolean;
}

interface Props {
    query: string;
    ticket: TicketData | null | false;
    statuses: Record<string, string>;
}

export default function Lacak({ query, ticket, statuses }: Props) {
    const [input, setInput] = useState(query);
    const [surveyOpen, setSurveyOpen] = useState(false);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (input.trim()) router.get('/lacak', { ticket: input.trim().toUpperCase() });
    };

    const notFound = ticket === false;
    const data = ticket && ticket !== false ? ticket : null;

    return (
        <PublicLayout title="Lacak Tiket">
            <Head title="Lacak Tiket — SIGAP" />

            <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
                <h1 className="mb-2 text-center text-3xl font-bold text-gray-800 dark:text-white">Lacak Status Laporan</h1>
                <p className="mb-8 text-center text-gray-500 dark:text-gray-400">Masukkan nomor tiket yang Anda terima (contoh: TKT-9920).</p>

                <form onSubmit={submit} className="mx-auto mb-10 flex max-w-xl gap-2">
                    <div className="relative flex-grow">
                        <Ticket className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
                        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="TKT-XXXX" className="pl-9" />
                    </div>
                    <Button type="submit">
                        <Search className="h-4 w-4" /> Cari
                    </Button>
                </form>

                {notFound && (
                    <Card className="dark:bg-dark-card mx-auto max-w-xl border-rose-100 dark:border-rose-900/40">
                        <CardContent className="flex flex-col items-center p-8 text-center">
                            <XCircle className="mb-3 h-12 w-12 text-rose-500" />
                            <h2 className="mb-1 text-lg font-bold text-gray-800 dark:text-white">Tiket Tidak Ditemukan</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Nomor <strong>{query}</strong> tidak ditemukan atau merupakan tiket internal yang tidak dapat diakses publik.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {data && (
                    <div className="space-y-6">
                        <Card className="dark:bg-dark-card border-gray-100 dark:border-gray-800">
                            <CardContent className="p-6">
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm text-gray-400">Status Laporan Anda</p>
                                        <h2 className="text-primary dark:text-brand-light text-2xl font-bold">#{data.nomor}</h2>
                                    </div>
                                    <span className={`rounded-full px-4 py-1.5 text-sm font-bold ${statusClass(data.status)}`}>
                                        {statusLabel(data.status)}
                                    </span>
                                </div>
                                <Separator className="my-4" />
                                <h3 className="mb-1 font-bold text-gray-800 dark:text-white">{data.judul}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">{data.deskripsi}</p>

                                <div className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase">Kategori</p>
                                        <p className="text-gray-700 dark:text-gray-300">{data.kategori ?? '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase">Kawasan</p>
                                        <p className="text-gray-700 dark:text-gray-300">{data.kawasan ?? '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase">Diajukan</p>
                                        <p className="text-gray-700 dark:text-gray-300">{formatDateTime(data.created_at)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase">Tenggat SLA</p>
                                        <p className="text-gray-700 dark:text-gray-300">{formatDateTime(data.tenggat_sla)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {data.riwayat?.length > 0 && (
                            <Card className="dark:bg-dark-card border-gray-100 dark:border-gray-800">
                                <CardContent className="p-6">
                                    <h3 className="mb-4 font-bold text-gray-800 dark:text-white">Riwayat Penanganan</h3>
                                    <ol className="border-brand-soft relative space-y-6 border-l-2 pl-6 dark:border-gray-700">
                                        {data.riwayat.map((h, idx) => (
                                            <li key={idx} className="relative">
                                                <CircleDot className="text-primary dark:bg-dark-card dark:text-brand-light absolute top-0 -left-[31px] h-5 w-5 bg-white" />
                                                <p className="font-semibold text-gray-800 dark:text-white">{statusLabel(h.ke)}</p>
                                                <p className="text-xs text-gray-400">{formatDateTime(h.pada)}</p>
                                            </li>
                                        ))}
                                    </ol>
                                </CardContent>
                            </Card>
                        )}

                        {data.tanggapan?.length > 0 && (
                            <Card className="dark:bg-dark-card border-gray-100 dark:border-gray-800">
                                <CardContent className="p-6">
                                    <h3 className="mb-4 font-bold text-gray-800 dark:text-white">Tanggapan Petugas</h3>
                                    <div className="space-y-4">
                                        {data.tanggapan.map((r) => (
                                            <div
                                                key={r.id}
                                                className="border-brand-light bg-brand-soft/50 rounded-lg border-l-4 p-4 dark:bg-gray-800"
                                            >
                                                <p className="text-primary dark:text-brand-light mb-1 text-xs font-bold">
                                                    {r.author ?? 'Petugas SIGAP'}
                                                </p>
                                                <p className="text-sm text-gray-700 dark:text-gray-300">{r.body}</p>
                                                <p className="mt-1 text-xs text-gray-400">{formatDateTime(r.created_at)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {data.status === 'selesai' && (
                            <Card className="dark:bg-dark-card border-emerald-100 dark:border-emerald-900/40">
                                <CardContent className="flex flex-col items-center p-6 text-center">
                                    <CheckCircle2 className="mb-2 h-10 w-10 text-emerald-500" />
                                    <h3 className="font-bold text-gray-800 dark:text-white">Laporan Selesai Ditangani</h3>
                                    <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                                        Aduan Anda telah diselesaikan. Terima kasih telah membantu kami.
                                    </p>
                                    {data.sudah_disurvei ? (
                                        <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                            <CheckCircle2 className="h-4 w-4" /> Survei kepuasan sudah Anda kirim.
                                        </p>
                                    ) : (
                                        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setSurveyOpen(true)}>
                                            Isi Survei Kepuasan
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}

                {!data && !notFound && (
                    <p className="text-center text-sm text-gray-400">Masukkan nomor tiket lalu tekan Cari untuk melihat status laporan Anda.</p>
                )}
            </div>

            {surveyOpen && data && <SurveyModal ticket={data.nomor} onClose={() => setSurveyOpen(false)} />}
        </PublicLayout>
    );
}

function SurveyModal({ ticket, onClose }: { ticket: string; onClose: () => void }) {
    const form = useForm({ ticket, rating: 0, comment: '' });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post('/lacak/survei', {
            preserveScroll: true,
            onSuccess: () => onClose(),
        });
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="survey-title"
        >
            <form onSubmit={submit} className="dark:bg-dark-card w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-500 shadow-sm dark:bg-green-900/30">
                    <Star className="h-7 w-7" />
                </div>
                <h2 id="survey-title" className="mb-2 text-2xl font-bold text-gray-800 dark:text-white">
                    Survei Kepuasan
                </h2>
                <p className="mb-6 text-sm leading-relaxed text-gray-500 dark:text-gray-400">Bagaimana pengalaman Anda menggunakan layanan SIGAP?</p>

                <div className="mb-6 flex justify-center gap-2" role="radiogroup" aria-label="Penilaian 1 sampai 5 bintang">
                    {[1, 2, 3, 4, 5].map((n) => (
                        <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={form.data.rating === n}
                            aria-label={`${n} bintang`}
                            onClick={() => form.setData('rating', n)}
                            className={cn('transition-colors', n <= form.data.rating ? 'text-secondary' : 'text-gray-300 dark:text-gray-600')}
                        >
                            <Star className={cn('h-8 w-8', n <= form.data.rating && 'fill-current')} />
                        </button>
                    ))}
                </div>
                {form.errors.rating && <p className="mb-3 text-xs font-semibold text-rose-500">{form.errors.rating}</p>}

                <Textarea
                    value={form.data.comment}
                    onChange={(e) => form.setData('comment', e.target.value)}
                    rows={3}
                    placeholder="Komentar tambahan (opsional)"
                    className="mb-4"
                />

                <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={onClose} className="w-1/3">
                        Nanti
                    </Button>
                    <Button type="submit" disabled={form.processing || form.data.rating === 0} className="w-2/3 bg-green-500 hover:bg-green-600">
                        Kirim Penilaian
                    </Button>
                </div>
            </form>
        </div>
    );
}
