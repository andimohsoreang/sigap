import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import PublicLayout from '@/layouts/public-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { AlertTriangle, Crosshair, LoaderCircle, Send, Upload } from 'lucide-react';
import { type FormEvent } from 'react';

interface Option {
    id: number;
    name: string;
    province?: string | null;
}

interface Props {
    regions: (Option & { code: string })[];
    categories: Option[];
}

const IMPACTS = [
    { value: 'rendah', label: 'Rendah' },
    { value: 'sedang', label: 'Sedang' },
    { value: 'tinggi', label: 'Tinggi' },
    { value: 'kritis', label: 'Kritis' },
];

const VISIBILITIES = [
    { value: 'publik', label: 'Publik', desc: 'Identitas tidak disembunyikan.' },
    { value: 'anonim', label: 'Anonim', desc: 'Nama disembunyikan.' },
    { value: 'rahasia', label: 'Rahasia', desc: 'Laporan disembunyikan dari publik.' },
];

export default function FormulirPengaduan({ regions, categories }: Props) {
    const { data, setData, post, processing, errors, progress } = useForm({
        nik: '',
        nama: '',
        email: '',
        telepon: '',
        judul: '',
        uraian: '',
        koordinat: '',
        region_id: '',
        category_id: '',
        impact: '',
        visibility: 'publik',
        attachment: null as File | null,
        agree: false,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/pengaduan/baru', { forceFormData: true });
    };

    const useGeolocation = () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition((pos) => {
            setData('koordinat', `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`);
        });
    };

    return (
        <PublicLayout title="Formulir SIGAP">
            <Head title="Formulir Pengaduan — SIGAP" />

            <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
                <p className="mb-6 text-sm text-gray-400">
                    <Link href="/" className="hover:text-brand-light">
                        Beranda
                    </Link>{' '}
                    &gt;{' '}
                    <Link href="/katalog" className="hover:text-brand-light">
                        Katalog Pengaduan
                    </Link>{' '}
                    &gt; <span className="text-gray-700 dark:text-gray-300">Formulir SIGAP</span>
                </p>

                <Card className="dark:bg-dark-card border-gray-100 dark:border-gray-800">
                    <CardContent className="p-6 md:p-8">
                        <h1 className="text-primary dark:text-brand-light mb-1 text-2xl font-bold">Silakan lengkapi formulir aduan</h1>
                        <p className="mb-8 text-sm text-gray-500 dark:text-gray-400">
                            Anda tetap bisa mengajukan pengaduan tanpa login. Sertakan detail lokasi &amp; bukti agar cepat ditindaklanjuti.
                        </p>

                        <form onSubmit={submit} className="space-y-8">
                            {/* DATA PELAPOR */}
                            <fieldset className="space-y-4">
                                <legend className="mb-2 text-sm font-bold tracking-wide text-gray-800 uppercase dark:text-white">Data Pelapor</legend>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <Field label="NIK (KTP)" htmlFor="nik" required error={errors.nik}>
                                        <Input
                                            id="nik"
                                            name="nik"
                                            value={data.nik}
                                            onChange={(e) => setData('nik', e.target.value)}
                                            inputMode="numeric"
                                            maxLength={16}
                                            placeholder="16 digit"
                                        />
                                    </Field>
                                    <Field label="Nama Lengkap" htmlFor="nama" required error={errors.nama}>
                                        <Input id="nama" name="nama" value={data.nama} onChange={(e) => setData('nama', e.target.value)} />
                                    </Field>
                                    <Field label="Email" htmlFor="email" error={errors.email}>
                                        <Input
                                            id="email"
                                            name="email"
                                            type="email"
                                            value={data.email}
                                            onChange={(e) => setData('email', e.target.value)}
                                        />
                                    </Field>
                                    <Field label="No. Telepon / WA" htmlFor="telepon" error={errors.telepon}>
                                        <Input
                                            id="telepon"
                                            name="telepon"
                                            value={data.telepon}
                                            onChange={(e) => setData('telepon', e.target.value)}
                                        />
                                    </Field>
                                </div>
                            </fieldset>

                            {/* DETAIL LAPORAN */}
                            <fieldset className="space-y-4">
                                <legend className="mb-2 text-sm font-bold tracking-wide text-gray-800 uppercase dark:text-white">
                                    Detail Laporan
                                </legend>
                                <Field label="Judul Laporan" htmlFor="judul" required error={errors.judul}>
                                    <Input id="judul" name="judul" value={data.judul} onChange={(e) => setData('judul', e.target.value)} />
                                </Field>
                                <Field label="Uraian Laporan" htmlFor="uraian" required error={errors.uraian}>
                                    <Textarea
                                        id="uraian"
                                        name="uraian"
                                        value={data.uraian}
                                        onChange={(e) => setData('uraian', e.target.value)}
                                        rows={5}
                                        placeholder="Jelaskan aduan minimal 10 karakter..."
                                    />
                                </Field>
                                <Field label="Titik Koordinat (GPS)" htmlFor="koordinat" error={errors.koordinat}>
                                    <div className="flex gap-2">
                                        <Input
                                            id="koordinat"
                                            name="koordinat"
                                            value={data.koordinat}
                                            onChange={(e) => setData('koordinat', e.target.value)}
                                            placeholder="-8.4991,140.4011"
                                        />
                                        <Button type="button" variant="outline" onClick={useGeolocation}>
                                            <Crosshair className="h-4 w-4" /> GPS
                                        </Button>
                                    </div>
                                </Field>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <Field label="Lokasi Kawasan" htmlFor="region_id" error={errors.region_id}>
                                        <Select value={data.region_id} onValueChange={(v) => setData('region_id', v)}>
                                            <SelectTrigger aria-label="Lokasi Kawasan">
                                                <SelectValue placeholder="Pilih Kawasan" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {regions.map((r) => (
                                                    <SelectItem key={r.id} value={String(r.id)}>
                                                        {r.name}
                                                        {r.province ? `, ${r.province}` : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                    <Field label="Kategori" htmlFor="category_id" error={errors.category_id}>
                                        <Select value={data.category_id} onValueChange={(v) => setData('category_id', v)}>
                                            <SelectTrigger aria-label="Kategori">
                                                <SelectValue placeholder="Pilih Kategori" />
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
                                </div>
                                <Field label="Tingkat Dampak" htmlFor="impact" required error={errors.impact}>
                                    <Select value={data.impact} onValueChange={(v) => setData('impact', v)}>
                                        <SelectTrigger aria-label="Tingkat Dampak">
                                            <SelectValue placeholder="Pilih Tingkat Dampak" />
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
                            </fieldset>

                            {/* PRIVASI & LAMPIRAN */}
                            <fieldset className="space-y-4">
                                <legend className="mb-2 text-sm font-bold tracking-wide text-gray-800 uppercase dark:text-white">
                                    Privasi &amp; Lampiran
                                </legend>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    {VISIBILITIES.map((v) => (
                                        <button
                                            key={v.value}
                                            type="button"
                                            onClick={() => setData('visibility', v.value)}
                                            className={`rounded-xl border p-4 text-left transition ${
                                                data.visibility === v.value
                                                    ? 'border-primary bg-brand-soft/60 dark:bg-gray-800'
                                                    : 'hover:border-brand-light border-gray-200 dark:border-gray-700'
                                            }`}
                                        >
                                            <p className="font-bold text-gray-800 dark:text-white">{v.label}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{v.desc}</p>
                                        </button>
                                    ))}
                                </div>
                                <Field label="Lampiran Bukti (Opsional)" error={errors.attachment}>
                                    <label className="hover:border-brand-light flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center transition dark:border-gray-600 dark:bg-gray-800">
                                        <Upload className="mb-2 h-6 w-6 text-gray-400" />
                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                            {data.attachment ? data.attachment.name : 'Klik untuk unggah (JPG/PNG/PDF, maks. 5 MB)'}
                                        </span>
                                        <input
                                            type="file"
                                            accept=".jpg,.jpeg,.png,.pdf"
                                            className="hidden"
                                            onChange={(e) => setData('attachment', e.target.files?.[0] ?? null)}
                                        />
                                    </label>
                                    {progress && <p className="text-brand-light mt-2 text-xs">Mengunggah… {progress.percentage}%</p>}
                                </Field>
                            </fieldset>

                            {/* RECAPTCHA (placeholder, belum diaktifkan) */}
                            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                                <div className="flex h-6 w-6 items-center justify-center rounded border border-gray-300">
                                    <Checkbox disabled />
                                </div>
                                I'm not a robot — <span className="font-bold">reCAPTCHA</span>
                                <span className="ml-auto text-xs italic">(belum diaktifkan)</span>
                            </div>

                            <label className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
                                <Checkbox
                                    aria-label="Pernyataan benar"
                                    checked={data.agree}
                                    onCheckedChange={(v) => setData('agree', Boolean(v))}
                                    className="mt-0.5"
                                />
                                <span>
                                    Saya menyatakan bahwa informasi ini benar dan menyetujui{' '}
                                    <Link href="/syarat-ketentuan" className="text-brand-light font-bold hover:underline">
                                        Syarat &amp; Ketentuan
                                    </Link>{' '}
                                    serta{' '}
                                    <Link href="/kebijakan-privasi" className="text-brand-light font-bold hover:underline">
                                        Kebijakan Privasi
                                    </Link>{' '}
                                    SIGAP.
                                </span>
                            </label>

                            <Button type="submit" disabled={processing || !data.agree} className="w-full md:w-auto">
                                {processing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Kirim Pengaduan
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </PublicLayout>
    );
}

function Field({
    label,
    htmlFor,
    required,
    error,
    children,
}: {
    label: string;
    htmlFor?: string;
    required?: boolean;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={htmlFor} className="text-gray-700 dark:text-gray-300">
                {label} {required && <span className="text-rose-500">*</span>}
            </Label>
            {children}
            {error && (
                <p className="text-destructive flex items-center gap-1 text-sm">
                    <AlertTriangle className="h-3.5 w-3.5" /> {error}
                </p>
            )}
        </div>
    );
}
