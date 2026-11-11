import { Link, useForm } from '@inertiajs/react';
import { CheckCircle2, Clock, LogIn, RotateCcw, Send, ShieldCheck } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useRef } from 'react';

import { RecaptchaNotice } from '@/components/sigap/recaptcha-notice';
import {
    cardClass,
    ErrorSummary,
    ErrorText,
    Field,
    outlineButtonClass,
    primaryButtonClass,
    FormSection as Section,
    SubmitButton,
    textareaClass,
    triggerClass,
} from '@/components/sigap/tara-form';
import TaraPage from '@/components/sigap/tara-shell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRecaptcha } from '@/hooks/use-recaptcha';
import { formatDateTime } from '@/lib/sigap';
import { cn } from '@/lib/utils';

/**
 * Survei Kepuasan Pasca-Penanganan Pengaduan (skala 1–4, Permenpan RB 14/2017).
 * Teks pertanyaan datang dari server (App\Support\SurveyQuestionnaire).
 */

interface Choice<T extends string | number = number> {
    value: T;
    label: string;
}

interface Kuesioner {
    aspek: { key: string; aspek: string; pertanyaan: string; pilihan: Choice[] }[];
    keseluruhan: { pertanyaan: string; pilihan: Choice[] };
    teratasi: { pertanyaan: string; pilihan: Choice<string>[] };
    kembali: { pertanyaan: string; pilihan: Choice[] };
    terbuka: { key: 'good_feedback' | 'improve_feedback'; pertanyaan: string }[];
    profil: { key: 'age_group' | 'education' | 'occupation'; label: string; pilihan: Choice<string>[] }[];
}

interface Props {
    tiket: {
        nomor: string;
        judul: string;
        kategori: string | null;
        kanal: string | null;
        unit: string | null;
        masuk: string | null;
        selesai: string | null;
        status: string;
    };
    kode: string | null;
    sudah_disurvei: boolean;
    boleh_isi: boolean;
    kuesioner: Kuesioner;
}

const UNRESOLVED = ['belum', 'sebagian'];
const OPEN_FIELD = { good_feedback: 'baik', improve_feedback: 'perbaikan' } as const;
const PROFILE_FIELD = { age_group: 'usia', education: 'pendidikan', occupation: 'pekerjaan' } as const;

export default function Survei({ tiket, kode, sudah_disurvei: sudahDisurvei, boleh_isi: bolehIsi, kuesioner }: Props) {
    const lacakHref = `/lacak/${tiket.nomor}${kode ? `?kode=${encodeURIComponent(kode)}` : ''}`;
    const selesai = tiket.status === 'selesai';

    return (
        <TaraPage
            title="Survei Kepuasan"
            description="Survei kepuasan pasca-penanganan pengaduan Contact Center Kementerian Transmigrasi."
            active="lacak"
            breadcrumb={[{ label: 'Beranda', href: '/' }, { label: 'Lacak Tiket', href: lacakHref }, { label: 'Survei Kepuasan' }]}
            eyebrow="Survei Kepuasan"
            heading="Bantu kami menilai layanan"
            subtitle={
                <>
                    Terima kasih telah menghubungi Contact Center Kementerian Transmigrasi. Pengaduan Anda dengan nomor tiket{' '}
                    <strong>{tiket.nomor}</strong> telah selesai ditangani. Jawaban Anda tidak memengaruhi hasil penanganan pengaduan dan hanya
                    dipakai untuk perbaikan layanan.
                </>
            }
            pose="tablet"
            poseAlt="TARA meminta penilaian Anda"
            compact
        >
            <div className="mx-auto grid max-w-[1312px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 lg:px-16 lg:py-14">
                <div className="min-w-0">
                    {!selesai ? (
                        <Notice icon={Clock} title="Survei belum dibuka">
                            Survei kepuasan dibuka setelah pengaduan Anda dinyatakan selesai. Pantau perkembangannya di halaman Lacak Tiket.
                        </Notice>
                    ) : sudahDisurvei ? (
                        <Notice icon={CheckCircle2} title="Survei sudah Anda kirim">
                            Terima kasih, penilaian untuk tiket ini sudah kami terima. Satu tiket hanya dapat dinilai satu kali.
                        </Notice>
                    ) : !bolehIsi ? (
                        <Notice icon={LogIn} title="Masuk untuk mengisi survei" action={{ href: '/masuk', label: 'Masuk dengan NIK' }}>
                            Tiket ini terhubung ke akun warga. Agar penilaian benar-benar dari pelapor, silakan masuk dengan akun tersebut; Anda akan
                            dikembalikan ke halaman ini.
                        </Notice>
                    ) : (
                        <SurveyForm tiket={tiket} kode={kode} kuesioner={kuesioner} />
                    )}
                    {(!selesai || sudahDisurvei || !bolehIsi) && (
                        <Link href={lacakHref} className={cn(outlineButtonClass, 'mt-6')}>
                            Kembali ke Lacak Tiket
                        </Link>
                    )}
                </div>

                <aside className="flex flex-col gap-5">
                    <section className={cn(cardClass, 'p-6')}>
                        <h2 className="font-heading text-lg font-bold text-[var(--tcd-heading,var(--t-deep))]">Pengaduan yang dinilai</h2>
                        <dl className="mt-4 space-y-3 text-sm">
                            <Row label="Nomor tiket">
                                <span className="font-mono font-semibold">{tiket.nomor}</span>
                            </Row>
                            <Row label="Judul">{tiket.judul}</Row>
                            {tiket.kategori && <Row label="Kategori">{tiket.kategori}</Row>}
                            {tiket.unit && <Row label="Unit penanggung jawab">{tiket.unit}</Row>}
                            <Row label="Tanggal masuk">{formatDateTime(tiket.masuk)}</Row>
                            {tiket.selesai && <Row label="Tanggal selesai">{formatDateTime(tiket.selesai)}</Row>}
                        </dl>
                    </section>
                    <section className={cn(cardClass, 'flex gap-3 p-6 text-sm text-[var(--tcd-text-2,#4a5868)]')}>
                        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--tcd-link,var(--t-navy))]" aria-hidden="true" />
                        <p>
                            Pengisian kurang dari 2 menit. Jawaban dipakai untuk mengukur dan memperbaiki mutu layanan pengaduan, hanya dapat dibuka
                            petugas yang berwenang, dan tidak memengaruhi penanganan pengaduan Anda.
                        </p>
                    </section>
                </aside>
            </div>
        </TaraPage>
    );
}

function SurveyForm({ tiket, kode, kuesioner }: Pick<Props, 'tiket' | 'kode' | 'kuesioner'>) {
    const recaptcha = useRecaptcha('survei');
    const form = useForm({
        ticket: tiket.nomor,
        kode: kode ?? '',
        jawaban: Object.fromEntries(kuesioner.aspek.map((q) => [q.key, 0])) as Record<string, number>,
        keseluruhan: 0,
        teratasi: '',
        kembali: 0,
        tinjau_ulang: false as boolean,
        baik: '',
        perbaikan: '',
        usia: '',
        pendidikan: '',
        pekerjaan: '',
        recaptcha_token: '',
    });
    const errors = form.errors as Partial<Record<string, string>>;

    // Ringkasan galat baru ada setelah galat dirender; fokus dipindah ke sana sekali per kiriman.
    const focusSummary = useRef(false);
    useEffect(() => {
        if (focusSummary.current && Object.keys(form.errors).length > 0) {
            focusSummary.current = false;
            document.getElementById('ringkasan-galat')?.focus();
        }
    }, [form.errors]);
    const number = (n: number) => n + kuesioner.aspek.length;
    const unresolved = UNRESOLVED.includes(form.data.teratasi);

    const order: [string, string][] = [
        ...kuesioner.aspek.map((q, i): [string, string] => [`jawaban.${q.key}`, `${i + 1}. ${q.aspek}`]),
        ['keseluruhan', `${number(1)}. Kepuasan keseluruhan`],
        ['teratasi', `${number(2)}. Masalah teratasi`],
        ['kembali', `${number(3)}. Menggunakan kembali`],
    ];

    const submit = (e: FormEvent) => {
        e.preventDefault();
        void recaptcha.withToken((token) => {
            // Pertanyaan yang belum dijawab dikirim kosong (bukan 0) agar pesan galatnya "pilih satu jawaban".
            const answered = (n: number) => (n > 0 ? n : null);
            form.transform((d) => ({
                ...d,
                jawaban: Object.fromEntries(Object.entries(d.jawaban).map(([k, v]) => [k, answered(v)])),
                keseluruhan: answered(d.keseluruhan),
                kembali: answered(d.kembali),
                tinjau_ulang: UNRESOLVED.includes(d.teratasi) && d.tinjau_ulang,
                recaptcha_token: token,
            }));
            form.post('/lacak/survei', {
                preserveScroll: true,
                onError: () => {
                    focusSummary.current = true;
                },
            });
        });
    };

    return (
        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
            <ErrorSummary errors={errors} order={order} />
            {errors.ticket && (
                <p role="alert" className="rounded-[20px] bg-[var(--tcd-danger-soft,#fdecea)] p-5 font-semibold text-[var(--tcd-danger,#b42318)]">
                    {errors.ticket}
                </p>
            )}

            <Section step={1} title="Penilaian penanganan pengaduan" desc="Pilih satu jawaban untuk setiap pertanyaan.">
                {kuesioner.aspek.map((q, i) => (
                    <Choices
                        key={q.key}
                        id={`jawaban-${q.key}`}
                        number={i + 1}
                        hint={q.aspek}
                        question={q.pertanyaan}
                        choices={q.pilihan}
                        value={form.data.jawaban[q.key]}
                        onChange={(v) => form.setData('jawaban', { ...form.data.jawaban, [q.key]: v })}
                        error={errors[`jawaban.${q.key}`]}
                    />
                ))}
            </Section>

            <Section step={2} title="Penilaian keseluruhan" desc="Bagaimana hasil penanganan pengaduan ini bagi Anda?">
                <Choices
                    id="keseluruhan"
                    number={number(1)}
                    question={kuesioner.keseluruhan.pertanyaan}
                    choices={kuesioner.keseluruhan.pilihan}
                    value={form.data.keseluruhan}
                    onChange={(v) => form.setData('keseluruhan', v)}
                    error={errors.keseluruhan}
                />
                <Choices
                    id="teratasi"
                    number={number(2)}
                    question={kuesioner.teratasi.pertanyaan}
                    choices={kuesioner.teratasi.pilihan}
                    value={form.data.teratasi}
                    onChange={(v) => form.setData('teratasi', v)}
                    error={errors.teratasi}
                    columns={3}
                />
                {unresolved && (
                    <label
                        className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] p-4 transition-colors has-[input:focus-visible]:ring-4 has-[input:focus-visible]:ring-[#003d68]/15',
                            form.data.tinjau_ulang
                                ? 'border-[var(--tcd-link,var(--t-navy))] bg-[var(--tcd-info-soft,#e8f1fa)]'
                                : 'border-[var(--tcd-border-strong,#d9dfe6)] bg-[var(--tcd-cream,#f7f3ee)]',
                        )}
                    >
                        <input
                            type="checkbox"
                            checked={form.data.tinjau_ulang}
                            onChange={(e) => form.setData('tinjau_ulang', e.target.checked)}
                            className="mt-1 h-5 w-5 shrink-0 accent-[var(--tcd-link,#003d68)]"
                        />
                        <span>
                            <span className="flex items-center gap-2 font-semibold text-[var(--tcd-heading,var(--t-deep))]">
                                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Ajukan tinjau ulang pengaduan
                            </span>
                            <span className="mt-1 block text-sm text-[var(--tcd-text-2,#4a5868)]">
                                Tiket akan ditandai untuk ditinjau kembali oleh petugas penanggung jawab. Anda menerima kabar lewat surel bila
                                pengaduan dibuka kembali.
                            </span>
                        </span>
                    </label>
                )}
                <Choices
                    id="kembali"
                    number={number(3)}
                    question={kuesioner.kembali.pertanyaan}
                    choices={kuesioner.kembali.pilihan}
                    value={form.data.kembali}
                    onChange={(v) => form.setData('kembali', v)}
                    error={errors.kembali}
                />
            </Section>

            <Section step={3} title="Masukan terbuka" desc="Opsional. Ceritakan dengan bahasa Anda sendiri.">
                {kuesioner.terbuka.map((q, i) => {
                    const field = OPEN_FIELD[q.key];

                    return (
                        <Field key={q.key} label={`${number(4 + i)}. ${q.pertanyaan}`} htmlFor={field} error={errors[field]}>
                            <textarea
                                id={field}
                                value={form.data[field]}
                                onChange={(e) => form.setData(field, e.target.value)}
                                maxLength={1000}
                                className={cn(textareaClass, 'min-h-[110px]')}
                            />
                        </Field>
                    );
                })}
            </Section>

            <Section step={4} title="Tentang Anda" desc="Opsional, boleh dikosongkan. Dipakai untuk analisis survei kepuasan masyarakat.">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    {kuesioner.profil.map((p) => {
                        const field = PROFILE_FIELD[p.key];

                        return (
                            <Field key={p.key} label={p.label} htmlFor={field} error={errors[field]}>
                                <Select value={form.data[field] || undefined} onValueChange={(v) => form.setData(field, v)}>
                                    <SelectTrigger id={field} className={triggerClass} aria-label={p.label}>
                                        <SelectValue placeholder="Pilih (opsional)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {p.pilihan.map((c) => (
                                            <SelectItem key={c.value} value={c.value}>
                                                {c.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        );
                    })}
                </div>
            </Section>

            <section className="flex flex-col gap-4 rounded-[24px] border border-[var(--tcd-border,#e6ebf0)] bg-[var(--tcd-cream,#f7f3ee)] p-6 sm:p-8">
                <RecaptchaNotice enabled={recaptcha.enabled} error={recaptcha.error ?? form.errors.recaptcha_token} />
                <div>
                    <SubmitButton busy={form.processing || recaptcha.verifying} icon={Send}>
                        Kirim Penilaian
                    </SubmitButton>
                </div>
            </section>
        </form>
    );
}

/** Satu pertanyaan pilihan tunggal, ditampilkan sebagai kartu pilihan. */
function Choices<T extends string | number>({
    id,
    number,
    hint,
    question,
    choices,
    value,
    onChange,
    error,
    columns = 4,
}: {
    id: string;
    number: number;
    hint?: string;
    question: string;
    choices: Choice<T>[];
    value: T;
    onChange: (value: T) => void;
    error?: string;
    columns?: 3 | 4;
}) {
    const errorId = `${id}-galat`;

    return (
        <fieldset
            id={id}
            tabIndex={-1}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="outline-none"
        >
            <legend className="text-[15px] font-semibold text-[var(--tcd-heading,var(--t-deep))]">
                {hint && <span className="mb-1 block text-xs font-semibold tracking-wide text-[var(--tcd-bronze,#8b682b)] uppercase">{hint}</span>}
                {number}. {question}
            </legend>
            <div className={cn('mt-3 grid grid-cols-2 gap-2', columns === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3')}>
                {choices.map((c) => {
                    const checked = value === c.value;

                    return (
                        <label
                            key={String(c.value)}
                            className={cn(
                                'flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-[1.5px] px-3 py-2.5 text-center text-sm leading-snug transition-colors has-[input:focus-visible]:ring-4 has-[input:focus-visible]:ring-[#003d68]/15',
                                checked
                                    ? 'border-[var(--tcd-link,var(--t-navy))] bg-[var(--tcd-info-soft,#e8f1fa)] font-semibold text-[var(--tcd-link,var(--t-navy))]'
                                    : 'border-[var(--tcd-border-strong,#d9dfe6)] bg-[var(--tcd-surface,#fff)] text-[var(--tcd-text,#0f2233)] hover:border-[var(--tcd-link,var(--t-navy))]/50',
                                error && !checked && 'border-[var(--tcd-danger-border,#f5c2bd)]',
                            )}
                        >
                            <input type="radio" name={id} className="sr-only" checked={checked} onChange={() => onChange(c.value)} />
                            {c.label}
                        </label>
                    );
                })}
            </div>
            {error && <ErrorText id={errorId}>{error}</ErrorText>}
        </fieldset>
    );
}

function Notice({
    icon: Icon,
    title,
    children,
    action,
}: {
    icon: typeof Clock;
    title: string;
    children: ReactNode;
    action?: { href: string; label: string };
}) {
    return (
        <section className={cn(cardClass, 'flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:p-8')}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--tcd-info-soft,#e8f1fa)] text-[var(--tcd-link,var(--t-navy))]">
                <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
                <h2 className="font-heading text-xl font-bold text-[var(--tcd-heading,var(--t-deep))]">{title}</h2>
                <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--tcd-text-2,#4a5868)]">{children}</p>
                {action && (
                    <Link href={action.href} className={cn(primaryButtonClass, 'mt-5')}>
                        <LogIn className="h-5 w-5" aria-hidden="true" /> {action.label}
                    </Link>
                )}
            </div>
        </section>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <dt className="text-xs font-semibold tracking-wide text-[var(--tcd-text-3,#647280)] uppercase">{label}</dt>
            <dd className="mt-0.5 text-[var(--tcd-text,#0f2233)]">{children}</dd>
        </div>
    );
}
