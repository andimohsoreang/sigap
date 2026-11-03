import { Link, useForm } from '@inertiajs/react';
import { BriefcaseBusiness, Crosshair, LoaderCircle, MessageCircle, Send } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { RecaptchaNotice } from '@/components/sigap/recaptcha-notice';
import {
    attachmentError,
    AttachmentPicker,
    ErrorSummary,
    ErrorText,
    Field,
    fieldA11y,
    inputClass,
    RequiredNote,
    FormSection as Section,
    SubmitButton,
    textareaClass,
    triggerClass,
} from '@/components/sigap/tara-form';
import TaraPage, { TaraAvatar } from '@/components/sigap/tara-shell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRecaptcha } from '@/hooks/use-recaptcha';
import { goToChat } from '@/lib/chat-transition';
import { PROVINCE_OPTIONS } from '@/lib/provinces';
import { cn } from '@/lib/utils';

interface Option {
    id: number;
    name: string;
    province?: string | null;
}

interface Props {
    categories: Option[];
}

/** Tenggat mengikuti Pedoman Layanan (SlaCalculator). */
const IMPACTS = [
    { value: 'rendah', label: 'Rendah', sla: 'Ditanggapi paling lambat 5 hari, selesai 14 hari kerja.' },
    { value: 'sedang', label: 'Sedang', sla: 'Ditanggapi paling lambat 5 hari, selesai 14 hari kerja.' },
    { value: 'tinggi', label: 'Tinggi', sla: 'Ditanggapi paling lambat 3×24 jam, selesai 7 hari kerja.' },
    { value: 'kritis', label: 'Kritis', sla: 'Mengancam keselamatan: ditanggapi paling lambat 1×24 jam, selesai 3 hari kerja.' },
];

const VISIBILITIES = [
    { value: 'publik', label: 'Publik', desc: 'Nama Anda tidak disembunyikan.' },
    { value: 'anonim', label: 'Anonim', desc: 'Nama Anda disembunyikan.' },
    { value: 'rahasia', label: 'Rahasia', desc: 'Identitas dan laporan tidak tampil ke publik.' },
];

const NEXT_STEPS = [
    { title: 'Nomor tiket langsung terbit', desc: 'Simpan nomornya untuk memantau laporan di Lacak Tiket.' },
    { title: 'Petugas memverifikasi', desc: 'Laporan diperiksa petugas Contact Center lalu ditindaklanjuti.' },
    { title: 'Anda menerima kabar', desc: 'Setiap perubahan status dikirim ke email Anda, bila diisi.' },
];

/** Urutan kolom untuk ringkasan galat (sama dengan urutan formulir). */
const FIELD_ORDER: [string, string][] = [
    ['nik', 'NIK'],
    ['nama', 'Nama lengkap'],
    ['email', 'Email'],
    ['telepon', 'Nomor telepon'],
    ['judul', 'Judul laporan'],
    ['uraian', 'Uraian laporan'],
    ['category_id', 'Kategori'],
    ['impact', 'Tingkat dampak'],
    ['provinsi', 'Provinsi'],
    ['lokasi', 'Lokasi'],
    ['koordinat', 'Titik koordinat'],
    ['visibility', 'Privasi'],
    ['attachment', 'Lampiran'],
];

/** Formulir pengaduan masyarakat bergaya TARA (tanpa login). */
export default function FormulirPengaduan({ categories }: Props) {
    const { data, setData, post, transform, processing, errors, progress, setError, clearErrors } = useForm({
        nik: '',
        nama: '',
        email: '',
        telepon: '',
        judul: '',
        uraian: '',
        koordinat: '',
        provinsi: '',
        lokasi: '',
        category_id: '',
        impact: '',
        visibility: 'publik',
        attachment: null as File | null,
        agree: false as boolean,
        recaptcha_token: '',
    });
    const recaptcha = useRecaptcha('pengaduan');
    const [locating, setLocating] = useState(false);
    const [gpsError, setGpsError] = useState<string | null>(null);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        // Provinsi wajib: sebaran pengaduan dihitung dari provinsi yang diisi pelapor.
        if (!data.provinsi) {
            setError('provinsi', 'Pilih provinsi asal pengaduan.');
            document.getElementById('provinsi')?.focus();
            return;
        }
        clearErrors('provinsi');
        void recaptcha.withToken((token) => {
            transform((form) => ({ ...form, recaptcha_token: token }));
            post('/pengaduan/baru', {
                forceFormData: true,
                onError: () => document.getElementById('ringkasan-galat')?.focus(),
            });
        });
    };
    const busy = processing || recaptcha.verifying;

    const useGeolocation = () => {
        if (!navigator.geolocation) {
            setGpsError('Peramban Anda tidak mendukung GPS. Isi koordinat secara manual atau kosongkan.');
            return;
        }
        setLocating(true);
        setGpsError(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setData('koordinat', `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`);
                setLocating(false);
            },
            () => {
                setGpsError('Lokasi tidak dapat diambil. Izinkan akses lokasi atau isi secara manual.');
                setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 15000 },
        );
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

    const impact = IMPACTS.find((i) => i.value === data.impact);

    return (
        <TaraPage
            title="Formulir Pengaduan"
            description="Sampaikan pengaduan kepada Kementerian Transmigrasi tanpa perlu membuat akun."
            active="katalog"
            breadcrumb={[{ label: 'Beranda', href: '/' }, { label: 'Katalog Pengaduan', href: '/katalog' }, { label: 'Formulir Pengaduan' }]}
            eyebrow="Pengaduan Masyarakat"
            heading="Silakan lengkapi formulir aduan"
            subtitle="Tidak perlu masuk akun. Sertakan lokasi dan bukti yang jelas agar petugas dapat segera menindaklanjuti."
            pose="mendengarkan"
            poseAlt="TARA siap mendengarkan pengaduan Anda"
            compact
        >
            <div className="mx-auto grid max-w-[1312px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 lg:px-16 lg:py-14">
                <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-6" aria-describedby="keterangan-wajib">
                    <RequiredNote />
                    <ErrorSummary errors={errors} order={FIELD_ORDER} />

                    <Section step={1} title="Data pelapor" desc="NIK dipakai untuk verifikasi dan tidak pernah ditampilkan ke publik.">
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <Field label="NIK (KTP)" htmlFor="nik" required error={errors.nik} hint="16 digit angka sesuai KTP.">
                                <input
                                    id="nik"
                                    name="nik"
                                    value={data.nik}
                                    onChange={(e) => setData('nik', e.target.value.replace(/\D/g, '').slice(0, 16))}
                                    inputMode="numeric"
                                    autoComplete="off"
                                    maxLength={16}
                                    placeholder="3273xxxxxxxxxxxx"
                                    className={cn(inputClass, 'font-mono tracking-wider')}
                                    {...fieldA11y('nik', errors.nik, true)}
                                />
                            </Field>
                            <Field label="Nama Lengkap" htmlFor="nama" required error={errors.nama}>
                                <input
                                    id="nama"
                                    name="nama"
                                    value={data.nama}
                                    onChange={(e) => setData('nama', e.target.value)}
                                    autoComplete="name"
                                    maxLength={150}
                                    className={inputClass}
                                    {...fieldA11y('nama', errors.nama)}
                                />
                            </Field>
                            <Field label="Email" htmlFor="email" error={errors.email} hint="Untuk menerima nomor tiket dan kabar perkembangan.">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    autoComplete="email"
                                    placeholder="nama@contoh.com"
                                    className={inputClass}
                                    {...fieldA11y('email', errors.email, true)}
                                />
                            </Field>
                            <Field
                                label="No. Telepon / WA"
                                htmlFor="telepon"
                                error={errors.telepon}
                                hint="Petugas dapat menghubungi Anda bila perlu."
                            >
                                <input
                                    id="telepon"
                                    name="telepon"
                                    type="tel"
                                    value={data.telepon}
                                    onChange={(e) => setData('telepon', e.target.value)}
                                    autoComplete="tel"
                                    inputMode="tel"
                                    maxLength={30}
                                    placeholder="08xxxxxxxxxx"
                                    className={inputClass}
                                    {...fieldA11y('telepon', errors.telepon, true)}
                                />
                            </Field>
                        </div>
                    </Section>

                    <Section step={2} title="Isi laporan" desc="Ceritakan apa yang terjadi, kapan, dan siapa yang terdampak.">
                        <Field label="Judul Laporan" htmlFor="judul" required error={errors.judul}>
                            <input
                                id="judul"
                                name="judul"
                                value={data.judul}
                                onChange={(e) => setData('judul', e.target.value)}
                                maxLength={255}
                                placeholder="Mis. Jalan poros kawasan rusak setelah banjir"
                                className={inputClass}
                                {...fieldA11y('judul', errors.judul)}
                            />
                        </Field>
                        <Field
                            label="Uraian Laporan"
                            htmlFor="uraian"
                            required
                            error={errors.uraian}
                            hint={`Minimal 10 karakter · ${data.uraian.trim().length} karakter`}
                        >
                            <textarea
                                id="uraian"
                                name="uraian"
                                value={data.uraian}
                                onChange={(e) => setData('uraian', e.target.value)}
                                rows={6}
                                placeholder="Jelaskan kejadiannya selengkap mungkin…"
                                className={textareaClass}
                                {...fieldA11y('uraian', errors.uraian, true)}
                            />
                        </Field>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <Field
                                label="Kategori"
                                htmlFor="category_id"
                                error={errors.category_id}
                                hint="Kosongkan bila ragu; petugas akan menyesuaikan."
                            >
                                <Select value={data.category_id} onValueChange={(v) => setData('category_id', v)}>
                                    <SelectTrigger id="category_id" className={triggerClass} {...fieldA11y('category_id', errors.category_id, true)}>
                                        <SelectValue placeholder="Pilih kategori" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map((c) => (
                                            <SelectItem key={c.id} value={String(c.id)}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field
                                label="Tingkat Dampak"
                                htmlFor="impact"
                                required
                                error={errors.impact}
                                hint={impact ? impact.sla : 'Menentukan tenggat penanganan.'}
                            >
                                <Select value={data.impact} onValueChange={(v) => setData('impact', v)}>
                                    <SelectTrigger id="impact" className={triggerClass} {...fieldA11y('impact', errors.impact, true)}>
                                        <SelectValue placeholder="Pilih tingkat dampak" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {IMPACTS.map((i) => (
                                            <SelectItem key={i.value} value={i.value}>
                                                {i.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>
                    </Section>

                    <Section step={3} title="Lokasi kejadian" desc="Lokasi yang jelas membantu petugas menangani masalah di lapangan.">
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <Field label="Provinsi" htmlFor="provinsi" required error={errors.provinsi}>
                                <Select value={data.provinsi} onValueChange={(v) => setData('provinsi', v)}>
                                    <SelectTrigger id="provinsi" className={triggerClass} {...fieldA11y('provinsi', errors.provinsi)}>
                                        <SelectValue placeholder="Pilih provinsi" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PROVINCE_OPTIONS.map((p) => (
                                            <SelectItem key={p} value={p}>
                                                {p}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Kabupaten / Kawasan / Desa" htmlFor="lokasi" error={errors.lokasi}>
                                <input
                                    id="lokasi"
                                    name="lokasi"
                                    value={data.lokasi}
                                    onChange={(e) => setData('lokasi', e.target.value)}
                                    maxLength={150}
                                    placeholder="Mis. Kab. Merauke, SP 1 Kurik"
                                    className={inputClass}
                                    {...fieldA11y('lokasi', errors.lokasi)}
                                />
                            </Field>
                        </div>
                        <Field
                            label="Titik Koordinat (GPS)"
                            htmlFor="koordinat"
                            error={errors.koordinat ?? gpsError ?? undefined}
                            hint="Opsional. Format lintang,bujur dalam derajat desimal, mis. -8.4991,140.4011."
                        >
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                    id="koordinat"
                                    name="koordinat"
                                    value={data.koordinat}
                                    onChange={(e) => setData('koordinat', e.target.value)}
                                    inputMode="decimal"
                                    placeholder="-8.4991,140.4011"
                                    className={cn(inputClass, 'font-mono')}
                                    {...fieldA11y('koordinat', errors.koordinat ?? gpsError ?? undefined, true)}
                                />
                                <button
                                    type="button"
                                    onClick={useGeolocation}
                                    disabled={locating}
                                    className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--tcd-border-strong,#d9dfe6)] px-4 text-[15px] font-semibold text-[var(--tcd-link,var(--t-navy))] transition-colors hover:bg-[var(--tcd-muted,#f1f4f7)] disabled:opacity-70"
                                >
                                    {locating ? (
                                        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                                    ) : (
                                        <Crosshair className="h-4 w-4" aria-hidden="true" />
                                    )}
                                    {locating ? 'Mencari lokasi…' : 'Pakai lokasi saya'}
                                </button>
                            </div>
                        </Field>
                    </Section>

                    <Section step={4} title="Privasi & bukti" desc="Pilih siapa yang boleh melihat identitas Anda, lalu lampirkan bukti bila ada.">
                        <fieldset id="visibility" tabIndex={-1} className="outline-none">
                            <legend className="mb-2 text-sm font-semibold text-[var(--tcd-heading,var(--t-deep))]">Privasi laporan</legend>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                {VISIBILITIES.map((v) => (
                                    <label
                                        key={v.value}
                                        className="flex cursor-pointer gap-3 rounded-2xl border border-[var(--tcd-border-strong,#d9dfe6)] p-4 transition-colors hover:border-[var(--tcd-link,var(--t-navy))] has-[:checked]:border-[var(--tcd-link,var(--t-navy))] has-[:checked]:bg-[var(--tcd-info-soft,#eef5fb)] has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[#003d68]/15"
                                    >
                                        <input
                                            type="radio"
                                            name="visibility"
                                            value={v.value}
                                            checked={data.visibility === v.value}
                                            onChange={() => setData('visibility', v.value)}
                                            className="mt-1 h-4 w-4 shrink-0 accent-[var(--t-navy)]"
                                        />
                                        <span>
                                            <span className="block font-semibold text-[var(--tcd-heading,var(--t-deep))]">{v.label}</span>
                                            <span className="block text-[13px] leading-snug text-[var(--tcd-text-2,#4a5868)]">{v.desc}</span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                            {errors.visibility && <ErrorText id="visibility-error">{errors.visibility}</ErrorText>}
                        </fieldset>

                        <AttachmentPicker
                            label={
                                <>
                                    Lampiran bukti <span className="font-normal text-[var(--tcd-text-3,#6d7681)]">(opsional)</span>
                                </>
                            }
                            file={data.attachment}
                            error={errors.attachment}
                            progress={progress?.percentage ?? null}
                            onPick={pickFile}
                        />
                    </Section>

                    <section className="flex flex-col gap-5 rounded-[24px] border border-[var(--tcd-border,#e6ebf0)] bg-[var(--tcd-cream,#f7f3ee)] p-6 sm:p-8">
                        <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-relaxed text-[var(--tcd-text,#0f2233)]">
                            <input
                                type="checkbox"
                                aria-label="Pernyataan benar"
                                checked={data.agree}
                                onChange={(e) => setData('agree', e.target.checked)}
                                className="mt-1 h-5 w-5 shrink-0 rounded accent-[var(--t-navy)]"
                            />
                            <span>
                                Saya menyatakan informasi ini benar dan menyetujui{' '}
                                <Link
                                    href="/syarat-ketentuan"
                                    className="font-semibold text-[var(--tcd-link,var(--t-navy))] underline-offset-2 hover:underline"
                                >
                                    Syarat &amp; Ketentuan
                                </Link>{' '}
                                serta{' '}
                                <Link
                                    href="/kebijakan-privasi"
                                    className="font-semibold text-[var(--tcd-link,var(--t-navy))] underline-offset-2 hover:underline"
                                >
                                    Kebijakan Privasi
                                </Link>{' '}
                                Contact Center.
                            </span>
                        </label>

                        <RecaptchaNotice enabled={recaptcha.enabled} error={recaptcha.error ?? errors.recaptcha_token} />

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <SubmitButton busy={busy} disabled={!data.agree} icon={Send}>
                                Kirim Pengaduan
                            </SubmitButton>
                            {!data.agree && <p className="text-sm text-[var(--tcd-text-2,#4a5868)]">Centang pernyataan di atas untuk mengirim.</p>}
                        </div>
                    </section>
                </form>

                <aside className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start" aria-label="Informasi pengaduan">
                    <section className="rounded-[24px] border border-[var(--tcd-border,#e6ebf0)] bg-[var(--tcd-surface,#fff)] p-6">
                        <h2 className="font-heading text-lg font-bold text-[var(--tcd-heading,var(--t-deep))]">Setelah Anda mengirim</h2>
                        <ol className="mt-4 flex flex-col gap-4">
                            {NEXT_STEPS.map((s, i) => (
                                <li key={s.title} className="flex gap-3">
                                    <span className="font-heading flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--tcd-gold-soft,#f6ecd9)] text-sm font-bold text-[var(--tcd-bronze,#8b682b)]">
                                        {i + 1}
                                    </span>
                                    <span>
                                        <span className="block text-[15px] font-semibold text-[var(--tcd-heading,var(--t-deep))]">{s.title}</span>
                                        <span className="block text-sm leading-snug text-[var(--tcd-text-2,#4a5868)]">{s.desc}</span>
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </section>

                    <section className="flex flex-col gap-4 rounded-[24px] bg-[var(--t-deep)] p-6 text-white">
                        <div className="flex items-center gap-3">
                            <TaraAvatar className="h-12 w-12" />
                            <p className="font-heading text-lg leading-tight font-bold">Bingung mengisi?</p>
                        </div>
                        <p className="text-[15px] leading-relaxed text-[#bcd0e0]">
                            Ceritakan masalah Anda ke TARA. TARA membantu menjawab dan meneruskan ke petugas bila perlu.
                        </p>
                        <button
                            type="button"
                            onClick={(e) => goToChat({ source: e.currentTarget })}
                            className="transi-lift flex h-12 w-fit items-center gap-2 rounded-full bg-[var(--t-gold)] px-6 font-semibold text-[var(--t-deep)] hover:bg-[#d0a552]"
                        >
                            <MessageCircle className="h-5 w-5" aria-hidden="true" /> Tanya TARA
                        </button>
                    </section>

                    <Link
                        href="/pengaduan/internal"
                        className="group flex items-center gap-3 rounded-[20px] border border-[var(--tcd-border,#e6ebf0)] bg-[var(--tcd-surface,#fff)] p-5 transition-colors hover:border-[var(--tcd-link,var(--t-navy))]"
                    >
                        <BriefcaseBusiness className="h-5 w-5 shrink-0 text-[var(--tcd-link,var(--t-navy))]" aria-hidden="true" />
                        <span className="text-sm text-[var(--tcd-text-2,#4a5868)]">
                            Pegawai Kementerian?{' '}
                            <span className="font-semibold text-[var(--tcd-link,var(--t-navy))] group-hover:underline">
                                Gunakan formulir internal
                            </span>
                        </span>
                    </Link>
                </aside>
            </div>
        </TaraPage>
    );
}
