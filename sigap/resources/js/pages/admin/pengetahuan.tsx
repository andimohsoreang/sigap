import { router, useForm } from '@inertiajs/react';
import { BookOpen, CalendarClock, CircleHelp, Clock, Pencil, Plus, Trash2, X } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/sigap/data-table';
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
    source: string | null;
    source_ref: string | null;
    status: Status;
    review_at: string | null;
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

interface Props {
    articles: Article[];
    stats: { terbit: number; ditinjau: number; draf: number; lewat_tinjau: number };
    categories: string[];
    unanswered: Unanswered[];
    can_publish: boolean;
}

const STATUS_LABEL: Record<Status, string> = { draf: 'Draf', ditinjau: 'Ditinjau', terbit: 'Terbit' };

const EMPTY = { title: '', body: '', category: '', source: '', source_ref: '', status: 'draf' as Status, review_at: '' };

export default function Pengetahuan({ articles, stats, categories, unanswered, can_publish: canPublish }: Props) {
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
            source: a.source ?? '',
            source_ref: a.source_ref ?? '',
            status: a.status,
            review_at: a.review_at ?? '',
        });
        setFormOpen(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

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
            cell: ({ row }) => (
                <div className="max-w-xl">
                    <div className="font-semibold text-gray-800">{row.original.title}</div>
                    <div className="text-xs text-gray-500">
                        {[row.original.category, [row.original.source, row.original.source_ref].filter(Boolean).join(' · ')]
                            .filter(Boolean)
                            .join(' · ') || 'Sumber belum diisi'}
                        {row.original.from_document && ' · dari dokumen'}
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
            subtitle="Satu-satunya sumber jawaban asisten AI. Hanya artikel berstatus Terbit yang dipakai AI."
            actions={
                formOpen ? (
                    <Button variant="outline" size="sm" onClick={close}>
                        <X className="h-4 w-4" /> Tutup formulir
                    </Button>
                ) : (
                    <Button size="sm" onClick={() => openNew()}>
                        <Plus className="h-4 w-4" /> Artikel baru
                    </Button>
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
                                    placeholder="Program, Pertanahan, Layanan SIGAP…"
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

                <Card className="h-fit border-gray-200">
                    <CardHeader className="border-b border-gray-100 pb-3">
                        <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-wider text-gray-800 uppercase">
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
        </AdminLayout>
    );
}

function StatusPill({ status }: { status: Status }) {
    const styles: Record<Status, string> = {
        terbit: 'bg-green-100 text-green-800',
        ditinjau: 'bg-amber-100 text-amber-800',
        draf: 'bg-gray-100 text-gray-700',
    };
    return <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase', styles[status])}>{STATUS_LABEL[status]}</span>;
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
