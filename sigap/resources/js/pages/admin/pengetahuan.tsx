import { Link, router, useForm } from '@inertiajs/react';
import {
    BookOpen,
    CalendarClock,
    CheckCircle2,
    CircleHelp,
    Clock,
    ExternalLink,
    FileUp,
    Globe,
    ListChecks,
    Pencil,
    Plus,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/sigap/data-table';
import { EMPTY_LEGAL_BASIS, LegalBasisFields, legalBasisFrom, type StatusDasar } from '@/components/sigap/legal-basis-fields';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AdminLayout, { AdminStat } from '@/layouts/admin-layout';
import { cn } from '@/lib/utils';

type Status = 'draf' | 'ditinjau' | 'terbit';

interface Article {
    id: number;
    title: string;
    body: string;
    category: string | null;
    keywords: string | null;
    source: string | null;
    source_ref: string | null;
    source_url: string | null;
    status: Status;
    review_at: string | null;
    dasar_hukum: string | null;
    tanggal_dasar: string | null;
    status_dasar: StatusDasar | null;
    diganti_oleh: string | null;
    review_overdue: boolean;
    used_count: number;
    helpful_rate: number | null;
    from_document: boolean;
    author: string | null;
    updated_at: string | null;
}

interface Unanswered {
    question: string;
    count: number;
    last_at: string | null;
}

interface Probe {
    question: string;
    results: { id: number; title: string; score: number; coverage: number }[];
    passages: { id: number; title: string; source: string | null; source_id: number | null }[];
}

interface Props {
    articles: Article[];
    stats: { terbit: number; ditinjau: number; draf: number; lewat_tinjau: number };
    categories: string[];
    unanswered: Unanswered[];
    probe: Probe | null;
    can_publish: boolean;
}

const STATUS_LABEL: Record<Status, string> = { draf: 'Draf', ditinjau: 'Ditinjau', terbit: 'Terbit' };

const EMPTY = {
    title: '',
    body: '',
    category: '',
    keywords: '',
    source: '',
    source_ref: '',
    source_url: '',
    status: 'draf' as Status,
    review_at: '',
    ...EMPTY_LEGAL_BASIS,
};

export default function Pengetahuan({ articles, stats, categories, unanswered, probe, can_publish: canPublish }: Props) {
    const [editing, setEditing] = useState<Article | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
    const form = useForm(EMPTY);

    const openNew = (title = '') => {
        setEditing(null);
        form.clearErrors();
        form.setData({ ...EMPTY, title });
        setFormOpen(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const openEdit = (a: Article) => {
        setEditing(a);
        form.clearErrors();
        form.setData({
            title: a.title,
            body: a.body,
            category: a.category ?? '',
            keywords: a.keywords ?? '',
            source: a.source ?? '',
            source_ref: a.source_ref ?? '',
            source_url: a.source_url ?? '',
            status: a.status,
            review_at: a.review_at ?? '',
            ...legalBasisFrom(a),
        });
        setFormOpen(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // /admin/pengetahuan?edit=ID (dari Tinjau berurutan) langsung membuka formulir ubah.
    useEffect(() => {
        const id = Number(new URLSearchParams(window.location.search).get('edit'));
        const target = id ? articles.find((a) => a.id === id) : undefined;
        if (target) openEdit(target);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const close = () => {
        setFormOpen(false);
        setEditing(null);
        form.reset();
        form.clearErrors();
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: close };
        if (editing) form.put(`/admin/pengetahuan/${editing.id}`, options);
        else form.post('/admin/pengetahuan', options);
    };

    const columns: DataTableColumn<Article>[] = [
        {
            accessorKey: 'title',
            header: 'Judul & sumber',
            // Sel tabel bawaan tidak membungkus teks; judul dan rujukan yang panjang
            // dibungkus di dalam kolom ini agar tidak menimpa kolom Status dst.
            cell: ({ row }) => (
                <div className="max-w-xl min-w-[18rem] whitespace-normal">
                    <div className="font-semibold break-words text-gray-800">{row.original.title}</div>
                    <div className="mt-0.5 text-xs leading-relaxed break-words text-gray-500">
                        {[row.original.category, [row.original.source, row.original.source_ref].filter(Boolean).join(' · ')]
                            .filter(Boolean)
                            .join(' · ') || 'Sumber belum diisi'}
                        {row.original.from_document && ' · dari dokumen'}
                        {row.original.source_url && (
                            <a
                                href={row.original.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary ml-1 inline-flex items-center gap-0.5 hover:underline"
                            >
                                tautan <ExternalLink className="h-3 w-3" />
                            </a>
                        )}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ getValue }) => <StatusPill status={getValue<Status>()} />,
        },
        {
            accessorKey: 'review_at',
            header: 'Tinjau ulang',
            cell: ({ row }) =>
                row.original.review_at ? (
                    <span className={cn('whitespace-nowrap', row.original.review_overdue ? 'font-semibold text-red-700' : 'text-gray-600')}>
                        {row.original.review_overdue ? 'Lewat · ' : ''}
                        {formatDate(row.original.review_at)}
                    </span>
                ) : (
                    <span className="text-gray-400">—</span>
                ),
        },
        {
            accessorKey: 'used_count',
            header: 'Dipakai AI',
            meta: { className: 'text-right' },
            cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span>,
        },
        {
            accessorKey: 'helpful_rate',
            header: 'Membantu',
            meta: { className: 'text-right' },
            cell: ({ getValue }) => {
                const v = getValue<number | null>();
                return v === null ? <span className="text-gray-400">—</span> : <span className="tabular-nums">{v}%</span>;
            },
        },
        {
            id: 'aksi',
            header: 'Aksi',
            meta: { label: 'Aksi', disableToggle: true, disableSorting: true, className: 'text-center' },
            cell: ({ row }) => (
                <div className="flex items-center justify-center gap-2">
                    {canPublish && row.original.status === 'ditinjau' && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs text-emerald-700"
                            onClick={() => router.post(`/admin/pengetahuan/${row.original.id}/terbitkan`, {}, { preserveScroll: true })}
                            title="Setujui dan terbitkan"
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Terbitkan
                        </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => openEdit(row.original)} title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {canPublish &&
                        (confirmDelete === row.original.id ? (
                            <span className="flex items-center gap-2 text-xs">
                                <button
                                    className="font-bold text-rose-600 hover:underline"
                                    onClick={() => {
                                        router.delete(`/admin/pengetahuan/${row.original.id}`, { preserveScroll: true });
                                        setConfirmDelete(null);
                                    }}
                                >
                                    Yakin hapus
                                </button>
                                <button className="text-gray-500 hover:underline" onClick={() => setConfirmDelete(null)}>
                                    Batal
                                </button>
                            </span>
                        ) : (
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0 text-rose-500"
                                onClick={() => setConfirmDelete(row.original.id)}
                                title="Hapus"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        ))}
                </div>
            ),
        },
    ];

    return (
        <AdminLayout
            title="Basis Pengetahuan"
            subtitle="Sumber jawaban asisten AI: artikel berstatus Terbit, ditambah kutipan langsung dari situs dan berkas resmi di Sumber Resmi."
            actions={
                formOpen ? (
                    <Button variant="outline" size="sm" onClick={close}>
                        <X className="h-4 w-4" /> Tutup formulir
                    </Button>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {canPublish && stats.ditinjau > 0 && (
                            <Button size="sm" asChild>
                                <Link href="/admin/pengetahuan/tinjau">
                                    <ListChecks className="h-4 w-4" /> Tinjau berurutan ({stats.ditinjau})
                                </Link>
                            </Button>
                        )}
                        <Button size="sm" variant="outline" asChild>
                            <Link href="/admin/pengetahuan/sumber">
                                <Globe className="h-4 w-4" /> Sumber Resmi
                            </Link>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                            <Link href="/admin/pengetahuan/dokumen">
                                <FileUp className="h-4 w-4" /> Buat dari dokumen resmi
                            </Link>
                        </Button>
                        <Button size="sm" onClick={() => openNew()}>
                            <Plus className="h-4 w-4" /> Artikel baru
                        </Button>
                    </div>
                )
            }
        >
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <AdminStat label="Terbit" value={stats.terbit} icon={BookOpen} />
                <AdminStat label="Menunggu tinjauan" value={stats.ditinjau} tone="orange" icon={Clock} />
                <AdminStat label="Draf" value={stats.draf} tone="indigo" icon={Pencil} />
                <AdminStat label="Lewat tanggal tinjau" value={stats.lewat_tinjau} tone="red" icon={CalendarClock} />
            </div>

            {!canPublish && (
                <p className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                    Artikel yang Anda tulis atau ubah akan berstatus <b>Ditinjau</b> sampai disetujui Super Admin. Setelah terbit, artikel langsung
                    dipakai asisten AI.
                </p>
            )}

            {formOpen && (
                <Card className="mb-6 border-gray-200">
                    <CardHeader className="border-b border-gray-100 pb-3">
                        <CardTitle className="flex items-center gap-2 text-base text-gray-800">
                            {editing ? <Pencil className="text-brand-light h-5 w-5" /> : <Plus className="text-brand-light h-5 w-5" />}
                            {editing ? 'Edit artikel' : 'Artikel baru'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <Field label="Judul (pertanyaan warga)" required error={form.errors.title} className="md:col-span-3">
                                <Input
                                    value={form.data.title}
                                    onChange={(e) => form.setData('title', e.target.value)}
                                    placeholder="Apa syarat menjadi peserta transmigrasi?"
                                />
                            </Field>
                            <Field label="Jawaban" required error={form.errors.body} className="md:col-span-3">
                                <Textarea
                                    value={form.data.body}
                                    onChange={(e) => form.setData('body', e.target.value)}
                                    rows={7}
                                    placeholder="Tulis jawaban resmi. Gunakan langkah bernomor untuk prosedur."
                                />
                            </Field>
                            <Field label="Kategori" error={form.errors.category}>
                                <Input
                                    value={form.data.category}
                                    onChange={(e) => form.setData('category', e.target.value)}
                                    list="kategori-pengetahuan"
                                    placeholder="Program, Pertanahan, Layanan Contact Center…"
                                />
                                <datalist id="kategori-pengetahuan">
                                    {categories.map((c) => (
                                        <option key={c} value={c} />
                                    ))}
                                </datalist>
                            </Field>
                            <Field label="Sumber resmi" error={form.errors.source}>
                                <Input
                                    value={form.data.source}
                                    onChange={(e) => form.setData('source', e.target.value)}
                                    placeholder="Nama pedoman / regulasi"
                                />
                            </Field>
                            <Field label="Rujukan (halaman / pasal)" error={form.errors.source_ref}>
                                <Input
                                    value={form.data.source_ref}
                                    onChange={(e) => form.setData('source_ref', e.target.value)}
                                    placeholder="Hal. 12 · Pasal 5"
                                />
                            </Field>
                            <Field label="Tautan dokumen resmi" error={form.errors.source_url} className="md:col-span-2">
                                <Input
                                    type="url"
                                    value={form.data.source_url}
                                    onChange={(e) => form.setData('source_url', e.target.value)}
                                    placeholder="https://jdih.transmigrasi.go.id/…"
                                />
                            </Field>
                            <LegalBasisFields
                                className="md:col-span-2"
                                value={form.data}
                                onChange={(field, value) => form.setData((data) => ({ ...data, [field]: value }))}
                                errors={form.errors}
                            />
                            <Field label="Kata kunci tambahan" error={form.errors.keywords}>
                                <Input
                                    value={form.data.keywords}
                                    onChange={(e) => form.setData('keywords', e.target.value)}
                                    placeholder="Istilah warga, pisahkan dengan koma"
                                />
                            </Field>
                            <Field label="Status" required error={form.errors.status}>
                                <Select value={form.data.status} onValueChange={(v) => form.setData('status', v as Status)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="draf">Draf</SelectItem>
                                        <SelectItem value="ditinjau">Ditinjau</SelectItem>
                                        <SelectItem value="terbit">{canPublish ? 'Terbit (dipakai AI)' : 'Ajukan untuk terbit'}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Tinjau ulang pada" error={form.errors.review_at}>
                                <Input type="date" value={form.data.review_at} onChange={(e) => form.setData('review_at', e.target.value)} />
                            </Field>
                            <div className="flex items-end md:justify-end">
                                <Button type="submit" disabled={form.processing} className="w-full md:w-auto">
                                    {editing ? 'Simpan perubahan' : 'Simpan artikel'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <DataTable<Article>
                    columns={columns}
                    data={articles}
                    toolbarTitle="Artikel"
                    searchPlaceholder="Cari judul atau isi…"
                    itemLabel="artikel"
                    emptyMessage="Belum ada artikel."
                    filters={[
                        {
                            columnId: 'status',
                            placeholder: 'Semua status',
                            options: (Object.keys(STATUS_LABEL) as Status[]).map((s) => ({ value: s, label: STATUS_LABEL[s] })),
                        },
                    ]}
                />

                <div className="flex flex-col gap-6">
                    <ProbeCard probe={probe} />
                    <Card className="h-fit border-gray-200">
                        <CardHeader className="border-b border-gray-100 pb-3">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                                <CircleHelp className="text-brand-light h-4 w-4" /> Belum bisa dijawab AI
                            </CardTitle>
                            <p className="text-xs text-gray-500">
                                Pertanyaan warga 30 hari terakhir yang tidak menemukan sumber. Bahan artikel berikutnya.
                            </p>
                        </CardHeader>
                        <CardContent className="p-0">
                            {unanswered.length === 0 ? (
                                <p className="p-4 text-sm text-gray-500">Belum ada pertanyaan yang tidak terjawab.</p>
                            ) : (
                                <ul className="divide-y divide-gray-100">
                                    {unanswered.map((q) => (
                                        <li key={q.question} className="flex items-center gap-3 p-3">
                                            <span className="flex-1 text-sm text-gray-700">{q.question}</span>
                                            <span className="text-primary text-xs font-bold tabular-nums">{q.count}×</span>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 rounded-full px-2.5 text-xs"
                                                onClick={() => openNew(q.question)}
                                            >
                                                Buat artikel
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AdminLayout>
    );
}

/** Coba pertanyaan warga: artikel mana yang akan dikirim ke AI sebagai sumber. */
function ProbeCard({ probe }: { probe: Probe | null }) {
    const [question, setQuestion] = useState(probe?.question ?? '');

    const submit = (e: FormEvent) => {
        e.preventDefault();
        router.get('/admin/pengetahuan', question.trim() ? { uji: question.trim() } : {}, {
            only: ['probe'],
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    return (
        <Card className="h-fit border-gray-200">
            <CardHeader className="border-b border-gray-100 pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Search className="text-brand-light h-4 w-4" /> Uji pencarian
                </CardTitle>
                <p className="text-xs text-gray-500">Tulis pertanyaan seperti warga. Artikel terbit yang ditemukan menjadi sumber jawaban AI.</p>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
                <form onSubmit={submit} className="flex gap-2">
                    <Input
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Mis. syarat ikut transmigrasi apa?"
                        aria-label="Pertanyaan uji"
                    />
                    <Button type="submit" size="sm" variant="outline">
                        Cari
                    </Button>
                </form>
                {probe &&
                    (probe.results.length === 0 && probe.passages.length === 0 ? (
                        <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                            Tidak ada artikel atau kutipan yang cocok. AI akan menjawab “belum menemukan informasi resmi” dan menawarkan petugas.
                        </p>
                    ) : probe.results.length === 0 ? (
                        <p className="rounded-md bg-gray-50 p-3 text-xs text-gray-600">
                            Tidak ada artikel yang cocok; AI menjawab dari kutipan di bawah.
                        </p>
                    ) : (
                        <ol className="space-y-2">
                            {probe.results.map((r, i) => (
                                <li key={r.id} className="flex items-start gap-2 text-sm">
                                    <span className="text-primary mt-0.5 text-xs font-bold tabular-nums">[{i + 1}]</span>
                                    <span className="flex-1 text-gray-700">{r.title}</span>
                                    <span className="text-xs whitespace-nowrap text-gray-500 tabular-nums" title="Skor · cakupan kata pertanyaan">
                                        {r.score.toFixed(1)} · {r.coverage}%
                                    </span>
                                </li>
                            ))}
                        </ol>
                    ))}
                {probe && probe.passages.length > 0 && (
                    <div className="space-y-2 border-t border-gray-100 pt-3">
                        <p className="text-xs font-bold text-gray-600">Kutipan Sumber Resmi yang ikut dikirim</p>
                        <ol className="space-y-2">
                            {probe.passages.map((p, i) => (
                                <li key={p.id} className="flex items-start gap-2 text-sm">
                                    <span className="text-primary mt-0.5 text-xs font-bold tabular-nums">
                                        [{probe.results.slice(0, 3).length + i + 1}]
                                    </span>
                                    <span className="flex-1">
                                        <Link href={`/admin/pengetahuan/sumber?sumber=${p.source_id}`} className="text-gray-700 hover:underline">
                                            {p.title}
                                        </Link>
                                        {p.source && <span className="block text-xs text-gray-500">{p.source}</span>}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function StatusPill({ status }: { status: Status }) {
    const styles: Record<Status, string> = {
        terbit: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
        ditinjau: 'bg-amber-50 text-amber-800 ring-amber-200',
        draf: 'bg-gray-50 text-gray-700 ring-gray-200',
    };
    return <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset', styles[status])}>{STATUS_LABEL[status]}</span>;
}

function Field({
    label,
    required,
    error,
    className,
    children,
}: {
    label: string;
    required?: boolean;
    error?: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={cn('space-y-1.5', className)}>
            <Label className="text-xs font-bold text-gray-600">
                {label} {required && <span className="text-red-500">*</span>}
            </Label>
            {children}
            {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
        </div>
    );
}

function formatDate(value: string): string {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
