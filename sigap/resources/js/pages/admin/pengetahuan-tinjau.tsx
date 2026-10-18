import AdminLayout from '@/layouts/admin-layout';
import { cn } from '@/lib/utils';
import { Link, router } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, ExternalLink, PartyPopper, Pencil, SkipForward, Undo2 } from 'lucide-react';
import { Fragment, useState } from 'react';

interface Article {
    id: number;
    title: string;
    body: string;
    category: string | null;
    keywords: string | null;
    source: string | null;
    source_ref: string | null;
    source_url: string | null;
    from_document: boolean;
}

interface Props {
    article: Article | null;
    remaining: number;
    skipped: number[];
}

/**
 * Tinjau berurutan: satu artikel per layar. Angka, jangka waktu, dan pasal
 * ditandai agar mudah dicocokkan dengan dokumen sumber. Setelah memutuskan,
 * artikel berikutnya langsung tampil.
 */
export default function PengetahuanTinjau({ article, remaining, skipped }: Props) {
    const [checked, setChecked] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    const reset = () => {
        setChecked(false);
        setRejecting(false);
        setNote('');
        setBusy(false);
    };
    const act = (url: string, data: Record<string, string> = {}) => {
        setBusy(true);
        router.post(url, data, { preserveScroll: false, onFinish: reset });
    };
    const skip = () => article && router.get('/admin/pengetahuan/tinjau', { lewati: [...skipped, article.id].join(',') }, { onFinish: reset });

    return (
        <AdminLayout title="Tinjau artikel" subtitle="Cocokkan dengan sumbernya, lalu putuskan. Artikel berikutnya langsung tampil.">
            <div className="mx-auto max-w-3xl">
                <div className="mb-4 flex items-center justify-between text-sm">
                    <Link href="/admin/pengetahuan" className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900">
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Basis Pengetahuan
                    </Link>
                    <span className="text-gray-600">
                        Sisa <b className="text-gray-900 tabular-nums">{remaining}</b> artikel
                        {skipped.length > 0 && <> · {skipped.length} dilewati</>}
                    </span>
                </div>

                {!article ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
                        <PartyPopper className="text-primary mx-auto mb-3 h-8 w-8" aria-hidden="true" />
                        <p className="text-lg font-semibold text-gray-900">
                            {remaining === 0 ? 'Semua artikel sudah ditinjau.' : 'Tidak ada lagi artikel di antrean ini.'}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                            {remaining > 0
                                ? `${remaining} artikel yang dilewati masih menunggu.`
                                : 'Artikel yang terbit langsung dipakai asisten AI.'}
                        </p>
                        <div className="mt-5 flex justify-center gap-2">
                            {remaining > 0 && (
                                <Link href="/admin/pengetahuan/tinjau" className="bg-primary rounded-lg px-4 py-2 text-sm font-medium text-white">
                                    Tinjau yang dilewati
                                </Link>
                            )}
                            <Link href="/admin/pengetahuan" className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700">
                                Kembali
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-gray-200 bg-white">
                        <div className="border-b border-gray-100 p-5">
                            <p className="text-xs text-gray-500">{article.category ?? 'Tanpa kategori'}</p>
                            <h2 className="mt-1 text-xl font-semibold text-gray-900">{article.title}</h2>
                        </div>

                        <div className="p-5">
                            <p className="text-[15px] leading-relaxed whitespace-pre-line text-gray-800">
                                <Highlighted text={article.body} />
                            </p>
                            <p className="mt-3 text-xs text-gray-500">
                                <mark className="rounded bg-amber-100 px-1 text-amber-900">Bertanda kuning</mark> = angka, jangka waktu, atau pasal.
                                Pastikan sama persis dengan sumbernya.
                            </p>
                            {article.keywords && <p className="mt-2 text-xs text-gray-500">Kata kunci: {article.keywords}</p>}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 p-5">
                            <div className="min-w-0 text-sm">
                                <p className="text-xs text-gray-500">Sumber</p>
                                <p className="font-medium text-gray-900">
                                    {[article.source, article.source_ref].filter(Boolean).join(' · ') || 'Belum diisi'}
                                </p>
                            </div>
                            {article.source_url ? (
                                <a
                                    href={article.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:border-primary hover:text-primary flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800"
                                >
                                    Buka sumber <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                </a>
                            ) : (
                                <span className="text-sm text-amber-700">Tidak ada tautan sumber. Sebaiknya dikembalikan.</span>
                            )}
                        </div>

                        <div className="space-y-4 border-t border-gray-100 p-5">
                            <label className="flex items-start gap-3 text-sm text-gray-800">
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => setChecked(e.target.checked)}
                                    className="accent-primary mt-0.5 h-4 w-4"
                                />
                                Isi artikel, terutama bagian bertanda kuning, sudah saya cocokkan dengan sumbernya.
                            </label>

                            {rejecting ? (
                                <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                                    <label htmlFor="catatan-kembali" className="block text-xs font-semibold text-gray-700">
                                        Apa yang perlu diperbaiki? (opsional)
                                    </label>
                                    <textarea
                                        id="catatan-kembali"
                                        rows={2}
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        placeholder="Mis. jangka waktu keberatan di sumber 30 hari kerja, bukan 30 hari"
                                        className="focus:border-primary w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setRejecting(false)}
                                            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                                        >
                                            Batal
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => act(`/admin/pengetahuan/${article.id}/kembalikan`, { catatan: note })}
                                            className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                                        >
                                            Kembalikan ke draf
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={!checked || busy}
                                        onClick={() => act(`/admin/pengetahuan/${article.id}/terbitkan`)}
                                        className="bg-primary hover:bg-primary/90 flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-medium text-white disabled:opacity-50"
                                    >
                                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Terbitkan
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRejecting(true)}
                                        className="flex h-11 items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm text-gray-800 hover:bg-gray-50"
                                    >
                                        <Undo2 className="h-4 w-4" aria-hidden="true" /> Perlu diperbaiki
                                    </button>
                                    <button
                                        type="button"
                                        onClick={skip}
                                        className="ml-auto flex h-11 items-center gap-2 rounded-lg px-3 text-sm text-gray-600 hover:bg-gray-100"
                                    >
                                        <SkipForward className="h-4 w-4" aria-hidden="true" /> Lewati
                                    </button>
                                    <Link
                                        href={`/admin/pengetahuan?edit=${article.id}`}
                                        className={cn('flex h-11 items-center gap-2 rounded-lg px-3 text-sm text-gray-600 hover:bg-gray-100')}
                                    >
                                        <Pencil className="h-4 w-4" aria-hidden="true" /> Ubah sendiri
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

/** Tandai angka, jangka waktu, nominal, dan rujukan pasal agar mudah dicek (nomor langkah "1." tidak ikut). */
function Highlighted({ text }: { text: string }) {
    const pattern =
        /(\d+(?:[.,]\d+)?\s*(?:hari kerja|hari|minggu|bulan|tahun|jam|persen|%|ha|hektare|MB|KK|jiwa)?|Pasal\s+\d+[A-Z]?(?:\s+ayat\s+\(\d+\))?|Rp\s?[\d.,]+)/gi;

    return (
        <>
            {text.split('\n').map((line, li) => {
                const marker = line.match(/^(\d+\.\s|-\s)/)?.[0] ?? '';
                const parts = line.slice(marker.length).split(pattern);
                return (
                    <Fragment key={li}>
                        {li > 0 && '\n'}
                        {marker}
                        {parts.map((part, i) =>
                            i % 2 === 1 ? (
                                <mark key={i} className="rounded bg-amber-100 px-0.5 text-amber-900">
                                    {part}
                                </mark>
                            ) : (
                                <Fragment key={i}>{part}</Fragment>
                            ),
                        )}
                    </Fragment>
                );
            })}
        </>
    );
}
