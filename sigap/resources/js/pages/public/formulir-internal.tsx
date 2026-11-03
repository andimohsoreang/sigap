import { Link, useForm } from '@inertiajs/react';
import { Info, MessageCircle, Send, ShieldAlert, Users } from 'lucide-react';
import { type FormEvent } from 'react';

import { RecaptchaNotice } from '@/components/sigap/recaptcha-notice';
import {
    attachmentError,
    AttachmentPicker,
    cardClass,
    ErrorSummary,
    Field,
    fieldA11y,
    FormSection,
    inputClass,
    outlineButtonClass,
    RequiredNote,
    SubmitButton,
    textareaClass,
    triggerClass,
} from '@/components/sigap/tara-form';
import TaraPage, { TaraAvatar } from '@/components/sigap/tara-shell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRecaptcha } from '@/hooks/use-recaptcha';
import { goToChat } from '@/lib/chat-transition';
import { cn } from '@/lib/utils';

interface Props {
    units: string[];
    categories: string[];
}

const URGENSI = ['Rendah', 'Sedang', 'Tinggi', 'Kritis'];

/** Urutan kolom untuk ringkasan galat (sama dengan urutan formulir). */
const FIELD_ORDER: [string, string][] = [
    ['nip', 'NIP / ID pegawai'],
    ['nama', 'Nama lengkap'],
    ['unit', 'Unit / bagian'],
    ['kontak', 'No. telp / ekstensi'],
    ['kategori', 'Kategori gangguan'],
    ['urgensi', 'Tingkat urgensi'],
    ['lokasi', 'Lokasi / ruangan'],
    ['deskripsi', 'Deskripsi masalah'],
    ['attachment', 'Lampiran'],
];

/** Formulir pengaduan internal pegawai (gangguan sarana & TIK kantor) bergaya TARA. */
export default function FormulirInternal({ units, categories }: Props) {
    const { data, setData, post, transform, processing, errors, progress, setError, clearErrors } = useForm({
        nip: '',
        nama: '',
        unit: '',
        kontak: '',
        kategori: '',
        urgensi: '',
        lokasi: '',
        deskripsi: '',
        attachment: null as File | null,
        recaptcha_token: '',
    });
    const recaptcha = useRecaptcha('pengaduan_internal');
    const busy = processing || recaptcha.verifying;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        void recaptcha.withToken((token) => {
            transform((form) => ({ ...form, recaptcha_token: token }));
            post('/pengaduan/internal', {
                forceFormData: true,
                onError: () => document.getElementById('ringkasan-galat')?.focus(),
            });
        });
    };

    const pickFile = (file: File | null) => {
        const tooBig = attachmentError(file);
        if (tooBig) {
            setError('attachment', tooBig);
            return;
        }
        clearErrors('attachment');
        setData('attachment', file);
    };

    return (
        <TaraPage
            title="Pengaduan Internal Pegawai"
            description="Laporkan gangguan sarana dan TIK kantor, khusus pegawai Kementerian Transmigrasi."
            active="katalog"
            breadcrumb={[{ label: 'Beranda', href: '/' }, { label: 'Katalog Pengaduan', href: '/katalog' }, { label: 'Pengaduan Internal Pegawai' }]}
            eyebrow="Khusus Pegawai Kementerian"
            heading="Pengaduan Internal Pegawai"
            subtitle="Gangguan sarana & TIK kantor — khusus pegawai Kementerian Transmigrasi."
            pose="tablet"
            poseAlt="TARA memegang tablet untuk mencatat laporan gangguan"
            compact
        >
            <div className="mx-auto grid max-w-[1312px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 lg:px-16 lg:py-14">
                <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-6" aria-describedby="keterangan-wajib">
                    <div className="flex items-start gap-3 rounded-[20px] border border-[var(--tcd-warning-border,#f1d9a6)] bg-[var(--tcd-warning-soft,#fdf6e7)] p-5 text-[15px] leading-relaxed text-[var(--tcd-text,#0f2233)]">
                        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--tcd-warning,#9a6400)]" aria-hidden="true" />
                        <p>
                            Gunakan formulir ini hanya untuk kendala teknis internal kantor (mis. internet/jaringan mati, listrik padam, perangkat
                            rusak). Untuk pengaduan masyarakat, gunakan{' '}
                            <Link href="/pengaduan/baru" className="font-semibold text-[var(--tcd-link,var(--t-navy))] underline underline-offset-2">
                                Formulir Contact Center
                            </Link>
                            .
                        </p>
                    </div>

                    <RequiredNote />
                    <ErrorSummary errors={errors} order={FIELD_ORDER} />

                    <FormSection step={1} title="Data pegawai" desc="Dipakai petugas untuk menghubungi Anda saat menangani gangguan.">
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <Field label="NIP / ID Pegawai" htmlFor="nip" required error={errors.nip}>
                                <input
                                    id="nip"
                                    name="nip"
                                    value={data.nip}
                                    onChange={(e) => setData('nip', e.target.value)}
                                    autoComplete="off"
                                    className={cn(inputClass, 'font-mono tracking-wider')}
                                    {...fieldA11y('nip', errors.nip)}
                                />
                            </Field>
                            <Field label="Nama Lengkap" htmlFor="nama" required error={errors.nama}>
                                <input
                                    id="nama"
                                    name="nama"
                                    value={data.nama}
                                    onChange={(e) => setData('nama', e.target.value)}
                                    autoComplete="name"
                                    className={inputClass}
                                    {...fieldA11y('nama', errors.nama)}
                                />
                            </Field>
                            <Field label="Unit / Bagian" htmlFor="unit" required error={errors.unit} hint="Unit tempat Anda bertugas.">
                                <Select value={data.unit} onValueChange={(v) => setData('unit', v)}>
                                    <SelectTrigger id="unit" className={triggerClass} {...fieldA11y('unit', errors.unit, true)}>
                                        <SelectValue placeholder="Pilih unit / bagian" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {units.map((u) => (
                                            <SelectItem key={u} value={u}>
                                                {u}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="No. Telp / Ekstensi" htmlFor="kontak" required error={errors.kontak}>
                                <input
                                    id="kontak"
                                    name="kontak"
                                    type="tel"
                                    value={data.kontak}
                                    onChange={(e) => setData('kontak', e.target.value)}
                                    autoComplete="tel"
                                    inputMode="tel"
                                    placeholder="Mis. 0812xxxxxxxx atau ext. 1234"
                                    className={inputClass}
                                    {...fieldA11y('kontak', errors.kontak)}
                                />
                            </Field>
                        </div>
                    </FormSection>

                    <FormSection step={2} title="Detail gangguan" desc="Jelaskan apa yang terganggu, di mana, dan sejak kapan.">
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <Field label="Kategori Gangguan" htmlFor="kategori" required error={errors.kategori}>
                                <Select value={data.kategori} onValueChange={(v) => setData('kategori', v)}>
                                    <SelectTrigger id="kategori" className={triggerClass} {...fieldA11y('kategori', errors.kategori)}>
                                        <SelectValue placeholder="Pilih kategori" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map((c) => (
                                            <SelectItem key={c} value={c}>
                                                {c}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Tingkat Urgensi" htmlFor="urgensi" required error={errors.urgensi}>
                                <Select value={data.urgensi} onValueChange={(v) => setData('urgensi', v)}>
                                    <SelectTrigger id="urgensi" className={triggerClass} {...fieldA11y('urgensi', errors.urgensi)}>
                                        <SelectValue placeholder="Pilih urgensi" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {URGENSI.map((u) => (
                                            <SelectItem key={u} value={u}>
                                                {u}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>
                        <Field label="Lokasi / Ruangan" htmlFor="lokasi" required error={errors.lokasi}>
                            <input
                                id="lokasi"
                                name="lokasi"
                                value={data.lokasi}
                                onChange={(e) => setData('lokasi', e.target.value)}
                                placeholder="Contoh: Gedung A, Lantai 2, Ruang TIK"
                                className={inputClass}
                                {...fieldA11y('lokasi', errors.lokasi)}
                            />
                        </Field>
                        <Field
                            label="Deskripsi Masalah"
                            htmlFor="deskripsi"
                            required
                            error={errors.deskripsi}
                            hint={`Minimal 10 karakter · ${data.deskripsi.trim().length} karakter`}
                        >
                            <textarea
                                id="deskripsi"
                                name="deskripsi"
                                value={data.deskripsi}
                                onChange={(e) => setData('deskripsi', e.target.value)}
                                rows={6}
                                placeholder="Jelaskan gangguan selengkap mungkin…"
                                className={textareaClass}
                                {...fieldA11y('deskripsi', errors.deskripsi, true)}
                            />
                        </Field>
                        <AttachmentPicker
                            label={
                                <>
                                    Lampiran <span className="font-normal text-[var(--tcd-text-3,#6d7681)]">(opsional)</span>
                                </>
                            }
                            file={data.attachment}
                            error={errors.attachment}
                            progress={progress?.percentage ?? null}
                            onPick={pickFile}
                        />
                    </FormSection>

                    <section className="flex flex-col gap-5 rounded-[24px] border border-[var(--tcd-border,#e6ebf0)] bg-[var(--tcd-cream,#f7f3ee)] p-6 sm:p-8">
                        <RecaptchaNotice enabled={recaptcha.enabled} error={recaptcha.error ?? errors.recaptcha_token} />
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <SubmitButton busy={busy} icon={Send}>
                                Kirim Laporan
                            </SubmitButton>
                            <Link href="/katalog" className={outlineButtonClass}>
                                Batal
                            </Link>
                        </div>
                    </section>
                </form>

                <aside className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start" aria-label="Informasi pengaduan internal">
                    <section className={cn(cardClass, 'p-6')}>
                        <h2 className="font-heading flex items-center gap-2.5 text-lg font-bold text-[var(--tcd-heading,var(--t-deep))]">
                            <Users className="h-5 w-5 shrink-0 text-[var(--tcd-link,var(--t-navy))]" aria-hidden="true" />
                            Siapa yang menangani?
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-[var(--tcd-text-2,#4a5868)]">
                            Laporan internal diterima dan hanya dapat dibuka Super Admin Contact Center. Nomor tiket terbit setelah laporan terkirim.
                        </p>
                    </section>

                    <section className={cn(cardClass, 'p-6')}>
                        <h2 className="font-heading flex items-center gap-2.5 text-lg font-bold text-[var(--tcd-heading,var(--t-deep))]">
                            <ShieldAlert className="h-5 w-5 shrink-0 text-[var(--tcd-link,var(--t-navy))]" aria-hidden="true" />
                            Pelanggaran atau etik?
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-[var(--tcd-text-2,#4a5868)]">
                            Untuk indikasi pelanggaran/etik, laporkan ke Inspektorat Jenderal (
                            <a href="mailto:itjen@transmigrasi.go.id" className="font-semibold text-[var(--tcd-link,var(--t-navy))] hover:underline">
                                itjen@transmigrasi.go.id
                            </a>
                            ) atau lewat PPID.
                        </p>
                    </section>

                    <section className="flex flex-col gap-4 rounded-[24px] bg-[var(--t-deep)] p-6 text-white">
                        <div className="flex items-center gap-3">
                            <TaraAvatar className="h-12 w-12" />
                            <p className="font-heading text-lg leading-tight font-bold">Bukan gangguan kantor?</p>
                        </div>
                        <p className="text-[15px] leading-relaxed text-[#bcd0e0]">Tanyakan ke TARA untuk menemukan layanan yang tepat.</p>
                        <button
                            type="button"
                            onClick={(e) => goToChat({ source: e.currentTarget })}
                            className="transi-lift flex h-12 w-fit items-center gap-2 rounded-full bg-[var(--t-gold)] px-6 font-semibold text-[var(--t-deep)] hover:bg-[#d0a552]"
                        >
                            <MessageCircle className="h-5 w-5" aria-hidden="true" /> Tanya TARA
                        </button>
                    </section>
                </aside>
            </div>
        </TaraPage>
    );
}
