import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AdminLayout from '@/layouts/admin-layout';
import { type SharedData } from '@/types';
import { useForm, usePage } from '@inertiajs/react';
import { Building2, CheckCircle, FilePen, LoaderCircle, Upload, UserRound } from 'lucide-react';
import { type FormEvent } from 'react';

interface Props {
    options: {
        regions: { id: number; name: string; province: string | null }[];
        categories: { id: number; name: string }[];
    };
    /** A-11: admin kawasan tidak dapat memilih kawasan (dipaksa server). */
    region_locked?: boolean;
    own_region?: { id: number; name: string } | null;
}

const SUMBER = [
    {
        group: 'Offline',
        items: [
            { value: 'tatap_muka', label: 'Datang Langsung (Tatap Muka)' },
            { value: 'call_center', label: 'Telepon Call Center' },
            { value: 'surat', label: 'Surat Fisik / Pos' },
        ],
    },
    {
        group: 'Media Sosial',
        items: [
            { value: 'instagram', label: 'Instagram' },
            { value: 'x', label: 'X / Twitter' },
            { value: 'facebook', label: 'Facebook' },
            { value: 'tiktok', label: 'TikTok' },
        ],
    },
];

export default function InputManual({ options, region_locked: regionLocked = false, own_region: ownRegion = null }: Props) {
    const { auth } = usePage<SharedData>().props;
    const { data, setData, post, processing, errors, progress } = useForm({
        sumber_laporan: '',
        nik: '',
        nama: '',
        telepon: '',
        tautan: '',
        judul: '',
        uraian: '',
        region_id: regionLocked && ownRegion ? String(ownRegion.id) : '',
        category_id: '',
        impact: '',
        attachment: null as File | null,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/admin/input-manual', { forceFormData: true });
    };

    return (
        <AdminLayout title="Input Pengaduan Manual" subtitle="Penerimaan laporan offline & media sosial.">
            <Card className="border-gray-200">
                <CardContent className="p-6 md:p-8">
                    <form onSubmit={submit} className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
                        <SectionTitle icon={Building2} title="Info Penerimaan Laporan" />
                        <Field label="Sumber Laporan" required error={errors.sumber_laporan}>
                            <Select value={data.sumber_laporan} onValueChange={(v) => setData('sumber_laporan', v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Sumber" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SUMBER.map((g) => (
                                        <div key={g.group}>
                                            <p className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase">{g.group}</p>
                                            {g.items.map((it) => (
                                                <SelectItem key={it.value} value={it.value}>
                                                    {it.label}
                                                </SelectItem>
                                            ))}
                                        </div>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Admin / Agen Penerima">
                            {/* Hanya tampilan: server selalu mencatat akun yang login. */}
                            <Input value={auth?.user?.name ?? ''} readOnly aria-readonly className="cursor-not-allowed bg-gray-100" />
                        </Field>

                        <SectionTitle icon={UserRound} title="Data Pelapor / Akun" />
                        <Field label="NIK KTP (Opsional jika via Medsos)" error={errors.nik}>
                            <Input
                                value={data.nik}
                                onChange={(e) => setData('nik', e.target.value)}
                                maxLength={16}
                                inputMode="numeric"
                                placeholder="16 Digit NIK"
                            />
                        </Field>
                        <Field label="Nama Lengkap / Username" required error={errors.nama}>
                            <Input value={data.nama} onChange={(e) => setData('nama', e.target.value)} placeholder="Nama Pelapor / @username" />
                        </Field>
                        <Field label="No. Telp / WA (Opsional)" error={errors.telepon}>
                            <Input value={data.telepon} onChange={(e) => setData('telepon', e.target.value)} placeholder="08..." />
                        </Field>
                        <Field label="Tautan / URL (Khusus Medsos)" error={errors.tautan}>
                            <Input
                                value={data.tautan}
                                onChange={(e) => setData('tautan', e.target.value)}
                                placeholder="https://instagram.com/p/..."
                            />
                        </Field>

                        <SectionTitle icon={FilePen} title="Detail Laporan & Bukti" />
                        <div className="md:col-span-2">
                            <Field label="Judul Keluhan" required error={errors.judul}>
                                <Input value={data.judul} onChange={(e) => setData('judul', e.target.value)} placeholder="Judul Laporan" />
                            </Field>
                        </div>
                        <div className="md:col-span-2">
                            <Field label="Uraian / Kronologi" required error={errors.uraian}>
                                <Textarea
                                    value={data.uraian}
                                    onChange={(e) => setData('uraian', e.target.value)}
                                    rows={4}
                                    placeholder="Catat detail keluhan warga..."
                                />
                            </Field>
                        </div>

                        <Field label="Kawasan Transmigrasi" required error={errors.region_id}>
                            {regionLocked ? (
                                <>
                                    <Input
                                        value={ownRegion?.name ?? 'Kawasan belum ditetapkan'}
                                        readOnly
                                        aria-label="Kawasan Transmigrasi"
                                        className="cursor-not-allowed bg-gray-100"
                                    />
                                    <p className="text-[11px] text-gray-400">Tiket otomatis diterbitkan ke kawasan tugas Anda.</p>
                                </>
                            ) : (
                                <Select value={data.region_id} onValueChange={(v) => setData('region_id', v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih Kawasan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {options.regions.map((r) => (
                                            <SelectItem key={r.id} value={String(r.id)}>
                                                {r.name}
                                                {r.province ? `, ${r.province}` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </Field>
                        <Field label="Kategori Masalah" required error={errors.category_id}>
                            <Select value={data.category_id} onValueChange={(v) => setData('category_id', v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Kategori" />
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
                        <Field label="Tingkat Dampak" required error={errors.impact}>
                            <Select value={data.impact} onValueChange={(v) => setData('impact', v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Dampak" />
                                </SelectTrigger>
                                <SelectContent>
                                    {['rendah', 'sedang', 'tinggi', 'kritis'].map((v) => (
                                        <SelectItem key={v} value={v}>
                                            {v.charAt(0).toUpperCase() + v.slice(1)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Lampiran Bukti (Opsional)" error={errors.attachment}>
                            <label className="hover:border-brand-light flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center transition">
                                <Upload className="mb-2 h-6 w-6 text-gray-400" />
                                <span className="text-sm text-gray-500">
                                    {data.attachment ? data.attachment.name : 'Klik untuk unggah (Maks. 5 MB)'}
                                </span>
                                <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.pdf"
                                    className="hidden"
                                    onChange={(e) => setData('attachment', e.target.files?.[0] ?? null)}
                                />
                            </label>
                            {progress && <p className="text-brand-light text-xs">Mengunggah… {progress.percentage}%</p>}
                        </Field>

                        <div className="mt-4 flex justify-end md:col-span-2">
                            <Button type="submit" disabled={processing}>
                                {processing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Terbitkan Tiket
                                Sistem
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </AdminLayout>
    );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Building2; title: string }) {
    return (
        <div className="mb-1 border-b border-gray-100 pb-2 md:col-span-2">
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800">
                <Icon className="text-brand-light h-5 w-5" /> {title}
            </h3>
        </div>
    );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">
                {label} {required && <span className="text-red-500">*</span>}
            </Label>
            {children}
            {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
        </div>
    );
}
