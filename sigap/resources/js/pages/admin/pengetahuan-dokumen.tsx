import { Link, router, useForm } from '@inertiajs/react';
import { AlertTriangle, Check, ExternalLink, FileText, LoaderCircle, RotateCcw, Trash2, Upload } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AdminLayout from '@/layouts/admin-layout';
import { cn } from '@/lib/utils';

type Status = 'diproses' | 'siap' | 'gagal';

interface DocumentRow {
    id: number;
    nama: string;
    status: Status;
    halaman: number | null;
    usulan: number;
    tersimpan: number;
    pengunggah: string | null;
    diunggah: string | null;
}

interface Proposal {
    id: number;
    judul: string;
    jawaban: string;
    kategori: string | null;
    halaman: number;
    cek_angka: boolean;
    mirip: { id: number; judul: string } | null;
    tersimpan: boolean;
}

interface Selected {
    id: number;
    nama: string;
    status: Status;
    error: string | null;
    halaman: number | null;
    ukuran: number;
    berkas_url: string;
    usulan: Proposal[];
}

interface Props {
    documents: DocumentRow[];
    selected: Selected | null;
    can_delete: boolean;
}

interface Draft extends Proposal {
    pilih: boolean;
}

const STEPS = ['Unggah dokumen', 'Tinjau usulan AI', 'Simpan sebagai draf'];

export default function PengetahuanDokumen({ documents, selected, can_delete: canDelete }: Props) {
    const upload = useForm<{ dokumen: File | null }>({ dokumen: null });
    const [drafts, setDrafts] = useState<Draft[]>([]);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    // Isi ulang daftar usulan saat dokumen terpilih atau usulannya berubah.
    const proposalKey = selected ? `${selected.id}:${selected.status}:${selected.usulan.length}` : '';
    useEffect(() => {
        setDrafts((selected?.usulan ?? []).map((p) => ({ ...p, pilih: !p.tersimpan && !p.mirip })));
        setConfirmDelete(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [proposalKey]);

    // Selama AI membaca dokumen, muat ulang berkala.
    useEffect(() => {
        if (selected?.status !== 'diproses') return;
        const timer = window.setInterval(() => router.reload({ only: ['documents', 'selected'] }), 3000);
        return () => window.clearInterval(timer);
    }, [selected?.status, selected?.id]);

    const chosen = useMemo(() => drafts.filter((d) => d.pilih && !d.tersimpan), [drafts]);
    const step = !selected ? 0 : selected.status === 'siap' ? 1 : 0;

    const submitUpload = (e: FormEvent) => {
        e.preventDefault();
        upload.post('/admin/pengetahuan/dokumen', { forceFormData: true, onSuccess: () => upload.reset() });
    };

    const update = (id: number, patch: Partial<Draft>) => setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));

    const save = () => {
        if (!selected || chosen.length === 0) return;
        setSaving(true);
        router.post(
            `/admin/pengetahuan/dokumen/${selected.id}/simpan`,
            { usulan: chosen.map(({ id, judul, jawaban, kategori }) => ({ id, judul, jawaban, kategori })) },
            { onFinish: () => setSaving(false) },
        );
    };

    return (
        <AdminLayout
            title="Buat artikel dari dokumen resmi"
            subtitle="AI merangkum dokumen menjadi tanya-jawab. Setiap usulan menyebut halaman sumbernya dan masuk sebagai draf untuk ditinjau."
            actions={
                <Button variant="outline" size="sm" asChild>
                    <Link href="/admin/pengetahuan">Kembali ke Basis Pengetahuan</Link>
                </Button>
            }
        >
            <ol aria-label="Langkah" className="mb-6 flex flex-wrap gap-2 text-xs font-semibold">
                {STEPS.map((label, i) => (
                    <li
                        key={label}
                        aria-current={i === step ? 'step' : undefined}
                        className={cn(
                            'flex items-center gap-2 rounded-full px-3.5 py-2',
                            i < step && 'bg-brand-soft text-primary',
                            i === step && 'bg-primary text-white',
                            i > step && 'bg-gray-100 text-gray-600',
                        )}
                    >
                        <span
                            className={cn(
                                'flex h-5 w-5 items-center justify-center rounded-full text-[11px]',
                                i < step ? 'bg-primary text-white' : i === step ? 'text-primary bg-white' : 'bg-gray-300 text-gray-700',
                            )}
                        >
                            {i < step ? <Check className="h-3 w-3" /> : i + 1}
                        </span>
                        {label}
                    </li>
                ))}
            </ol>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
                {/* Kiri: unggah + daftar dokumen */}
                <div className="space-y-6">
                    <Card className="border-gray-200">
                        <CardHeader className="border-b border-gray-100 pb-3">
                            <CardTitle className="flex items-center gap-2 text-sm font-bold text-gray-800">
                                <Upload className="text-brand-light h-4 w-4" /> Unggah PDF resmi
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 p-4">
                            <form onSubmit={submitUpload} className="space-y-3">
                                <label htmlFor="dokumen" className="sr-only">
                                    Berkas PDF
                                </label>
                                <Input
                                    id="dokumen"
                                    type="file"
                                    accept="application/pdf"
                                    onChange={(e) => upload.setData('dokumen', e.target.files?.[0] ?? null)}
                                />
                                {upload.errors.dokumen && <p className="text-xs font-semibold text-rose-600">{upload.errors.dokumen}</p>}
                                <Button type="submit" disabled={!upload.data.dokumen || upload.processing} className="w-full">
                                    {upload.processing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Unggah &
                                    proses
                                </Button>
                            </form>
                            <p className="text-xs text-gray-500">
                                Pedoman, regulasi, atau SOP berbentuk PDF teks (maks. 20 MB). Dokumen hasil pindai belum didukung.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-gray-200">
                        <CardHeader className="border-b border-gray-100 pb-3">
                            <CardTitle className="text-sm font-bold text-gray-800">Dokumen terunggah</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {documents.length === 0 ? (
                                <p className="p-4 text-sm text-gray-500">Belum ada dokumen.</p>
                            ) : (
                                <ul className="divide-y divide-gray-100">
                                    {documents.map((d) => (
                                        <li key={d.id}>
                                            <button
                                                type="button"
                                                onClick={() => router.get('/admin/pengetahuan/dokumen', { dokumen: d.id }, { preserveScroll: true })}
                                                className={cn(
                                                    'flex w-full items-start gap-3 border-l-4 p-3 text-left hover:bg-gray-50',
                                                    selected?.id === d.id ? 'border-l-brand-light bg-gray-50' : 'border-l-transparent',
                                                )}
                                            >
                                                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-semibold text-gray-800">{d.nama}</span>
                                                    <span className="block text-xs text-gray-500">
                                                        {d.halaman ? `${d.halaman} halaman · ` : ''}
                                                        {d.status === 'siap'
                                                            ? `${d.usulan} usulan · ${d.tersimpan} tersimpan`
                                                            : d.status === 'gagal'
                                                              ? 'Gagal diproses'
                                                              : 'Sedang diproses…'}
                                                    </span>
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Kanan: usulan */}
                <div className="min-w-0 space-y-4">
                    {!selected ? (
                        <Card className="border-gray-200">
                            <CardContent className="p-8 text-center text-sm text-gray-500">Unggah dokumen untuk mulai.</CardContent>
                        </Card>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className="flex h-12 w-10 shrink-0 items-end justify-center rounded bg-rose-100 pb-1.5 text-[10px] font-extrabold text-rose-700">
                                        PDF
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate font-bold text-gray-800">{selected.nama}</p>
                                        <p className="text-xs text-gray-500">
                                            {selected.halaman ? `${selected.halaman} halaman · ` : ''}
                                            {(selected.ukuran / 1024 / 1024).toFixed(1)} MB
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" asChild>
                                        <a href={selected.berkas_url} target="_blank" rel="noreferrer">
                                            <ExternalLink className="h-4 w-4" /> Buka PDF
                                        </a>
                                    </Button>
                                    {canDelete &&
                                        (confirmDelete ? (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-rose-600"
                                                    onClick={() => router.delete(`/admin/pengetahuan/dokumen/${selected.id}`)}
                                                >
                                                    Yakin hapus
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                                                    Batal
                                                </Button>
                                            </>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-rose-600"
                                                onClick={() => setConfirmDelete(true)}
                                                aria-label="Hapus dokumen"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        ))}
                                </div>
                            </div>

                            {selected.status === 'diproses' && (
                                <Card className="border-gray-200">
                                    <CardContent className="flex items-center gap-3 p-6 text-sm text-gray-700" role="status">
                                        <LoaderCircle className="text-brand-light h-5 w-5 animate-spin" /> AI sedang membaca dokumen dan menyusun
                                        usulan artikel…
                                    </CardContent>
                                </Card>
                            )}

                            {selected.status === 'gagal' && (
                                <Card className="border-rose-200 bg-rose-50">
                                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-rose-800">
                                        <span className="flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4" /> {selected.error ?? 'Dokumen gagal diproses.'}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => router.post(`/admin/pengetahuan/dokumen/${selected.id}/ulang`)}
                                        >
                                            <RotateCcw className="h-4 w-4" /> Proses ulang
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}

                            {selected.status === 'siap' && (
                                <>
                                    <p className="text-brand-light flex items-center gap-2 text-sm font-bold">
                                        <span className="bg-brand-light h-0.5 w-4" /> Usulan artikel dari AI · {drafts.length}
                                    </p>

                                    {drafts.length === 0 && (
                                        <Card className="border-gray-200">
                                            <CardContent className="p-6 text-sm text-gray-500">
                                                AI tidak menemukan bagian yang relevan untuk warga di dokumen ini.
                                            </CardContent>
                                        </Card>
                                    )}

                                    {drafts.map((d) => (
                                        <article
                                            key={d.id}
                                            className={cn(
                                                'flex gap-3 rounded-xl border bg-white p-4',
                                                d.pilih && !d.tersimpan ? 'border-brand-light border-2' : 'border-gray-200',
                                                d.tersimpan && 'opacity-60',
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={d.pilih && !d.tersimpan}
                                                disabled={d.tersimpan}
                                                onChange={(e) => update(d.id, { pilih: e.target.checked })}
                                                aria-label={`Pilih usulan: ${d.judul}`}
                                                className="accent-primary mt-1.5 h-4 w-4 shrink-0"
                                            />
                                            <div className="min-w-0 flex-1 space-y-2">
                                                <Input
                                                    value={d.judul}
                                                    disabled={d.tersimpan}
                                                    onChange={(e) => update(d.id, { judul: e.target.value })}
                                                    aria-label="Judul (pertanyaan warga)"
                                                    className="font-semibold"
                                                />
                                                <Textarea
                                                    value={d.jawaban}
                                                    disabled={d.tersimpan}
                                                    onChange={(e) => update(d.id, { jawaban: e.target.value })}
                                                    rows={3}
                                                    aria-label="Jawaban"
                                                    className="text-sm"
                                                />
                                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                                                    <a
                                                        href={`${selected.berkas_url}#page=${d.halaman}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900 hover:underline"
                                                    >
                                                        Hal. {d.halaman}
                                                    </a>
                                                    {d.kategori && (
                                                        <span className="bg-brand-soft text-primary rounded-full px-2.5 py-1">
                                                            Kategori: {d.kategori}
                                                        </span>
                                                    )}
                                                    {d.cek_angka && (
                                                        <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-800">Cek angka/tanggal</span>
                                                    )}
                                                    {d.mirip && (
                                                        <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-800">
                                                            Mirip artikel terbit: “{d.mirip.judul}”
                                                        </span>
                                                    )}
                                                    {d.tersimpan && (
                                                        <span className="rounded-full bg-green-100 px-2.5 py-1 text-green-800">Sudah disimpan</span>
                                                    )}
                                                </div>
                                            </div>
                                        </article>
                                    ))}

                                    {drafts.length > 0 && (
                                        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
                                            <span className="text-sm text-gray-600">
                                                <b className="text-gray-900">
                                                    {chosen.length} dari {drafts.filter((d) => !d.tersimpan).length}
                                                </b>{' '}
                                                dipilih · masuk sebagai <b className="text-gray-900">draf</b>, belum dipakai AI
                                            </span>
                                            <Button onClick={save} disabled={saving || chosen.length === 0} className="rounded-full">
                                                {saving && <LoaderCircle className="h-4 w-4 animate-spin" />} Simpan {chosen.length} sebagai draf
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
