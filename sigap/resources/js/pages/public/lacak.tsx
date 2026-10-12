import { RecaptchaNotice } from '@/components/sigap/recaptcha-notice';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useRecaptcha } from '@/hooks/use-recaptcha';
import PublicLayout from '@/layouts/public-layout';
import { formatDateTime, isLegacyTicketNo, isValidTicketNo, normalizeTicketNo, statusClass, statusLabel, TICKET_NO_EXAMPLE } from '@/lib/sigap';
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
    /** Disamarkan untuk publik, mis. "B*** S***" atau "Anonim". */
    pelapor: string | null;
    /** Selalu null di jalur publik — baris disembunyikan. */
    nik?: string | null;
    /** Selalu null di jalur publik — baris disembunyikan. */
    petugas?: string | null;
    created_at: string | null;
    tenggat_sla: string | null;
    riwayat: { dari: string | null; ke: string; pada: string | null }[];
    tanggapan: { id: number; author: string | null; body: string; created_at: string | null }[];
    sudah_disurvei?: boolean;
}

interface Props {
    query: string;
    /** Kode akses yang dikirim (untuk nomor format lama). */
    kode?: string;
    /** Nomor format lama — tamu wajib menyertakan kode akses. */
    butuh_kode?: boolean;
    ticket: TicketData | null | false;
    statuses?: Record<string, string>;
}

export default function Lacak({ query, kode = '', butuh_kode: butuhKode = false, ticket }: Props) {
    const [input, setInput] = useState(query);
    const [kodeInput, setKodeInput] = useState(kode);
    const legacy = isLegacyTicketNo(input);
    const [inputError, setInputError] = useState<string | null>(null);
    const [surveyOpen, setSurveyOpen] = useState(false);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const nomor = normalizeTicketNo(input);
        if (!nomor) return;

        if (!isValidTicketNo(nomor)) {
            setInputError(`Format nomor tiket tidak dikenali. Contoh: ${TICKET_NO_EXAMPLE} (atau format lama TKT-123).`);
            return;
        }

        const code = kodeInput.trim().toUpperCase();
        if (isLegacyTicketNo(nomor) && !code) {
            setInputError('Nomor tiket format lama memerlukan kode akses. Kode tersedia di portal warga atau dapat diminta ke petugas.');
            return;
        }

        setInputError(null);
        router.get(`/lacak/${encodeURIComponent(nomor)}`, isLegacyTicketNo(nomor) ? { kode: code } : {});
    };

    const notFound = ticket === false;
    const data = ticket || null;

    return (
        <PublicLayout title="Lacak Tiket">
            <Head title="Lacak Tiket — SIGAP" />

            <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
                <h1 className="mb-2 text-center text-3xl font-bold text-gray-800">Lacak Status Laporan</h1>
                <p className="mb-8 text-center text-gray-500">Masukkan nomor tiket yang Anda terima (contoh: {TICKET_NO_EXAMPLE}).</p>

                <form onSubmit={submit} className="mx-auto mb-10 max-w-xl" noValidate>
                    <div className="flex gap-2">
                        <div className="relative flex-grow">
                            <Ticket className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="TKT-YYMMDD-XXXXXX"
                                aria-label="Nomor tiket"
                                aria-invalid={inputError ? true : undefined}
                                autoCapitalize="characters"
                                maxLength={32}
                                className="pl-9 uppercase placeholder:normal-case"
                            />
                        </div>
                        <Button type="submit">
                            <Search className="h-4 w-4" /> Cari
                        </Button>
                    </div>
                    {legacy && (
                        <div className="mt-3">
                            <label htmlFor="kode-akses" className="mb-1 block text-xs font-bold text-gray-600">
                                Kode akses
                            </label>
                            <Input
                                id="kode-akses"
                                value={kodeInput}
                                onChange={(e) => setKodeInput(e.target.value)}
                                placeholder="8 karakter, mis. 7KQ4MZ2P"
                                autoCapitalize="characters"
                                autoComplete="off"
                                maxLength={16}
                                className="font-mono uppercase placeholder:normal-case"
                            />
                            <p className="mt-1 text-[11px] text-gray-400">
                                Nomor format lama memerlukan kode akses. Lihat di portal warga (jika laporan dibuat dengan akun) atau minta ke
                                petugas.
                            </p>
                        </div>
                    )}
                    {inputError && (
                        <p role="alert" className="mt-2 text-xs font-semibold text-rose-500">
                            {inputError}
                        </p>
                    )}
                </form>

                {notFound && (
                    <Card className="mx-auto max-w-xl border-rose-100">
                        <CardContent className="flex flex-col items-center p-8 text-center">
                            <XCircle className="mb-3 h-12 w-12 text-rose-500" />
                            <h2 className="mb-1 text-lg font-bold text-gray-800">Tiket Tidak Ditemukan</h2>
                            <p className="text-sm text-gray-500">
                                Nomor <strong>{query}</strong> tidak ditemukan atau merupakan tiket internal yang tidak dapat diakses publik.
                            </p>
                            {butuhKode && (
                                <p className="mt-2 text-sm text-gray-500">Untuk nomor format lama, pastikan kode akses yang Anda masukkan benar.</p>
                            )}
                        </CardContent>
                    </Card>
                )}

                {data && (
                    <div className="space-y-6">
                        <Card className="border-gray-100">
                            <CardContent className="p-6">
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm text-gray-400">Status Laporan Anda</p>
                                        <h2 className="text-primary text-2xl font-bold">#{data.nomor}</h2>
                                    </div>
                                    <span className={`rounded-full px-4 py-1.5 text-sm font-bold ${statusClass(data.status)}`}>
                                        {statusLabel(data.status)}
                                    </span>
                                </div>
                                <Separator className="my-4" />
                                <h3 className="mb-1 font-bold text-gray-800">{data.judul}</h3>
                                <p className="text-sm text-gray-600">{data.deskripsi}</p>

                                <div className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase">Kategori</p>
                                        <p className="text-gray-700">{data.kategori ?? '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase">Kawasan</p>
                                        <p className="text-gray-700">{data.kawasan ?? '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase">Diajukan</p>
                                        <p className="text-gray-700">{formatDateTime(data.created_at)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase">Tenggat SLA</p>
                                        <p className="text-gray-700">{formatDateTime(data.tenggat_sla)}</p>
                                    </div>
                                    {data.pelapor && (
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase">Pelapor</p>
                                            <p className="text-gray-700">{data.pelapor}</p>
                                        </div>
                                    )}
                                    {/* NIK tidak pernah dikirim ke jalur publik (selalu null) — tidak ditampilkan. */}
                                    {data.petugas && (
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase">Petugas</p>
                                            <p className="text-gray-700">{data.petugas}</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {data.riwayat?.length > 0 && (
                            <Card className="border-gray-100">
                                <CardContent className="p-6">
                                    <h3 className="mb-4 font-bold text-gray-800">Riwayat Penanganan</h3>
                                    <ol className="border-brand-soft relative space-y-6 border-l-2 pl-6">
                                        {data.riwayat.map((h, idx) => (
                                            <li key={idx} className="relative">
                                                <CircleDot className="text-primary absolute top-0 -left-[31px] h-5 w-5 bg-white" />
                                                <p className="font-semibold text-gray-800">{statusLabel(h.ke)}</p>
                                                <p className="text-xs text-gray-400">{formatDateTime(h.pada)}</p>
                                            </li>
                                        ))}
                                    </ol>
                                </CardContent>
                            </Card>
                        )}

                        {data.tanggapan?.length > 0 && (
                            <Card className="border-gray-100">
                                <CardContent className="p-6">
                                    <h3 className="mb-4 font-bold text-gray-800">Tanggapan Petugas</h3>
                                    <div className="space-y-4">
                                        {data.tanggapan.map((r) => (
                                            <div key={r.id} className="border-brand-light bg-brand-soft/50 rounded-lg border-l-4 p-4">
                                                <p className="text-primary mb-1 text-xs font-bold">{r.author ?? 'Petugas SIGAP'}</p>
                                                <p className="text-sm text-gray-700">{r.body}</p>
                                                <p className="mt-1 text-xs text-gray-400">{formatDateTime(r.created_at)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {data.status === 'selesai' && (
                            <Card className="border-emerald-100">
                                <CardContent className="flex flex-col items-center p-6 text-center">
                                    <CheckCircle2 className="mb-2 h-10 w-10 text-emerald-500" />
                                    <h3 className="font-bold text-gray-800">Laporan Selesai Ditangani</h3>
                                    <p className="mb-4 text-sm text-gray-500">Aduan Anda telah diselesaikan. Terima kasih telah membantu kami.</p>
                                    {data.sudah_disurvei ? (
                                        <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
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

            {surveyOpen && data && <SurveyModal ticket={data.nomor} kode={kode} onClose={() => setSurveyOpen(false)} />}
        </PublicLayout>
    );
}

function SurveyModal({ ticket, kode, onClose }: { ticket: string; kode: string; onClose: () => void }) {
    const form = useForm({ ticket, kode, rating: 0, comment: '', recaptcha_token: '' });
    const recaptcha = useRecaptcha('survei');

    const submit = (e: FormEvent) => {
        e.preventDefault();
        void recaptcha.withToken((token) => {
            form.transform((d) => ({ ...d, recaptcha_token: token }));
            form.post('/lacak/survei', {
                preserveScroll: true,
                onSuccess: () => onClose(),
            });
        });
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="survey-title"
        >
            <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-500 shadow-sm">
                    <Star className="h-7 w-7" />
                </div>
                <h2 id="survey-title" className="mb-2 text-2xl font-bold text-gray-800">
                    Survei Kepuasan
                </h2>
                <p className="mb-6 text-sm leading-relaxed text-gray-500">Bagaimana pengalaman Anda menggunakan layanan SIGAP?</p>

                <div className="mb-6 flex justify-center gap-2" role="radiogroup" aria-label="Penilaian 1 sampai 5 bintang">
                    {[1, 2, 3, 4, 5].map((n) => (
                        <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={form.data.rating === n}
                            aria-label={`${n} bintang`}
                            onClick={() => form.setData('rating', n)}
                            className={cn('transition-colors', n <= form.data.rating ? 'text-secondary' : 'text-gray-300')}
                        >
                            <Star className={cn('h-8 w-8', n <= form.data.rating && 'fill-current')} />
                        </button>
                    ))}
                </div>
                {form.errors.rating && <p className="mb-3 text-xs font-semibold text-rose-500">{form.errors.rating}</p>}
                {form.errors.ticket && (
                    <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-600">
                        {form.errors.ticket}
                    </p>
                )}
                {form.errors.comment && <p className="mb-3 text-xs font-semibold text-rose-500">{form.errors.comment}</p>}

                <Textarea
                    value={form.data.comment}
                    onChange={(e) => form.setData('comment', e.target.value)}
                    rows={3}
                    placeholder="Komentar tambahan (opsional)"
                    className="mb-4"
                />

                <div className="mb-4 text-left">
                    <RecaptchaNotice enabled={recaptcha.enabled} error={recaptcha.error ?? form.errors.recaptcha_token} />
                </div>

                <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={onClose} className="w-1/3">
                        Nanti
                    </Button>
                    <Button
                        type="submit"
                        disabled={form.processing || recaptcha.verifying || form.data.rating === 0}
                        className="w-2/3 bg-green-500 hover:bg-green-600"
                    >
                        Kirim Penilaian
                    </Button>
                </div>
            </form>
        </div>
    );
}
