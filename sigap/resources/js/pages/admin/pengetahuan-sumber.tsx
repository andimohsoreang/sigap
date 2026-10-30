import { Link, router, useForm } from '@inertiajs/react';
import { AlertTriangle, ExternalLink, FileText, Globe, LoaderCircle, Plus, RefreshCw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';

import { LegalBasisFields, legalBasisFrom, STATUS_DASAR_LABEL, type StatusDasar } from '@/components/sigap/legal-basis-fields';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AdminLayout from '@/layouts/admin-layout';
import { cn } from '@/lib/utils';

type Status = 'antre' | 'diproses' | 'siap' | 'gagal';

interface SourceRow {
    id: number;
    jenis: 'situs' | 'berkas';
    nama: string;
    url: string | null;
    berkas_url: string | null;
    dokumen_id: number | null;
    aktif: boolean;
    ikuti_tautan: boolean;
    tampil_berkas: boolean;
    status: Status;
    gagal: string | null;
    halaman: number;
    jumlah_kutipan: number;
    dipakai: number;
    diambil: string | null;
    berubah: string | null;
    dasar_hukum: string | null;
    tanggal_dasar: string | null;
    status_dasar: StatusDasar | null;
    diganti_oleh: string | null;
}

interface Passage {
    id: number;
    judul: string;
    isi: string;
    halaman: number | null;
    url: string | null;
}

interface Selected extends SourceRow {
    error: string | null;
    kutipan: Passage[];
}

interface ProbeHit {
    id: number;
    judul: string;
    label: string;
    isi: string;
    url: string | null;
    sumber_id: number;
    skor: number | null;
}

interface Props {
    sources: SourceRow[];
    selected: Selected | null;
    probe: { question: string; results: ProbeHit[] } | null;
    allowed_hosts: string[];
    can_delete: boolean;
}

const STATUS_LABEL: Record<Status, string> = { antre: 'Menunggu', diproses: 'Sedang diambil', siap: 'Siap', gagal: 'Gagal' };

export default function PengetahuanSumber({ sources, selected, probe, allowed_hosts: allowedHosts, can_delete: canDelete }: Props) {
    const form = useForm<{ url: string; nama: string; ikuti_tautan: boolean }>({ url: '', nama: '', ikuti_tautan: false });
    const busy = sources.some((s) => s.status === 'antre' || s.status === 'diproses');

    // Selama ada sumber yang sedang diambil, muat ulang berkala.
    useEffect(() => {
        if (!busy) return;
        const timer = window.setInterval(() => router.reload({ only: ['sources', 'selected'] }), 4000);
        return () => window.clearInterval(timer);
    }, [busy]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post('/admin/pengetahuan/sumber', { onSuccess: () => form.reset() });
    };

    const sites = sources.filter((s) => s.jenis === 'situs');
    const files = sources.filter((s) => s.jenis === 'berkas');
    const totalPassages = sources.filter((s) => s.aktif).reduce((n, s) => n + s.jumlah_kutipan, 0);

    return (
        <AdminLayout
            title="Sumber Resmi"
            subtitle="Situs dan berkas resmi Kementerian Transmigrasi yang dikutip langsung oleh asisten AI. Setiap jawaban menyebut alamat, halaman, dan tanggal pengambilannya."
            actions={
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => router.post('/admin/pengetahuan/sumber/sinkron')} disabled={busy}>
                        <RefreshCw className={cn('h-4 w-4', busy && 'animate-spin')} /> Ambil ulang semua situs
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/admin/pengetahuan">Kembali ke Basis Pengetahuan</Link>
                    </Button>
                </div>
            }
        >
            <div className="mb-6 flex flex-wrap items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <p className="min-w-0 flex-1">
                    <strong>{totalPassages.toLocaleString('id-ID')} kutipan aktif</strong> dari {sources.filter((s) => s.aktif).length} sumber. Hanya
                    situs <span className="font-semibold">{allowedHosts.join(', ')}</span> (dan subdomainnya) yang dapat didaftarkan. Situs diambil
                    ulang otomatis tiap Senin dini hari; kutipan diganti hanya bila isinya berubah. Artikel Basis Pengetahuan yang sudah terbit tetap
                    diutamakan.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="space-y-6">
                    <Card className="border-gray-200">
                        <CardHeader className="border-b border-gray-100 pb-3">
                            <CardTitle className="flex items-center gap-2 text-sm font-bold text-gray-800">
                                <Plus className="text-brand-light h-4 w-4" /> Tambah situs resmi
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            <form onSubmit={submit} className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="url" className="text-xs font-bold text-gray-600">
                                        Alamat halaman <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="url"
                                        value={form.data.url}
                                        onChange={(e) => form.setData('url', e.target.value)}
                                        placeholder="https://ppid.transmigrasi.go.id/faq"
                                        inputMode="url"
                                    />
                                    {form.errors.url && <p className="text-xs font-semibold text-rose-600">{form.errors.url}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="nama" className="text-xs font-bold text-gray-600">
                                        Nama (opsional)
                                    </Label>
                                    <Input
                                        id="nama"
                                        value={form.data.nama}
                                        onChange={(e) => form.setData('nama', e.target.value)}
                                        placeholder="Mis. PPID — Tanya Jawab"
                                    />
                                </div>
                                <label className="flex items-start gap-2 text-sm text-gray-700">
                                    <Checkbox checked={form.data.ikuti_tautan} onCheckedChange={(v) => form.setData('ikuti_tautan', v === true)} />
                                    <span>
                                        Ikuti tautan di bagian yang sama
                                        <span className="block text-xs text-gray-500">
                                            Ambil juga halaman lain di bawah alamat ini serta PDF/DOCX yang ditautkan (maks. 25 halaman).
                                        </span>
                                    </span>
                                </label>
                                <Button type="submit" className="w-full" disabled={!form.data.url || form.processing}>
                                    {form.processing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Tambah &
                                    ambil
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <SourceList title="Situs resmi" icon={Globe} items={sites} selectedId={selected?.id} empty="Belum ada situs." />
                    <SourceList
                        title="Berkas unggahan"
                        icon={FileText}
                        items={files}
                        selectedId={selected?.id}
                        empty="Belum ada. Berkas yang diunggah di halaman dokumen resmi otomatis masuk ke sini."
                    />
                </div>

                <div className="min-w-0 space-y-6">
                    {selected && <SourceDetail source={selected} canDelete={canDelete} />}
                    <ProbeCard probe={probe} />
                </div>
            </div>
        </AdminLayout>
    );
}

function SourceList({
    title,
    icon: Icon,
    items,
    selectedId,
    empty,
}: {
    title: string;
    icon: typeof Globe;
    items: SourceRow[];
    selectedId?: number;
    empty: string;
}) {
    return (
        <Card className="border-gray-200">
            <CardHeader className="border-b border-gray-100 pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold text-gray-800">
                    <Icon className="text-brand-light h-4 w-4" /> {title}{' '}
                    <span className="text-xs font-semibold text-gray-500">({items.length})</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {items.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500">{empty}</p>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {items.map((s) => (
                            <li key={s.id}>
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.get('/admin/pengetahuan/sumber', { sumber: s.id }, { preserveScroll: true, preserveState: true })
                                    }
                                    className={cn(
                                        'flex w-full items-start gap-3 border-l-4 p-3 text-left hover:bg-gray-50',
                                        selectedId === s.id ? 'border-l-brand-light bg-gray-50' : 'border-l-transparent',
                                        !s.aktif && 'opacity-60',
                                    )}
                                >
                                    <StatusDot status={s.status} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold text-gray-800">{s.nama}</span>
                                        <span className="block text-xs text-gray-500">
                                            {!s.aktif
                                                ? 'Nonaktif'
                                                : s.status === 'siap' || (s.status === 'gagal' && s.jumlah_kutipan > 0)
                                                  ? `${s.jumlah_kutipan} kutipan · ${s.halaman} halaman${s.diambil ? ` · ${formatDate(s.diambil)}` : ''}`
                                                  : STATUS_LABEL[s.status]}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}

function LegalBasisForm({ source }: { source: Selected }) {
    const form = useForm(legalBasisFrom(source));
    useEffect(() => {
        form.setDefaults(legalBasisFrom(source));
        form.reset();
        form.clearErrors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [source.id, source.dasar_hukum, source.tanggal_dasar, source.status_dasar, source.diganti_oleh]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.put(`/admin/pengetahuan/sumber/${source.id}`, { preserveScroll: true });
    };

    return (
        <form onSubmit={submit} className="space-y-3 border-b border-gray-100 pb-4">
            <p className="text-xs font-bold text-gray-600">
                Dasar hukum · <span className="font-normal">{STATUS_DASAR_LABEL[source.status_dasar ?? 'belum_diketahui']}</span>
            </p>
            <LegalBasisFields
                value={form.data}
                onChange={(field, value) => form.setData((data) => ({ ...data, [field]: value }))}
                errors={form.errors}
            />
            <Button type="submit" size="sm" variant="outline" disabled={form.processing || !form.isDirty}>
                {form.processing && <LoaderCircle className="h-4 w-4 animate-spin" />} Simpan dasar hukum
            </Button>
        </form>
    );
}

function SourceDetail({ source, canDelete }: { source: Selected; canDelete: boolean }) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    useEffect(() => setConfirmDelete(false), [source.id]);

    const toggle = (field: 'aktif' | 'ikuti_tautan' | 'tampil_berkas', value: boolean) =>
        router.put(`/admin/pengetahuan/sumber/${source.id}`, { [field]: value }, { preserveScroll: true });

    const working = source.status === 'antre' || source.status === 'diproses';

    return (
        <Card className="border-gray-200">
            <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="flex items-center gap-2 font-bold text-gray-800">
                            {source.jenis === 'situs' ? <Globe className="h-4 w-4" /> : <FileText className="h-4 w-4" />} {source.nama}
                        </p>
                        {source.url && (
                            <a href={source.url} target="_blank" rel="noreferrer" className="text-primary text-xs break-all hover:underline">
                                {source.url}
                            </a>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                            {STATUS_LABEL[source.status]} · {source.halaman} halaman · {source.jumlah_kutipan} kutipan · dirujuk {source.dipakai}×
                            {source.diambil && ` · diambil ${formatDate(source.diambil)}`}
                            {source.berubah && ` · isi berubah ${formatDate(source.berubah)}`}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {source.berkas_url && (
                            <Button variant="outline" size="sm" asChild>
                                <a href={source.berkas_url} target="_blank" rel="noreferrer">
                                    <ExternalLink className="h-4 w-4" /> Buka berkas
                                </a>
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={working}
                            onClick={() => router.post(`/admin/pengetahuan/sumber/${source.id}/sinkron`, {}, { preserveScroll: true })}
                        >
                            <RefreshCw className={cn('h-4 w-4', working && 'animate-spin')} /> {working ? 'Sedang diambil…' : 'Ambil ulang'}
                        </Button>
                        {canDelete &&
                            source.jenis === 'situs' &&
                            (confirmDelete ? (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-rose-600"
                                        onClick={() => router.delete(`/admin/pengetahuan/sumber/${source.id}`)}
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
                                    aria-label="Hapus sumber"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            ))}
                    </div>
                </div>

                {source.error && (
                    <p className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-900">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>
                            {source.error}
                            {source.jumlah_kutipan > 0 && ' Kutipan dari pengambilan terakhir yang berhasil tetap dipakai.'}
                        </span>
                    </p>
                )}

                <div className="flex flex-wrap gap-x-6 gap-y-2 border-y border-gray-100 py-3 text-sm text-gray-700">
                    <label className="flex items-center gap-2">
                        <Checkbox checked={source.aktif} onCheckedChange={(v) => toggle('aktif', v === true)} /> Dipakai asisten AI
                    </label>
                    {source.jenis === 'situs' ? (
                        <label className="flex items-center gap-2">
                            <Checkbox checked={source.ikuti_tautan} onCheckedChange={(v) => toggle('ikuti_tautan', v === true)} /> Ikuti tautan di
                            bagian yang sama
                        </label>
                    ) : (
                        <label className="flex items-center gap-2">
                            <Checkbox checked={source.tampil_berkas} onCheckedChange={(v) => toggle('tampil_berkas', v === true)} /> Warga boleh
                            membuka berkas dari tautan sumber
                        </label>
                    )}
                </div>

                <LegalBasisForm source={source} />

                <div>
                    <p className="mb-2 text-xs font-bold text-gray-600">
                        Kutipan {source.kutipan.length < source.jumlah_kutipan && `(${source.kutipan.length} pertama dari ${source.jumlah_kutipan})`}
                    </p>
                    {source.kutipan.length === 0 ? (
                        <p className="text-sm text-gray-500">{working ? 'Isi sedang diambil…' : 'Belum ada kutipan.'}</p>
                    ) : (
                        <ol className="space-y-3">
                            {source.kutipan.map((p) => (
                                <li key={p.id} className="rounded-lg border border-gray-100 p-3">
                                    <p className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                                        {p.url ? (
                                            <a href={p.url} target="_blank" rel="noreferrer" className="hover:underline">
                                                {p.judul}
                                            </a>
                                        ) : (
                                            p.judul
                                        )}
                                        {p.halaman && <span className="text-gray-500">· Hal. {p.halaman}</span>}
                                    </p>
                                    <p className="mt-1 text-sm whitespace-pre-line text-gray-600">{p.isi}</p>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

/** Coba pertanyaan warga: kutipan mana yang akan dikirim ke AI. */
function ProbeCard({ probe }: { probe: Props['probe'] }) {
    const [question, setQuestion] = useState(probe?.question ?? '');

    const submit = (e: FormEvent) => {
        e.preventDefault();
        router.get('/admin/pengetahuan/sumber', question.trim() ? { uji: question.trim() } : {}, {
            only: ['probe'],
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    return (
        <Card className="border-gray-200">
            <CardHeader className="border-b border-gray-100 pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Search className="text-brand-light h-4 w-4" /> Uji pertanyaan warga
                </CardTitle>
                <p className="text-xs text-gray-500">Kutipan teratas yang ditemukan ikut dikirim ke AI sebagai sumber, bersama artikel terbit.</p>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
                <form onSubmit={submit} className="flex gap-2">
                    <Input
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Mis. berapa batas usia ikut transmigrasi?"
                        aria-label="Pertanyaan uji"
                    />
                    <Button type="submit" size="sm" variant="outline">
                        Cari
                    </Button>
                </form>
                {probe &&
                    (probe.results.length === 0 ? (
                        <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">Tidak ada kutipan yang cocok.</p>
                    ) : (
                        <ol className="space-y-3">
                            {probe.results.map((r, i) => (
                                <li key={r.id} className="rounded-lg border border-gray-100 p-3 text-sm">
                                    <p className="flex items-start gap-2">
                                        <span className="text-primary text-xs font-bold tabular-nums">{i < 3 ? `[${i + 1}]` : '—'}</span>
                                        <span className="flex-1 font-semibold text-gray-800">
                                            {r.url ? (
                                                <a href={r.url} target="_blank" rel="noreferrer" className="hover:underline">
                                                    {r.judul}
                                                </a>
                                            ) : (
                                                r.judul
                                            )}
                                            <span className="block text-xs font-normal text-gray-500">{r.label}</span>
                                        </span>
                                        {r.skor !== null && <span className="text-xs text-gray-500 tabular-nums">{r.skor.toFixed(1)}</span>}
                                    </p>
                                    <p className="mt-1 line-clamp-3 text-xs text-gray-600">{r.isi}</p>
                                </li>
                            ))}
                        </ol>
                    ))}
            </CardContent>
        </Card>
    );
}

function StatusDot({ status }: { status: Status }) {
    return (
        <span
            className={cn(
                'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                status === 'siap' && 'bg-emerald-500',
                status === 'gagal' && 'bg-rose-500',
                (status === 'antre' || status === 'diproses') && 'animate-pulse bg-amber-400',
            )}
            aria-label={STATUS_LABEL[status]}
        />
    );
}

function formatDate(value: string): string {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
