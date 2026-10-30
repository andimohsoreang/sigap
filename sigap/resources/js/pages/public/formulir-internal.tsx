import { RecaptchaNotice } from '@/components/sigap/recaptcha-notice';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useRecaptcha } from '@/hooks/use-recaptcha';
import PublicLayout from '@/layouts/public-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { AlertTriangle, Info, LoaderCircle, Send, Upload } from 'lucide-react';
import { type FormEvent } from 'react';

interface Props {
    units: string[];
    categories: string[];
}

const URGENSI = ['Rendah', 'Sedang', 'Tinggi', 'Kritis'];

export default function FormulirInternal({ units, categories }: Props) {
    const { data, setData, post, transform, processing, errors, progress } = useForm({
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
            post('/pengaduan/internal', { forceFormData: true });
        });
    };

    return (
        <PublicLayout title="Pengaduan Internal">
            <Head title="Pengaduan Internal Pegawai — Contact Center" />

            <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
                <p className="mb-6 text-sm text-gray-400">
                    <Link href="/" className="hover:text-brand-light">
                        Beranda
                    </Link>{' '}
                    &gt;{' '}
                    <Link href="/katalog" className="hover:text-brand-light">
                        Katalog Pengaduan
                    </Link>{' '}
                    &gt; <span className="text-gray-700">Pengaduan Internal Pegawai</span>
                </p>

                <div className="mb-4 flex items-start gap-2 rounded-lg border border-orange-100 bg-orange-50 px-4 py-3 text-xs text-gray-600">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                    <span>
                        Gunakan formulir ini hanya untuk kendala teknis internal kantor (mis. internet/jaringan mati, listrik padam, perangkat rusak).
                        Untuk pengaduan masyarakat, gunakan{' '}
                        <Link href="/pengaduan/baru" className="text-brand-light font-bold hover:underline">
                            Formulir Contact Center
                        </Link>
                        . Untuk indikasi pelanggaran/etik, laporkan ke Inspektorat Jenderal (itjen@transmigrasi.go.id) atau lewat PPID.
                    </span>
                </div>

                <Card className="border-gray-100">
                    <CardContent className="p-6 md:p-8">
                        <h1 className="mb-1 text-2xl font-bold text-gray-800">Pengaduan Internal Pegawai</h1>
                        <p className="mb-8 text-sm text-gray-500">Gangguan sarana &amp; TIK kantor — khusus pegawai Kementerian Transmigrasi</p>

                        <form onSubmit={submit} className="space-y-8">
                            <fieldset className="space-y-4">
                                <legend className="mb-2 text-sm font-bold tracking-wide text-gray-800 uppercase">Data Pegawai</legend>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <Field label="NIP / ID Pegawai" required error={errors.nip}>
                                        <Input value={data.nip} onChange={(e) => setData('nip', e.target.value)} />
                                    </Field>
                                    <Field label="Nama Lengkap" required error={errors.nama}>
                                        <Input value={data.nama} onChange={(e) => setData('nama', e.target.value)} />
                                    </Field>
                                    <Field label="Unit / Bagian" required error={errors.unit}>
                                        <Select value={data.unit} onValueChange={(v) => setData('unit', v)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih Unit / Bagian" />
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
                                    <Field label="No. Telp / Ekstensi" required error={errors.kontak}>
                                        <Input value={data.kontak} onChange={(e) => setData('kontak', e.target.value)} />
                                    </Field>
                                </div>
                            </fieldset>

                            <fieldset className="space-y-4">
                                <legend className="mb-2 text-sm font-bold tracking-wide text-gray-800 uppercase">Detail Gangguan</legend>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <Field label="Kategori Gangguan" required error={errors.kategori}>
                                        <Select value={data.kategori} onValueChange={(v) => setData('kategori', v)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih Kategori" />
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
                                    <Field label="Tingkat Urgensi" required error={errors.urgensi}>
                                        <Select value={data.urgensi} onValueChange={(v) => setData('urgensi', v)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih Urgensi" />
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
                                <Field label="Lokasi / Ruangan" required error={errors.lokasi}>
                                    <Input
                                        value={data.lokasi}
                                        onChange={(e) => setData('lokasi', e.target.value)}
                                        placeholder="Contoh: Gedung A, Lantai 2, Ruang TIK"
                                    />
                                </Field>
                                <Field label="Deskripsi Masalah" required error={errors.deskripsi}>
                                    <Textarea
                                        value={data.deskripsi}
                                        onChange={(e) => setData('deskripsi', e.target.value)}
                                        rows={5}
                                        placeholder="Jelaskan gangguan minimal 10 karakter..."
                                    />
                                </Field>
                                <Field label="Lampiran (Opsional)" error={errors.attachment}>
                                    <label className="hover:border-brand-light flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center transition">
                                        <Upload className="mb-2 h-6 w-6 text-gray-400" />
                                        <span className="text-sm text-gray-500">
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

                            <RecaptchaNotice enabled={recaptcha.enabled} error={recaptcha.error ?? errors.recaptcha_token} />

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                                    {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Kirim Laporan
                                </Button>
                                <Button asChild variant="outline" className="w-full sm:w-auto">
                                    <Link href="/katalog">Batal</Link>
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </PublicLayout>
    );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <Label className="text-gray-700">
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
