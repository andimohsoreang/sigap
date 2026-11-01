import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AdminLayout from '@/layouts/admin-layout';
import { PROVINCE_OPTIONS } from '@/lib/provinces';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { useForm, usePage } from '@inertiajs/react';
import {
    AtSign,
    Camera,
    Check,
    Circle,
    Info,
    LoaderCircle,
    Mail,
    MessageCircle,
    Music2,
    Paperclip,
    Phone,
    ThumbsUp,
    Upload,
    Users,
    type LucideIcon,
} from 'lucide-react';
import { type FormEvent, type ReactNode } from 'react';

interface Props {
    options: {
        categories: { id: number; name: string }[];
    };
    /** Target SLA per dampak (Pedoman Layanan). */
    impacts?: { value: string; label: string; respons_jam: number; selesai_hari: number }[];
    /** Tiket dari percakapan contact center: isian awal dari ringkasan AI. */
    prefill?: {
        percakapan_id: number;
        referensi: string | null;
        nama: string;
        telepon: string;
        judul: string;
        uraian: string;
        provinsi?: string | null;
        lokasi?: string | null;
    } | null;
}

/** Nilai mengikuti StoreInputManualRequest. */
const SUMBER: { group: string; items: { value: string; label: string; icon: LucideIcon }[] }[] = [
    {
        group: 'Langsung',
        items: [
            { value: 'tatap_muka', label: 'Tatap muka', icon: Users },
            { value: 'call_center', label: 'Telepon', icon: Phone },
            { value: 'surat', label: 'Surat / pos', icon: Mail },
            { value: 'live_chat', label: 'Live chat', icon: MessageCircle },
        ],
    },
    {
        group: 'Media sosial',
        items: [
            { value: 'instagram', label: 'Instagram', icon: Camera },
            { value: 'x', label: 'X / Twitter', icon: AtSign },
            { value: 'facebook', label: 'Facebook', icon: ThumbsUp },
            { value: 'tiktok', label: 'TikTok', icon: Music2 },
        ],
    },
];
const MEDSOS = ['instagram', 'x', 'facebook', 'tiktok'];

const IMPACT_TONE: Record<string, string> = {
    kritis: 'var(--adm-danger)',
    tinggi: 'var(--adm-warning)',
    sedang: 'var(--adm-info)',
    rendah: 'var(--adm-text-3)',
};

/** Cadangan bila server belum mengirim target (sama dengan TicketImpact). */
const DEFAULT_IMPACTS = [
    { value: 'kritis', label: 'Kritis', respons_jam: 24, selesai_hari: 3 },
    { value: 'tinggi', label: 'Tinggi', respons_jam: 72, selesai_hari: 7 },
    { value: 'sedang', label: 'Sedang', respons_jam: 120, selesai_hari: 14 },
    { value: 'rendah', label: 'Rendah', respons_jam: 120, selesai_hari: 14 },
];

const respons = (jam: number) => (jam % 24 === 0 && jam / 24 <= 3 ? `${jam / 24}×24 jam` : jam % 24 === 0 ? `${jam / 24} hari` : `${jam} jam`);

export default function InputManual({ options, impacts = DEFAULT_IMPACTS, prefill = null }: Props) {
    const { auth } = usePage<SharedData>().props;
    const { data, setData, post, processing, errors, progress } = useForm({
        sumber_laporan: prefill ? 'live_chat' : '',
        nik: '',
        nama: prefill?.nama ?? '',
        telepon: prefill?.telepon ?? '',
        tautan: '',
        judul: prefill?.judul ?? '',
        uraian: prefill?.uraian ?? '',
        percakapan_id: prefill ? String(prefill.percakapan_id) : '',
        // Wilayah dari pengaduan: provinsi asal + lokasi bebas (terisi dari chat bila ada).
        provinsi: prefill?.provinsi ?? '',
        lokasi: prefill?.lokasi ?? '',
        category_id: '',
        impact: '',
        attachment: null as File | null,
    });

    const medsos = MEDSOS.includes(data.sumber_laporan);
    const impact = impacts.find((i) => i.value === data.impact);
    const checklist: { label: string; done: boolean }[] = [
        { label: 'Sumber laporan', done: Boolean(data.sumber_laporan) },
        { label: 'Nama pelapor', done: data.nama.trim() !== '' },
        { label: 'Judul keluhan', done: data.judul.trim() !== '' },
        { label: 'Uraian', done: data.uraian.trim() !== '' },
        { label: 'Provinsi asal', done: Boolean(data.provinsi) },
        { label: 'Kategori', done: Boolean(data.category_id) },
        { label: 'Tingkat dampak', done: Boolean(data.impact) },
    ];
    const missing = checklist.filter((c) => !c.done).length;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/admin/input-manual', { forceFormData: true });
    };

    return (
        <AdminLayout title="Input Manual" subtitle="Catat pengaduan yang masuk lewat telepon, surat, tatap muka, atau media sosial menjadi tiket.">
            {prefill && (
                <p className="mb-6 flex items-start gap-2 rounded-lg border border-[var(--adm-border)] bg-[var(--adm-info-soft)] px-4 py-3 text-sm text-[var(--adm-text)]">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--adm-info)]" aria-hidden="true" />
                    <span>
                        Tiket dari percakapan live chat{prefill.referensi ? ` (${prefill.referensi})` : ''}. Isian diambil dari ringkasan asisten;
                        periksa dan lengkapi sebelum diterbitkan. Nomor tiket dikirim otomatis ke percakapan warga.
                    </span>
                </p>
            )}

            <form onSubmit={submit} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="min-w-0 space-y-6">
                    <Step no={1} title="Sumber laporan" hint="Dari mana pengaduan ini diterima?">
                        <fieldset className="@container">
                            <legend className="sr-only">Sumber laporan</legend>
                            <div className="space-y-4">
                                {SUMBER.map((g) => (
                                    <div key={g.group}>
                                        <p className="mb-2 text-xs font-semibold tracking-[0.06em] text-[var(--adm-text-3)] uppercase">{g.group}</p>
                                        <div className="grid grid-cols-2 gap-2 @xl:grid-cols-4">
                                            {g.items.map(({ value, label, icon: Icon }) => {
                                                const on = data.sumber_laporan === value;
                                                return (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        aria-pressed={on}
                                                        onClick={() => setData('sumber_laporan', value)}
                                                        className={cn(
                                                            'flex h-11 items-center gap-2 rounded-lg border px-3 text-left text-[13.5px] font-medium transition-colors',
                                                            on
                                                                ? 'border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] text-[var(--acd-link,var(--adm-primary))]'
                                                                : 'border-[var(--adm-border)] text-[var(--adm-text-2)] hover:border-[var(--adm-border-strong)] hover:text-[var(--adm-text)]',
                                                        )}
                                                    >
                                                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                                        <span className="truncate">{label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </fieldset>
                        <FieldError message={errors.sumber_laporan} />
                    </Step>

                    <Step no={2} title="Pelapor" hint="Siapa yang melapor dan bagaimana menghubunginya?">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label={medsos ? 'Nama / username akun' : 'Nama lengkap'} required error={errors.nama}>
                                <Input
                                    value={data.nama}
                                    onChange={(e) => setData('nama', e.target.value)}
                                    placeholder={medsos ? '@username' : 'Nama pelapor'}
                                />
                            </Field>
                            <Field label="NIK" error={errors.nik} hint={medsos ? 'Opsional untuk laporan media sosial.' : 'Opsional, 16 digit.'}>
                                <Input
                                    value={data.nik}
                                    onChange={(e) => setData('nik', e.target.value.replace(/\D/g, ''))}
                                    maxLength={16}
                                    inputMode="numeric"
                                    placeholder="16 digit NIK"
                                />
                            </Field>
                            <Field label="No. telepon / WhatsApp" error={errors.telepon} hint="Opsional. Untuk mengabari perkembangan tiket.">
                                <Input value={data.telepon} onChange={(e) => setData('telepon', e.target.value)} inputMode="tel" placeholder="08…" />
                            </Field>
                            {medsos && (
                                <Field label="Tautan unggahan" error={errors.tautan} hint="Tautan ke unggahan atau komentar warga.">
                                    <Input
                                        type="url"
                                        value={data.tautan}
                                        onChange={(e) => setData('tautan', e.target.value)}
                                        placeholder="https://instagram.com/p/…"
                                    />
                                </Field>
                            )}
                        </div>
                    </Step>

                    <Step no={3} title="Laporan" hint="Apa masalahnya, di mana, dan seberapa besar dampaknya?">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="Judul keluhan" required error={errors.judul} className="sm:col-span-2">
                                <Input
                                    value={data.judul}
                                    onChange={(e) => setData('judul', e.target.value)}
                                    placeholder="Mis. Jalan poros SP 3 rusak berat"
                                />
                            </Field>
                            <Field label="Uraian / kronologi" required error={errors.uraian} className="sm:col-span-2">
                                <Textarea
                                    value={data.uraian}
                                    onChange={(e) => setData('uraian', e.target.value)}
                                    rows={5}
                                    placeholder="Apa yang terjadi, sejak kapan, siapa yang terdampak…"
                                />
                            </Field>
                            <Field label="Provinsi asal pengaduan" required error={errors.provinsi}>
                                <Select value={data.provinsi} onValueChange={(v) => setData('provinsi', v)}>
                                    <SelectTrigger aria-label="Provinsi asal pengaduan">
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
                            <Field label="Kabupaten / kawasan / desa" error={errors.lokasi}>
                                <Input
                                    value={data.lokasi}
                                    onChange={(e) => setData('lokasi', e.target.value)}
                                    maxLength={150}
                                    placeholder="Mis. Kab. Merauke, SP 1 Kurik"
                                />
                            </Field>
                            <Field label="Kategori masalah" required error={errors.category_id} className="sm:col-span-2">
                                <Select value={data.category_id} onValueChange={(v) => setData('category_id', v)}>
                                    <SelectTrigger aria-label="Kategori masalah">
                                        <SelectValue placeholder="Pilih kategori" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {options.categories.map((c) => (
                                            <SelectItem key={c.id} value={String(c.id)}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>

                        <fieldset className="@container mt-5">
                            <legend className="mb-2 text-[13px] font-semibold text-[var(--adm-text)]">
                                Tingkat dampak <span className="text-[var(--adm-danger)]">*</span>
                            </legend>
                            <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-4">
                                {impacts.map((i) => {
                                    const on = data.impact === i.value;
                                    return (
                                        <button
                                            key={i.value}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() => setData('impact', i.value)}
                                            className={cn(
                                                'rounded-lg border p-3 text-left transition-colors',
                                                on
                                                    ? 'border-[var(--adm-primary)] bg-[var(--adm-primary-soft)]'
                                                    : 'border-[var(--adm-border)] hover:border-[var(--adm-border-strong)]',
                                            )}
                                        >
                                            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--adm-text)]">
                                                <span
                                                    className="h-2.5 w-2.5 rounded-full"
                                                    style={{ background: IMPACT_TONE[i.value] }}
                                                    aria-hidden="true"
                                                />
                                                {i.label}
                                            </span>
                                            <span className="mt-1 block text-xs text-[var(--adm-text-2)]">
                                                Respons {respons(i.respons_jam)} · selesai {i.selesai_hari} hari kerja
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            <FieldError message={errors.impact} />
                        </fieldset>

                        <div className="mt-5">
                            <p className="mb-2 text-[13px] font-semibold text-[var(--adm-text)]">Lampiran bukti</p>
                            <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-[var(--adm-border-strong)] bg-[var(--adm-surface-2)] px-4 py-4 transition-colors focus-within:border-[var(--adm-primary)] hover:border-[var(--adm-primary)]">
                                {data.attachment ? (
                                    <Paperclip className="h-5 w-5 shrink-0 text-[var(--acd-link,var(--adm-primary))]" aria-hidden="true" />
                                ) : (
                                    <Upload className="h-5 w-5 shrink-0 text-[var(--adm-text-3)]" aria-hidden="true" />
                                )}
                                <span className="min-w-0 flex-1 text-sm">
                                    <span className="block truncate font-medium text-[var(--adm-text)]">
                                        {data.attachment ? data.attachment.name : 'Pilih berkas foto atau PDF'}
                                    </span>
                                    <span className="block text-xs text-[var(--adm-text-2)]">Opsional · JPG, PNG, atau PDF · maks. 5 MB</span>
                                </span>
                                <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.pdf"
                                    className="sr-only"
                                    aria-label="Lampiran bukti"
                                    onChange={(e) => setData('attachment', e.target.files?.[0] ?? null)}
                                />
                            </label>
                            {progress && <p className="mt-1 text-xs text-[var(--acd-link,var(--adm-primary))]">Mengunggah… {progress.percentage}%</p>}
                            <FieldError message={errors.attachment} />
                        </div>
                    </Step>
                </div>

                {/* Ringkasan & kirim: menempel di layar lebar. */}
                <aside className="rounded-xl border border-[var(--adm-border)] bg-[var(--acd-surface,#fff)] p-5 lg:sticky lg:top-[88px]">
                    <h2 className="text-[15px] font-semibold text-[var(--adm-text)]">Kelengkapan</h2>
                    <ul className="mt-3 space-y-1.5 text-sm">
                        {checklist.map((c) => (
                            <li
                                key={c.label}
                                className={cn('flex items-center gap-2', c.done ? 'text-[var(--adm-text)]' : 'text-[var(--adm-text-2)]')}
                            >
                                {c.done ? (
                                    <Check className="h-4 w-4 shrink-0 text-[var(--adm-success)]" aria-hidden="true" />
                                ) : (
                                    <Circle className="h-4 w-4 shrink-0 text-[var(--adm-border-strong)]" aria-hidden="true" />
                                )}
                                {c.label}
                                <span className="sr-only">{c.done ? '(sudah diisi)' : '(belum diisi)'}</span>
                            </li>
                        ))}
                    </ul>

                    <dl className="mt-4 space-y-2 border-t border-[var(--adm-border)] pt-4 text-[13px]">
                        <div>
                            <dt className="text-xs text-[var(--adm-text-3)]">Diterima oleh</dt>
                            <dd className="font-medium text-[var(--adm-text)]">{auth?.user?.name ?? '—'}</dd>
                        </div>
                        {impact && (
                            <div>
                                <dt className="text-xs text-[var(--adm-text-3)]">Target penyelesaian</dt>
                                <dd className="font-medium text-[var(--adm-text)]">
                                    {impact.selesai_hari} hari kerja
                                    <span className="block text-xs font-normal text-[var(--adm-text-2)]">
                                        Bisa lebih ketat bila kategori punya SLA khusus.
                                    </span>
                                </dd>
                            </div>
                        )}
                    </dl>

                    <Button type="submit" disabled={processing} className="mt-5 h-11 w-full">
                        {processing ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <Check className="h-4 w-4" aria-hidden="true" />
                        )}
                        Terbitkan tiket
                    </Button>
                    <p className="mt-2 text-center text-xs text-[var(--adm-text-2)]" aria-live="polite">
                        {missing > 0 ? `${missing} isian wajib belum diisi` : 'Semua isian wajib lengkap'}
                    </p>
                </aside>
            </form>
        </AdminLayout>
    );
}

function Step({ no, title, hint, children }: { no: number; title: string; hint: string; children: ReactNode }) {
    return (
        <section className="rounded-xl border border-[var(--adm-border)] bg-[var(--acd-surface,#fff)]">
            <header className="flex items-start gap-3 border-b border-[var(--adm-border)] px-5 py-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--adm-primary)] text-sm font-semibold text-white">
                    {no}
                </span>
                <div>
                    <h2 className="text-[15px] font-semibold text-[var(--adm-text)]">{title}</h2>
                    <p className="text-[13px] text-[var(--adm-text-2)]">{hint}</p>
                </div>
            </header>
            <div className="p-5">{children}</div>
        </section>
    );
}

function Field({
    label,
    required,
    error,
    hint,
    className,
    children,
}: {
    label: string;
    required?: boolean;
    error?: string;
    hint?: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        // <label> pembungkus: label tertaut ke isian di dalamnya.
        <label className={cn('block space-y-1.5', className)}>
            <span className="block text-[13px] font-semibold text-[var(--adm-text)]">
                {label} {required && <span className="text-[var(--adm-danger)]">*</span>}
            </span>
            {children}
            {hint && !error && <span className="block text-xs text-[var(--adm-text-2)]">{hint}</span>}
            {error && <span className="block text-xs font-semibold text-[var(--adm-danger)]">{error}</span>}
        </label>
    );
}

function FieldError({ message }: { message?: string }) {
    return message ? <p className="mt-2 text-xs font-semibold text-[var(--adm-danger)]">{message}</p> : null;
}
