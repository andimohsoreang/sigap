import { Head, useForm } from '@inertiajs/react';
import { CheckCircle2, ClipboardCheck, Copy, ExternalLink, LifeBuoy, ListChecks, ShieldCheck, TriangleAlert, UserRound } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { cardClass, ErrorText, fieldA11y, FlashNotice, inputClass, outlineButtonClass, TaraCard, textareaClass } from '@/components/sigap/tara-form';
import TaraPage from '@/components/sigap/tara-shell';
import { cn } from '@/lib/utils';

interface PortalInfo {
    nama: string;
    kegunaan: string;
    keterangan: string | null;
    langkah: string[];
    siapkan: string[];
    bukti: string;
    url: string;
    tombol: string;
    domain: string;
    pengelola: string | null;
    kontak: string | null;
    tersedia: boolean;
}

interface RujukanInfo {
    token: string;
    kode: string;
    status: 'dirujuk' | 'dibuka' | 'butuh_bantuan' | 'berhasil' | 'gagal';
    status_label: string;
    ringkasan: string | null;
    pendamping: string | null;
    bukti: string | null;
    dibuat: string | null;
    ada_chat: boolean;
    punya_kontak: boolean;
}

interface Props {
    portal: PortalInfo;
    rujukan: RujukanInfo;
}

function csrfToken(): string {
    const match = document.cookie.match(/(^|;\s*)XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[2]) : '';
}

/**
 * Pengantar sebelum warga dialihkan ke portal lain (mis. Trans Tuntas):
 * apa portal itu, apa yang perlu disiapkan, langkahnya, ringkasan aduan
 * untuk disalin, lalu tempat memasukkan bukti setelah berhasil.
 */
export default function Rujukan({ portal, rujukan }: Props) {
    const [opened, setOpened] = useState(rujukan.status !== 'dirujuk');
    const done = rujukan.status === 'berhasil';
    const closed = rujukan.status === 'gagal';

    const go = () => {
        setOpened(true);
        // Dicatat tanpa menunggu: tautan tetap terbuka walau pencatatan gagal.
        void fetch(`/rujukan/${rujukan.token}/buka`, {
            method: 'POST',
            keepalive: true,
            credentials: 'same-origin',
            headers: { Accept: 'application/json', 'X-XSRF-TOKEN': csrfToken() },
        }).catch(() => undefined);
    };

    return (
        <TaraPage
            flash={false}
            title={`Pengantar ke ${portal.nama}`}
            eyebrow={`Rujukan ${rujukan.kode} · dari Contact Center`}
            heading={done ? 'Aduan Anda sudah tercatat' : `Anda akan diarahkan ke ${portal.nama}`}
            subtitle={`${portal.kegunaan}.`}
            pose={done ? 'jempol' : 'menunjuk'}
            poseAlt={done ? 'TARA mengacungkan jempol' : `TARA menunjuk ke ${portal.nama}`}
            compact
        >
            <Head>
                <meta name="robots" content="noindex, nofollow" />
            </Head>

            <div className="mx-auto flex max-w-[880px] flex-col gap-5 px-4 py-10 sm:px-6 lg:py-14">
                <FlashNotice />

                <div className="flex items-start gap-3 rounded-[20px] border border-[var(--tcd-success-border,#a7e3c7)] bg-[var(--tcd-success-soft,#ecfaf3)] p-4 text-[15px] text-[var(--tcd-success,#0f6b48)]">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>
                        Portal resmi {portal.pengelola ?? 'Kementerian Transmigrasi'} di <b className="font-mono">{portal.domain}</b>. Periksa alamat
                        ini di peramban sebelum mengisi data pribadi.
                    </span>
                </div>

                {done ? (
                    <DoneCard portal={portal} rujukan={rujukan} />
                ) : closed ? (
                    <div className={cn(cardClass, 'p-6 text-[15px] text-[var(--tcd-text,#0f2233)]')}>
                        Rujukan ini sudah ditutup petugas. Bila masih membutuhkan bantuan, mulai chat baru di Contact Center.
                    </div>
                ) : (
                    <>
                        <Progress step={opened ? 3 : 1} />

                        {!portal.tersedia && (
                            <div
                                className="flex items-start gap-3 rounded-[20px] border border-[var(--tcd-warning-border,#f1d9a6)] bg-[var(--tcd-warning-soft,#fdf6e7)] p-4 text-[15px] text-[var(--tcd-text,#0f2233)]"
                                role="status"
                            >
                                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--tcd-warning,#9a6400)]" aria-hidden="true" />
                                {portal.nama} sedang tidak dapat diakses. Coba beberapa saat lagi, atau beri tahu kami di bagian “Mengalami kendala?”.
                            </div>
                        )}

                        {rujukan.status === 'butuh_bantuan' && (
                            <div
                                className="flex items-start gap-3 rounded-[20px] border border-[var(--tcd-info-border,#bcd8ee)] bg-[var(--tcd-info-soft,#eef5fb)] p-4 text-[15px] text-[var(--tcd-text,#0f2233)]"
                                role="status"
                            >
                                <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-[var(--tcd-info,#0d6b8a)]" aria-hidden="true" />
                                Kendala Anda sudah diterima. Petugas pendamping akan menghubungi Anda
                                {rujukan.ada_chat ? ' dan membalas di chat Contact Center' : ''}.
                            </div>
                        )}

                        {(portal.siapkan.length > 0 || portal.langkah.length > 0) && (
                            <div className="grid gap-5 md:grid-cols-2">
                                {portal.siapkan.length > 0 && (
                                    <TaraCard icon={ClipboardCheck} title="Siapkan dulu">
                                        <ul className="space-y-2.5 text-[15px] text-[var(--tcd-text,#0f2233)]">
                                            {portal.siapkan.map((item) => (
                                                <li key={item} className="flex gap-2.5">
                                                    <CheckCircle2
                                                        className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--tcd-success,#0f6b48)]"
                                                        aria-hidden="true"
                                                    />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </TaraCard>
                                )}
                                {portal.langkah.length > 0 && (
                                    <TaraCard icon={ListChecks} title={`Langkah di ${portal.nama}`}>
                                        <ol className="space-y-2.5 text-[15px] text-[var(--tcd-text,#0f2233)]">
                                            {portal.langkah.map((item, i) => (
                                                <li key={item} className="flex gap-2.5">
                                                    <span className="font-heading flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--tcd-gold-soft,#f6ecd9)] text-xs font-bold text-[var(--tcd-bronze,#8b682b)]">
                                                        {i + 1}
                                                    </span>
                                                    {item}
                                                </li>
                                            ))}
                                        </ol>
                                    </TaraCard>
                                )}
                            </div>
                        )}

                        {rujukan.ringkasan && <SummaryCard text={rujukan.ringkasan} />}

                        <div className="flex flex-col gap-4 rounded-[24px] bg-[var(--t-deep)] p-6 text-white sm:flex-row sm:items-center sm:p-7">
                            <div className="flex flex-1 items-start gap-3 text-[15px] leading-relaxed text-[#d6e2ec]">
                                <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-[var(--t-gold)]" aria-hidden="true" />
                                <span>
                                    {rujukan.pendamping ? (
                                        <>
                                            <b className="text-white">{rujukan.pendamping}</b>, petugas Contact Center, mendampingi Anda sampai aduan
                                            tercatat.
                                        </>
                                    ) : (
                                        'Petugas Contact Center mendampingi Anda sampai aduan tercatat.'
                                    )}
                                </span>
                            </div>
                            <a
                                href={portal.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={go}
                                className="transi-lift font-heading flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--t-gold)] px-7 text-[16px] font-bold text-[var(--t-deep)] hover:bg-[#d0a552]"
                            >
                                {portal.tombol} <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only">(membuka tab baru)</span>
                            </a>
                        </div>

                        <ProofForm token={rujukan.token} label={portal.bukti} portal={portal.nama} highlight={opened} />
                        <HelpForm token={rujukan.token} askContact={!rujukan.punya_kontak} />
                    </>
                )}

                {portal.kontak && (
                    <p className="mt-3 text-center text-sm text-[var(--tcd-text-2,#4a5868)]">
                        Kontak {portal.nama}: {portal.kontak}
                    </p>
                )}
            </div>
        </TaraPage>
    );
}

function Progress({ step }: { step: number }) {
    const steps = ['Siapkan', 'Isi di portal', 'Masukkan bukti di sini'];

    return (
        <ol className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Tahapan">
            {steps.map((label, i) => {
                const n = i + 1;
                const state = n < step ? 'done' : n === step ? 'current' : 'next';
                return (
                    <li
                        key={label}
                        aria-current={state === 'current' ? 'step' : undefined}
                        className={cn(
                            'flex flex-col gap-1 rounded-2xl border px-3 py-3 text-[13px] leading-snug font-semibold sm:flex-row sm:items-center sm:gap-2.5 sm:px-4 sm:text-sm',
                            state === 'current' &&
                                'border-[var(--tcd-link,var(--t-navy))] bg-[var(--tcd-info-soft,#eef5fb)] text-[var(--tcd-heading,var(--t-deep))]',
                            state === 'done' &&
                                'border-[var(--tcd-success-border,#a7e3c7)] bg-[var(--tcd-success-soft,#ecfaf3)] text-[var(--tcd-success,#0f6b48)]',
                            state === 'next' && 'border-[var(--tcd-border,#e6ebf0)] bg-[var(--tcd-surface,#fff)] text-[var(--tcd-text-2,#4a5868)]',
                        )}
                    >
                        <span
                            className={cn(
                                'font-heading flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
                                state === 'current' && 'bg-[var(--tcd-primary,var(--t-deep))] text-white',
                                state === 'done' && 'bg-[var(--tcd-success,#0f6b48)] text-white',
                                state === 'next' && 'bg-[var(--tcd-muted,#f1f4f7)] text-[var(--tcd-text-2,#4a5868)]',
                            )}
                            aria-hidden="true"
                        >
                            {n}
                        </span>
                        <span>
                            <span className="sr-only">{n}. </span>
                            {label}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

function SummaryCard({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2500);
        } catch {
            setCopied(false);
        }
    };

    return (
        <TaraCard
            title="Ringkasan aduan Anda"
            action={
                <button type="button" onClick={copy} className={cn(outlineButtonClass, 'h-10 shrink-0 px-4 text-sm')}>
                    <Copy className="h-4 w-4" aria-hidden="true" /> {copied ? 'Tersalin' : 'Salin'}
                </button>
            }
        >
            <p className="rounded-2xl bg-[var(--tcd-muted,#f6f8fa)] p-4 text-[15px] leading-relaxed whitespace-pre-line text-[var(--tcd-text,#0f2233)]">
                {text}
            </p>
            <p className="mt-3 text-sm text-[var(--tcd-text-2,#4a5868)]">Tempel ke kolom isi pengaduan di portal tujuan, lalu lengkapi bila perlu.</p>
            <span className="sr-only" role="status">
                {copied ? 'Ringkasan tersalin' : ''}
            </span>
        </TaraCard>
    );
}

function ProofForm({ token, label, portal, highlight }: { token: string; label: string; portal: string; highlight: boolean }) {
    const form = useForm({ bukti: '' });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(`/rujukan/${token}/berhasil`, { preserveScroll: true });
    };

    return (
        <section
            className={cn(
                'rounded-[24px] border p-6 sm:p-7',
                highlight
                    ? 'border-[var(--tcd-link,var(--t-navy))] bg-[var(--tcd-info-soft,#eef5fb)]'
                    : 'border-[var(--tcd-border,#e6ebf0)] bg-[var(--tcd-surface,#fff)]',
            )}
        >
            <h2 className="font-heading text-lg font-bold text-[var(--tcd-heading,var(--t-deep))]">Sudah mengirim aduan di {portal}?</h2>
            <p className="mt-1 text-[15px] text-[var(--tcd-text-2,#4a5868)]">
                Masukkan {label.charAt(0).toLowerCase() + label.slice(1)} yang Anda terima. Dengan begitu petugas tahu aduan Anda sudah tercatat.
            </p>
            <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row">
                <label htmlFor="bukti-rujukan" className="sr-only">
                    {label}
                </label>
                <input
                    id="bukti-rujukan"
                    value={form.data.bukti}
                    onChange={(e) => form.setData('bukti', e.target.value)}
                    placeholder={label}
                    maxLength={100}
                    className={cn(inputClass, 'font-mono uppercase placeholder:font-sans placeholder:normal-case')}
                    {...fieldA11y('bukti-rujukan', form.errors.bukti)}
                />
                <button
                    type="submit"
                    disabled={form.processing || form.data.bukti.trim().length < 3}
                    className="font-heading flex h-12 shrink-0 items-center justify-center rounded-full bg-[var(--t-deep)] px-7 font-bold text-white hover:bg-[var(--tcd-primary,var(--t-navy))] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    Simpan bukti
                </button>
            </form>
            {form.errors.bukti && <ErrorText id="bukti-rujukan-error">{form.errors.bukti}</ErrorText>}
        </section>
    );
}

function HelpForm({ token, askContact }: { token: string; askContact: boolean }) {
    const [open, setOpen] = useState(false);
    const form = useForm({ pesan: '', kontak: '' });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(`/rujukan/${token}/bantuan`, { preserveScroll: true, onSuccess: () => setOpen(false) });
    };

    return (
        <section className={cn(cardClass, 'p-6 sm:p-7')}>
            <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={open}
                aria-controls="bantuan-rujukan"
                onClick={() => setOpen((v) => !v)}
            >
                <span className="font-heading flex items-center gap-2.5 text-lg font-bold text-[var(--tcd-heading,var(--t-deep))]">
                    <LifeBuoy className="h-5 w-5 text-[var(--tcd-link,var(--t-navy))]" aria-hidden="true" /> Mengalami kendala?
                </span>
                <span className="text-sm font-semibold text-[var(--tcd-link,var(--t-navy))]">{open ? 'Tutup' : 'Minta bantuan petugas'}</span>
            </button>
            {open && (
                <form id="bantuan-rujukan" onSubmit={submit} className="mt-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <label htmlFor="pesan-bantuan" className="text-sm font-semibold text-[var(--tcd-heading,var(--t-deep))]">
                            Ceritakan kendalanya
                        </label>
                        <textarea
                            id="pesan-bantuan"
                            rows={3}
                            value={form.data.pesan}
                            onChange={(e) => form.setData('pesan', e.target.value)}
                            placeholder="Mis. formulir tidak bisa dikirim, tidak punya KTP-el, tidak menerima kode tracking"
                            className={cn(textareaClass, 'min-h-[110px]')}
                            {...fieldA11y('pesan-bantuan', form.errors.pesan)}
                        />
                        {form.errors.pesan && <ErrorText id="pesan-bantuan-error">{form.errors.pesan}</ErrorText>}
                    </div>
                    {askContact && (
                        <div className="flex flex-col gap-2">
                            <label htmlFor="kontak-bantuan" className="text-sm font-semibold text-[var(--tcd-heading,var(--t-deep))]">
                                Nomor WhatsApp atau surel (agar petugas dapat menghubungi)
                            </label>
                            <input
                                id="kontak-bantuan"
                                value={form.data.kontak}
                                onChange={(e) => form.setData('kontak', e.target.value)}
                                placeholder="08xxxxxxxxxx"
                                maxLength={100}
                                className={inputClass}
                                {...fieldA11y('kontak-bantuan', form.errors.kontak)}
                            />
                            {form.errors.kontak && <ErrorText id="kontak-bantuan-error">{form.errors.kontak}</ErrorText>}
                        </div>
                    )}
                    <button type="submit" disabled={form.processing} className={cn(outlineButtonClass, 'w-fit')}>
                        Kirim ke petugas
                    </button>
                </form>
            )}
        </section>
    );
}

function DoneCard({ portal, rujukan }: Props) {
    return (
        <div className="rounded-[24px] border border-[var(--tcd-success-border,#a7e3c7)] bg-[var(--tcd-surface,#fff)] p-6 sm:p-8">
            <div className="flex items-start gap-4">
                <CheckCircle2 className="h-7 w-7 shrink-0 text-[var(--tcd-success,#0f6b48)]" aria-hidden="true" />
                <div className="min-w-0">
                    <p className="text-[17px] text-[var(--tcd-heading,var(--t-deep))]">
                        {portal.bukti} Anda di {portal.nama}: <b className="font-mono">{rujukan.bukti}</b>
                    </p>
                    <p className="mt-2 text-[15px] text-[var(--tcd-text-2,#4a5868)]">
                        Simpan kode ini untuk memantau perkembangan aduan langsung di {portal.nama}. Terima kasih sudah melapor.
                    </p>
                    <a href={portal.url} target="_blank" rel="noopener noreferrer" className={cn(outlineButtonClass, 'mt-5 w-fit')}>
                        Buka {portal.nama} <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">(membuka tab baru)</span>
                    </a>
                </div>
            </div>
        </div>
    );
}
