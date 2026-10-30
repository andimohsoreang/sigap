import { router, useForm } from '@inertiajs/react';
import { ArrowRight, Check, CheckCircle2, MessageCircle, RotateCcw, Search, SearchX, Send, Star, Ticket, X } from 'lucide-react';
import { type FormEvent, useRef, useState } from 'react';

import { RecaptchaNotice } from '@/components/sigap/recaptcha-notice';
import TaraPage, { TaraAvatar, TaraPoseImage } from '@/components/sigap/tara-shell';
import { useRecaptcha } from '@/hooks/use-recaptcha';
import { goToChat } from '@/lib/chat-transition';
import { formatDateTime, isLegacyTicketNo, isValidTicketNo, normalizeTicketNo, statusLabel, TICKET_NO_EXAMPLE } from '@/lib/sigap';
import { cn } from '@/lib/utils';

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

const STEPS = ['baru', 'verifikasi', 'diproses', 'selesai'] as const;

const PILL: Record<string, string> = {
    baru: 'bg-[#e8f1fa] text-[#0b5fa5]',
    verifikasi: 'bg-[#e8f0f7] text-[#003d68]',
    diproses: 'bg-[#fdf3e1] text-[#9a5b00]',
    selesai: 'bg-[#e7f4ef] text-[#0d7a5f]',
    ditolak: 'bg-[#fdecea] text-[#b42318]',
};

const RATING_LABEL = ['', 'Sangat tidak puas', 'Kurang puas', 'Cukup', 'Puas', 'Sangat puas'];

export default function Lacak({ query, kode = '', butuh_kode: butuhKode = false, ticket }: Props) {
    const [input, setInput] = useState(query);
    const [kodeInput, setKodeInput] = useState(kode);
    const legacy = isLegacyTicketNo(input);
    const [inputError, setInputError] = useState<string | null>(null);
    const [surveyOpen, setSurveyOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

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

    const searchForm = (
        <form onSubmit={submit} className="max-w-[720px]" noValidate>
            <div className="flex flex-col gap-3 sm:flex-row">
                <label className="relative flex h-14 flex-1 items-center rounded-full border border-[#e6ded1] bg-white shadow-[0_8px_24px_rgba(2,43,74,0.06)] focus-within:border-[var(--t-navy)]">
                    <Ticket className="absolute left-5 h-5 w-5 text-[#8a96a3]" aria-hidden="true" />
                    <span className="sr-only">Nomor tiket</span>
                    <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="TKT-YYMMDD-XXXXXX"
                        aria-invalid={inputError ? true : undefined}
                        autoCapitalize="characters"
                        maxLength={32}
                        className="h-full w-full rounded-full bg-transparent pr-5 pl-13 font-mono text-[17px] font-semibold tracking-wide text-[var(--t-deep)] uppercase outline-none placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:normal-case"
                    />
                </label>
                <button
                    type="submit"
                    className="transi-lift flex h-14 items-center justify-center gap-2 rounded-full bg-[var(--t-navy)] px-8 font-semibold text-white hover:bg-[#00508a]"
                >
                    <Search className="h-5 w-5" aria-hidden="true" /> Cari
                </button>
            </div>
            {legacy && (
                <div className="mt-4 max-w-[420px]">
                    <label htmlFor="kode-akses" className="mb-1.5 block text-sm font-semibold text-[#4b3f30]">
                        Kode akses
                    </label>
                    <input
                        id="kode-akses"
                        value={kodeInput}
                        onChange={(e) => setKodeInput(e.target.value)}
                        placeholder="8 karakter, mis. 7KQ4MZ2P"
                        autoCapitalize="characters"
                        autoComplete="off"
                        maxLength={16}
                        className="h-12 w-full rounded-xl border border-[#e6ded1] bg-white px-4 font-mono uppercase outline-none placeholder:font-sans placeholder:normal-case focus:border-[var(--t-navy)]"
                    />
                    <p className="mt-1.5 text-xs text-[#6b5d4a]">
                        Nomor format lama memerlukan kode akses. Lihat di portal warga (jika laporan dibuat dengan akun) atau minta ke petugas.
                    </p>
                </div>
            )}
            {inputError ? (
                <p role="alert" className="mt-3 text-sm font-semibold text-[#b42318]">
                    {inputError}
                </p>
            ) : (
                !data &&
                !notFound && <p className="mt-3 text-sm text-[#6b5d4a]">Masukkan nomor tiket lalu tekan Cari untuk melihat status laporan Anda.</p>
            )}
        </form>
    );

    return (
        <TaraPage
            title="Lacak Tiket"
            description="Lacak status laporan Anda di Contact Center dengan nomor tiket."
            active="lacak"
            eyebrow="Lacak Tiket"
            heading="Lacak Status Laporan"
            subtitle={<>Masukkan nomor tiket yang Anda terima (contoh: {TICKET_NO_EXAMPLE}).</>}
            pose="tablet"
            poseAlt="TARA memegang tablet untuk mengecek status tiket"
            heroChildren={searchForm}
        >
            <div className="mx-auto max-w-[1312px] px-4 py-14 sm:px-6 lg:px-16 lg:py-16">
                {notFound && (
                    <section className="mx-auto flex max-w-[820px] flex-col items-center gap-6 rounded-[24px] border border-[#e6ebf0] bg-white p-7 text-center sm:flex-row sm:items-center sm:gap-10 sm:p-10 sm:text-left">
                        <TaraPoseImage pose="menjelaskan" className="h-[220px] w-auto shrink-0 sm:h-[260px]" />
                        <div className="min-w-0">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fdecea] px-3 py-1 text-[13px] font-semibold text-[#b42318]">
                                <SearchX className="h-3.5 w-3.5" aria-hidden="true" /> Tidak ditemukan
                            </span>
                            <h2 className="font-heading mt-3 text-[28px] font-bold text-[var(--t-deep)]">Tiket Tidak Ditemukan</h2>
                            <p className="mt-3 text-base leading-relaxed text-[#4a5868]">
                                Nomor <strong className="text-[var(--t-deep)]">{query}</strong> tidak ditemukan atau merupakan tiket internal yang
                                tidak dapat diakses publik.
                            </p>
                            {butuhKode && (
                                <p className="mt-2 text-sm text-[#4a5868]">Untuk nomor format lama, pastikan kode akses yang Anda masukkan benar.</p>
                            )}
                            <div className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start">
                                <button
                                    type="button"
                                    onClick={(e) => goToChat({ source: e.currentTarget })}
                                    className="transi-lift flex h-12 items-center gap-2 rounded-full bg-[var(--t-gold)] px-6 font-semibold text-[var(--t-deep)] hover:bg-[#d0a552]"
                                >
                                    <MessageCircle className="h-5 w-5" aria-hidden="true" /> Tanya TARA
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                        inputRef.current?.focus();
                                        inputRef.current?.select();
                                    }}
                                    className="flex h-12 items-center gap-2 rounded-full border-[1.5px] border-[var(--t-navy)] px-6 font-semibold text-[var(--t-navy)] hover:bg-[#f2f5f8]"
                                >
                                    <RotateCcw className="h-[18px] w-[18px]" aria-hidden="true" /> Periksa ulang nomor
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {data && (
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
                        <StatusCard data={data} onSurvey={() => setSurveyOpen(true)} />
                        <div className="flex flex-col gap-5">
                            <History data={data} />
                            <button
                                type="button"
                                onClick={(e) => goToChat({ source: e.currentTarget })}
                                className="transi-lift flex items-center gap-4 rounded-[20px] bg-[var(--t-deep)] p-5 text-left text-white"
                            >
                                <TaraAvatar className="h-14 w-14" />
                                <span>
                                    <span className="font-heading block text-lg font-bold">Ada pertanyaan soal tiket ini?</span>
                                    <span className="mt-0.5 flex items-center gap-1.5 font-semibold text-[var(--t-gold)]">
                                        Tanya TARA <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                    </span>
                                </span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {surveyOpen && data && <SurveyModal ticket={data.nomor} kode={kode} onClose={() => setSurveyOpen(false)} />}
        </TaraPage>
    );
}

function StatusCard({ data, onSurvey }: { data: TicketData; onSurvey: () => void }) {
    const rejected = data.status === 'ditolak';
    const current = rejected ? 2 : Math.max(0, STEPS.indexOf(data.status as (typeof STEPS)[number]));
    const meta: [string, string][] = [
        ['Kategori', data.kategori ?? '—'],
        ['Kawasan', data.kawasan ?? '—'],
        ['Diajukan', formatDateTime(data.created_at)],
        ['Tenggat SLA', formatDateTime(data.tenggat_sla)],
        ...(data.pelapor ? ([['Pelapor', data.pelapor]] as [string, string][]) : []),
        ...(data.petugas ? ([['Petugas', data.petugas]] as [string, string][]) : []),
    ];

    return (
        <section className="flex flex-col gap-6 rounded-[24px] border border-[#e6ebf0] bg-white p-6 shadow-[0_10px_30px_rgba(2,43,74,0.04)] sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-sm text-[#5b6b7a]">Status Laporan Anda</p>
                    <h2 className="mt-1 font-mono text-[24px] font-semibold text-[var(--t-navy)] sm:text-[26px]">#{data.nomor}</h2>
                </div>
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold', PILL[data.status] ?? PILL.baru)}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                    {statusLabel(data.status)}
                </span>
            </div>

            <ol className="flex flex-wrap items-center gap-x-3 gap-y-3 rounded-2xl bg-[#f4f6f9] px-5 py-4" aria-label="Tahapan penanganan">
                {STEPS.map((s, i) => {
                    const isLast = i === STEPS.length - 1;
                    const label = rejected && isLast ? 'Ditolak' : statusLabel(s);
                    const done = i < current || (!rejected && data.status === 'selesai');
                    const now = i === current && data.status !== 'selesai' && !(rejected && isLast);
                    const failed = rejected && isLast;
                    return (
                        <li key={s} className="flex min-w-0 flex-1 items-center gap-2.5" aria-current={now ? 'step' : undefined}>
                            <span
                                className={cn(
                                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                                    done && 'border-[#0d7a5f] bg-[#0d7a5f] text-white',
                                    now && 'border-[var(--t-gold)] bg-[var(--t-gold)]',
                                    failed && 'border-[#b42318] bg-[#b42318] text-white',
                                    !done && !now && !failed && 'border-[#cdd6df] bg-white',
                                )}
                            >
                                {done && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                                {now && <span className="h-2 w-2 rounded-full bg-[var(--t-deep)]" />}
                                {failed && <X className="h-3.5 w-3.5" aria-hidden="true" />}
                            </span>
                            <span
                                className={cn(
                                    'text-[15px] whitespace-nowrap',
                                    done || now || failed ? 'font-semibold text-[var(--t-deep)]' : 'text-[#8a96a3]',
                                )}
                            >
                                {label}
                            </span>
                            {!isLast && (
                                <span
                                    className={cn('hidden h-0.5 flex-1 rounded sm:block', done ? 'bg-[#0d7a5f]' : 'bg-[#d8dee5]')}
                                    aria-hidden="true"
                                />
                            )}
                        </li>
                    );
                })}
            </ol>

            <div>
                <h3 className="font-heading text-[22px] font-bold text-[var(--t-deep)]">{data.judul}</h3>
                <p className="mt-2 text-[15.5px] leading-relaxed whitespace-pre-line text-[#4a5868]">{data.deskripsi}</p>
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-[#e6ebf0] pt-5 sm:grid-cols-4">
                {meta.map(([k, v]) => (
                    <div key={k}>
                        <dt className="text-xs font-semibold tracking-[0.1em] text-[#8a96a3] uppercase">{k}</dt>
                        <dd className="mt-1 text-[15.5px] font-medium text-[var(--t-deep)]">{v}</dd>
                    </div>
                ))}
            </dl>

            {data.status === 'selesai' && (
                <div className="flex flex-col gap-4 rounded-2xl bg-[#f4f6f9] p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <Star className="mt-0.5 h-5 w-5 shrink-0 text-[var(--t-gold)]" aria-hidden="true" />
                        <div>
                            <p className="font-semibold text-[var(--t-deep)]">Laporan Anda sudah selesai ditangani.</p>
                            <p className="text-sm text-[#4a5868]">Bantu kami menilai mutu layanan di kawasan Anda.</p>
                        </div>
                    </div>
                    {data.sudah_disurvei ? (
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-[#0d7a5f]">
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Survei sudah Anda kirim
                        </p>
                    ) : (
                        <button
                            type="button"
                            onClick={onSurvey}
                            className="transi-lift h-12 shrink-0 rounded-full bg-[var(--t-navy)] px-6 font-semibold text-white hover:bg-[#00508a]"
                        >
                            Isi Survei Kepuasan
                        </button>
                    )}
                </div>
            )}
        </section>
    );
}

/** Riwayat status + tanggapan petugas dalam satu linimasa, terbaru di atas. */
function History({ data }: { data: TicketData }) {
    type Item = { key: string; at: number; status?: string; reply?: TicketData['tanggapan'][number]; pada: string | null };
    const items: Item[] = [
        ...(data.riwayat ?? []).map((h, i) => ({ key: `s${i}`, at: h.pada ? Date.parse(h.pada) : 0, status: h.ke, pada: h.pada })),
        ...(data.tanggapan ?? []).map((r) => ({ key: `r${r.id}`, at: r.created_at ? Date.parse(r.created_at) : 0, reply: r, pada: r.created_at })),
    ].sort((a, b) => b.at - a.at);

    if (items.length === 0) return null;

    return (
        <section className="rounded-[24px] border border-[#e6ebf0] bg-white p-6 sm:p-7">
            <h2 className="font-heading text-xl font-bold text-[var(--t-deep)]">Riwayat Penanganan</h2>
            <ol className="relative mt-5 flex flex-col gap-6 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-[#e3e8ee]">
                {items.map((it, idx) => (
                    <li key={it.key} className="relative flex gap-4">
                        <span
                            className={cn(
                                'relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-white',
                                idx === 0 ? 'border-[var(--t-gold)]' : 'border-[#0d7a5f]',
                            )}
                            aria-hidden="true"
                        >
                            <span className={cn('h-2 w-2 rounded-full', idx === 0 ? 'bg-[var(--t-deep)]' : 'bg-[#0d7a5f]')} />
                        </span>
                        <div className="min-w-0 flex-1">
                            {it.reply ? (
                                <div className="rounded-xl bg-[#f7f3ee] p-4">
                                    <p className="text-[13px] font-semibold text-[#9a7330]">Tanggapan {it.reply.author ?? 'petugas'}</p>
                                    <p className="mt-1.5 text-[15px] leading-relaxed whitespace-pre-line text-[#22313f]">{it.reply.body}</p>
                                    <p className="mt-2 text-[13px] text-[#8a96a3]">{formatDateTime(it.pada)}</p>
                                </div>
                            ) : (
                                <>
                                    <p className="font-semibold text-[var(--t-deep)]">{statusLabel(it.status ?? '')}</p>
                                    <p className="text-[13px] text-[#8a96a3]">{formatDateTime(it.pada)}</p>
                                </>
                            )}
                        </div>
                    </li>
                ))}
            </ol>
        </section>
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
            className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0b1c2c]/55 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="survey-title"
        >
            <form onSubmit={submit} className="w-full max-w-[500px] rounded-[24px] bg-white p-6 shadow-2xl sm:p-8">
                <div className="flex items-start gap-4">
                    <TaraAvatar className="h-[52px] w-[52px]" />
                    <div className="min-w-0 flex-1">
                        <h2 id="survey-title" className="font-heading text-[22px] font-bold text-[var(--t-deep)]">
                            Survei Kepuasan
                        </h2>
                        <p className="mt-1 text-[15px] text-[#4a5868]">Seberapa puas Anda dengan penanganan tiket {ticket}?</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f2f5f8] text-[#4a5868] hover:bg-[#e6ebf0]"
                        aria-label="Tutup survei"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="mt-6 rounded-2xl bg-[#f4f6f9] px-4 py-5 text-center">
                    <div className="flex justify-center gap-2" role="radiogroup" aria-label="Penilaian 1 sampai 5 bintang">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <button
                                key={n}
                                type="button"
                                role="radio"
                                aria-checked={form.data.rating === n}
                                aria-label={`${n} bintang`}
                                onClick={() => form.setData('rating', n)}
                                className={cn(
                                    'transition-transform hover:scale-110',
                                    n <= form.data.rating ? 'text-[var(--t-gold)]' : 'text-[#cdd6df]',
                                )}
                            >
                                <Star className={cn('h-9 w-9', n <= form.data.rating && 'fill-current')} />
                            </button>
                        ))}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#9a7330]">
                        {form.data.rating > 0 ? `${form.data.rating} dari 5 · ${RATING_LABEL[form.data.rating]}` : 'Pilih jumlah bintang'}
                    </p>
                </div>
                {form.errors.rating && <p className="mt-2 text-sm font-semibold text-[#b42318]">{form.errors.rating}</p>}
                {form.errors.ticket && (
                    <p role="alert" className="mt-3 rounded-lg bg-[#fdecea] p-3 text-sm font-semibold text-[#b42318]">
                        {form.errors.ticket}
                    </p>
                )}

                <label htmlFor="komentar-survei" className="mt-5 block text-sm font-semibold text-[var(--t-deep)]">
                    Komentar (opsional)
                </label>
                <textarea
                    id="komentar-survei"
                    value={form.data.comment}
                    onChange={(e) => form.setData('comment', e.target.value)}
                    rows={3}
                    placeholder="Ceritakan pengalaman Anda"
                    className="mt-1.5 w-full rounded-xl border border-[#dfe5eb] px-4 py-3 text-[15px] outline-none focus:border-[var(--t-navy)]"
                />
                {form.errors.comment && <p className="mt-1 text-sm font-semibold text-[#b42318]">{form.errors.comment}</p>}

                <div className="mt-3">
                    <RecaptchaNotice enabled={recaptcha.enabled} error={recaptcha.error ?? form.errors.recaptcha_token} />
                </div>

                <div className="mt-5 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-12 rounded-full border-[1.5px] border-[var(--t-navy)] px-5 font-semibold text-[var(--t-navy)] hover:bg-[#f2f5f8]"
                    >
                        Nanti saja
                    </button>
                    <button
                        type="submit"
                        disabled={form.processing || recaptcha.verifying || form.data.rating === 0}
                        className="flex h-12 items-center gap-2 rounded-full bg-[var(--t-gold)] px-6 font-semibold text-[var(--t-deep)] hover:bg-[#d0a552] disabled:opacity-50"
                    >
                        <Send className="h-[18px] w-[18px]" aria-hidden="true" /> Kirim Penilaian
                    </button>
                </div>
            </form>
        </div>
    );
}
