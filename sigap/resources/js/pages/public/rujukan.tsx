import { Head, useForm } from '@inertiajs/react';
import { CheckCircle2, ClipboardCheck, Copy, ExternalLink, LifeBuoy, ListChecks, ShieldCheck, TriangleAlert, UserRound } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import PublicLayout from '@/layouts/public-layout';
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
        <PublicLayout title={`Rujukan ke ${portal.nama}`}>
            <Head title={`Pengantar ke ${portal.nama} — Contact Center`}>
                <meta name="robots" content="noindex, nofollow" />
            </Head>

            <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
                <p className="text-primary mb-2 text-sm font-semibold">
                    Rujukan <span className="font-mono">{rujukan.kode}</span> · dari Contact Center
                </p>
                <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                    {done ? 'Aduan Anda sudah tercatat' : `Anda akan diarahkan ke ${portal.nama}`}
                </h1>
                <p className="mt-2 text-gray-600">{portal.kegunaan}.</p>

                <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                        Portal resmi {portal.pengelola ?? 'Kementerian Transmigrasi'} di <b className="font-mono">{portal.domain}</b>. Periksa alamat
                        ini di peramban sebelum mengisi data pribadi.
                    </span>
                </div>

                {done ? (
                    <DoneCard portal={portal} rujukan={rujukan} />
                ) : closed ? (
                    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 text-gray-700">
                        Rujukan ini sudah ditutup petugas. Bila masih membutuhkan bantuan, mulai chat baru di Contact Center.
                    </div>
                ) : (
                    <>
                        <Progress step={opened ? 3 : 1} />

                        {!portal.tersedia && (
                            <div
                                className="mt-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                                role="status"
                            >
                                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                {portal.nama} sedang tidak dapat diakses. Coba beberapa saat lagi, atau beri tahu kami di bagian “Mengalami kendala?”.
                            </div>
                        )}

                        {rujukan.status === 'butuh_bantuan' && (
                            <div
                                className="mt-6 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"
                                role="status"
                            >
                                <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                Kendala Anda sudah diterima. Petugas pendamping akan menghubungi Anda
                                {rujukan.ada_chat ? ' dan membalas di chat Contact Center' : ''}.
                            </div>
                        )}

                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            {portal.siapkan.length > 0 && (
                                <Section icon={ClipboardCheck} title="Siapkan dulu">
                                    <ul className="space-y-2 text-sm text-gray-700">
                                        {portal.siapkan.map((item) => (
                                            <li key={item} className="flex gap-2">
                                                <CheckCircle2 className="text-brand-light mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </Section>
                            )}
                            {portal.langkah.length > 0 && (
                                <Section icon={ListChecks} title={`Langkah di ${portal.nama}`}>
                                    <ol className="space-y-2 text-sm text-gray-700">
                                        {portal.langkah.map((item, i) => (
                                            <li key={item} className="flex gap-2">
                                                <span className="bg-primary/10 text-primary flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                                                    {i + 1}
                                                </span>
                                                {item}
                                            </li>
                                        ))}
                                    </ol>
                                </Section>
                            )}
                        </div>

                        {rujukan.ringkasan && <SummaryCard text={rujukan.ringkasan} />}

                        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center">
                            <div className="flex flex-1 items-start gap-3 text-sm text-gray-700">
                                <UserRound className="text-primary mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                                <span>
                                    {rujukan.pendamping ? (
                                        <>
                                            <b>{rujukan.pendamping}</b>, petugas Contact Center, mendampingi Anda sampai aduan tercatat.
                                        </>
                                    ) : (
                                        'Petugas Contact Center mendampingi Anda sampai aduan tercatat.'
                                    )}
                                </span>
                            </div>
                            <Button asChild size="lg" className="shrink-0">
                                <a href={portal.url} target="_blank" rel="noopener noreferrer" onClick={go}>
                                    {portal.tombol} <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                    <span className="sr-only">(membuka tab baru)</span>
                                </a>
                            </Button>
                        </div>

                        <ProofForm token={rujukan.token} label={portal.bukti} portal={portal.nama} highlight={opened} />
                        <HelpForm token={rujukan.token} askContact={!rujukan.punya_kontak} />
                    </>
                )}

                {portal.kontak && (
                    <p className="mt-8 text-center text-xs text-gray-500">
                        Kontak {portal.nama}: {portal.kontak}
                    </p>
                )}
            </div>
        </PublicLayout>
    );
}

function Progress({ step }: { step: number }) {
    const steps = ['Siapkan', 'Isi di portal', 'Masukkan bukti di sini'];

    return (
        <ol className="mt-6 grid grid-cols-3 gap-2" aria-label="Tahapan">
            {steps.map((label, i) => {
                const n = i + 1;
                const state = n < step ? 'done' : n === step ? 'current' : 'next';
                return (
                    <li
                        key={label}
                        aria-current={state === 'current' ? 'step' : undefined}
                        className={cn(
                            'rounded-lg border px-3 py-2 text-xs font-medium sm:text-sm',
                            state === 'current' && 'border-primary bg-primary/5 text-primary',
                            state === 'done' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
                            state === 'next' && 'border-gray-200 bg-white text-gray-500',
                        )}
                    >
                        <span className="tabular-nums">{n}.</span> {label}
                    </li>
                );
            })}
        </ol>
    );
}

function Section({ icon: Icon, title, children }: { icon: typeof ListChecks; title: string; children: ReactNode }) {
    return (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Icon className="text-brand-light h-4 w-4" aria-hidden="true" /> {title}
            </h2>
            {children}
        </section>
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
        <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Ringkasan aduan Anda</h2>
                <Button type="button" size="sm" variant="outline" onClick={copy}>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" /> {copied ? 'Tersalin' : 'Salin'}
                </Button>
            </div>
            <p className="rounded-lg bg-gray-50 p-3 text-sm whitespace-pre-line text-gray-700">{text}</p>
            <p className="mt-2 text-xs text-gray-500">Tempel ke kolom isi pengaduan di portal tujuan, lalu lengkapi bila perlu.</p>
        </section>
    );
}

function ProofForm({ token, label, portal, highlight }: { token: string; label: string; portal: string; highlight: boolean }) {
    const form = useForm({ bukti: '' });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(`/rujukan/${token}/berhasil`, { preserveScroll: true });
    };

    return (
        <section className={cn('mt-6 rounded-xl border p-5', highlight ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white')}>
            <h2 className="text-sm font-semibold text-gray-900">Sudah mengirim aduan di {portal}?</h2>
            <p className="mt-1 text-sm text-gray-600">
                Masukkan {label.charAt(0).toLowerCase() + label.slice(1)} yang Anda terima. Dengan begitu petugas tahu aduan Anda sudah tercatat.
            </p>
            <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label htmlFor="bukti-rujukan" className="sr-only">
                    {label}
                </label>
                <Input
                    id="bukti-rujukan"
                    value={form.data.bukti}
                    onChange={(e) => form.setData('bukti', e.target.value)}
                    placeholder={label}
                    maxLength={100}
                    aria-invalid={form.errors.bukti ? true : undefined}
                    className="font-mono uppercase placeholder:font-sans placeholder:normal-case"
                />
                <Button type="submit" disabled={form.processing || form.data.bukti.trim().length < 3}>
                    Simpan bukti
                </Button>
            </form>
            {form.errors.bukti && <p className="mt-1 text-xs font-semibold text-rose-600">{form.errors.bukti}</p>}
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
        <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
            <button
                type="button"
                className="flex w-full items-center justify-between text-left text-sm font-semibold text-gray-900"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
            >
                <span className="flex items-center gap-2">
                    <LifeBuoy className="text-brand-light h-4 w-4" aria-hidden="true" /> Mengalami kendala?
                </span>
                <span className="text-primary text-xs">{open ? 'Tutup' : 'Minta bantuan petugas'}</span>
            </button>
            {open && (
                <form onSubmit={submit} className="mt-3 space-y-3">
                    <div>
                        <label htmlFor="pesan-bantuan" className="mb-1 block text-xs font-semibold text-gray-700">
                            Ceritakan kendalanya
                        </label>
                        <Textarea
                            id="pesan-bantuan"
                            rows={3}
                            value={form.data.pesan}
                            onChange={(e) => form.setData('pesan', e.target.value)}
                            placeholder="Mis. formulir tidak bisa dikirim, tidak punya KTP-el, tidak menerima kode tracking"
                        />
                        {form.errors.pesan && <p className="mt-1 text-xs font-semibold text-rose-600">{form.errors.pesan}</p>}
                    </div>
                    {askContact && (
                        <div>
                            <label htmlFor="kontak-bantuan" className="mb-1 block text-xs font-semibold text-gray-700">
                                Nomor WhatsApp atau surel (agar petugas dapat menghubungi)
                            </label>
                            <Input
                                id="kontak-bantuan"
                                value={form.data.kontak}
                                onChange={(e) => form.setData('kontak', e.target.value)}
                                placeholder="08xxxxxxxxxx"
                                maxLength={100}
                            />
                            {form.errors.kontak && <p className="mt-1 text-xs font-semibold text-rose-600">{form.errors.kontak}</p>}
                        </div>
                    )}
                    <Button type="submit" variant="outline" disabled={form.processing}>
                        Kirim ke petugas
                    </Button>
                </form>
            )}
        </section>
    );
}

function DoneCard({ portal, rujukan }: Props) {
    return (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-white p-6">
            <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" aria-hidden="true" />
                <div>
                    <p className="text-gray-800">
                        {portal.bukti} Anda di {portal.nama}: <b className="font-mono">{rujukan.bukti}</b>
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                        Simpan kode ini untuk memantau perkembangan aduan langsung di {portal.nama}. Terima kasih sudah melapor.
                    </p>
                    <Button asChild variant="outline" size="sm" className="mt-4">
                        <a href={portal.url} target="_blank" rel="noopener noreferrer">
                            Buka {portal.nama} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                    </Button>
                </div>
            </div>
        </div>
    );
}
