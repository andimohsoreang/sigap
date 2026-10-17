import AdminLayout from '@/layouts/admin-layout';
import { cn } from '@/lib/utils';
import { Link, router, useForm } from '@inertiajs/react';
import {
    AlarmClock,
    ArrowLeft,
    CheckCircle2,
    Copy,
    ExternalLink,
    Hourglass,
    LifeBuoy,
    ListChecks,
    MessageSquare,
    NotebookPen,
    Phone,
    Search,
    SendHorizontal,
    UserRoundCog,
    XCircle,
    type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';

type Tab = 'perlu_tindakan' | 'menunggu' | 'selesai' | 'semua';
type Status = 'dirujuk' | 'dibuka' | 'butuh_bantuan' | 'berhasil' | 'gagal';

interface Row {
    kode: string;
    nama: string;
    portal: string | null;
    status: Status;
    status_label: string;
    perlu_tindakan: boolean;
    batas: string | null;
    pendamping: string | null;
    dibuat: string | null;
}

interface TrailItem {
    id: number;
    jenis: string;
    label: string;
    oleh: string;
    catatan: string | null;
    pada: string | null;
}

interface Detail extends Row {
    ringkasan: string | null;
    kontak: string | null;
    bukti: string | null;
    bukti_label: string;
    alasan_tutup: string | null;
    tautan_warga: string;
    portal_url: string | null;
    percakapan_id: number | null;
    assigned_to: number | null;
    bisa_kelola: boolean;
    terbuka: boolean;
    jejak: TrailItem[];
}

interface Props {
    tab: Tab;
    milik: 'saya' | 'semua';
    tab_counts: Record<Tab, number>;
    referrals: Row[];
    active: Detail | null;
    kpi: { aktif: number; perlu_tindakan: number; berhasil_30: number; tingkat_berhasil: number | null; median_jam: number | null };
    board: { nama: string; aktif: number; perlu_tindakan: number; berhasil_30: number }[] | null;
    admins: { id: number; name: string }[];
}

const TABS: { value: Tab; label: string; icon: LucideIcon; hint: string }[] = [
    { value: 'perlu_tindakan', label: 'Perlu tindakan', icon: AlarmClock, hint: 'Warga minta bantuan, atau lewat 2 hari kerja tanpa bukti.' },
    { value: 'menunggu', label: 'Menunggu warga', icon: Hourglass, hint: 'Pengantar sudah dikirim; warga sedang mengisi di portal.' },
    { value: 'selesai', label: 'Selesai', icon: CheckCircle2, hint: 'Berhasil dengan bukti, atau ditutup dengan alasan.' },
    { value: 'semua', label: 'Semua', icon: ListChecks, hint: 'Seluruh rujukan.' },
];

export default function Rujukan({ tab, milik, tab_counts: counts, referrals, active, kpi, board, admins }: Props) {
    const [search, setSearch] = useState('');
    const [mobileDetail, setMobileDetail] = useState(() =>
        typeof window === 'undefined' ? false : new URLSearchParams(window.location.search).has('rujukan'),
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return referrals;
        return referrals.filter((r) => [r.nama, r.kode, r.portal ?? ''].some((v) => v.toLowerCase().includes(q)));
    }, [referrals, search]);

    const go = (params: Record<string, string>) =>
        router.get('/admin/rujukan', { tab, milik, ...params }, { preserveState: true, preserveScroll: true });
    const open = (kode: string) => {
        setMobileDetail(true);
        go({ rujukan: kode });
    };

    return (
        <AdminLayout
            title="Rujukan"
            subtitle="Warga yang dirujuk ke portal lain. Penanggung jawab mendampingi sampai warga berhasil, dibuktikan dengan kode dari portal tujuan."
        >
            <div
                className={cn(
                    'mb-4 grid-cols-2 divide-gray-200 rounded-xl border border-gray-200 bg-white sm:grid-cols-4 sm:divide-x',
                    mobileDetail && active ? 'hidden lg:grid' : 'grid',
                )}
            >
                <Kpi label="Perlu tindakan" value={String(kpi.perlu_tindakan)} warn={kpi.perlu_tindakan > 0} />
                <Kpi label="Sedang didampingi" value={String(kpi.aktif)} />
                <Kpi
                    label="Berhasil 30 hari"
                    value={kpi.tingkat_berhasil === null ? String(kpi.berhasil_30) : `${kpi.berhasil_30} · ${kpi.tingkat_berhasil}%`}
                />
                <Kpi
                    label="Waktu sampai berhasil"
                    value={kpi.median_jam === null ? '—' : kpi.median_jam < 24 ? `${kpi.median_jam} jam` : `${Math.round(kpi.median_jam / 24)} hari`}
                />
            </div>

            <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
                <section
                    aria-label="Daftar rujukan"
                    className={cn(
                        'flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white lg:h-[calc(100vh-15rem)] lg:min-h-[560px]',
                        mobileDetail && active ? 'hidden lg:flex' : 'flex',
                    )}
                >
                    <div className="space-y-3 border-b border-gray-200 p-4">
                        <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 text-sm" role="group" aria-label="Pemilik rujukan">
                            {(['saya', 'semua'] as const).map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    aria-pressed={milik === m}
                                    onClick={() => router.get('/admin/rujukan', { tab, milik: m }, { preserveScroll: true })}
                                    className={cn(
                                        'rounded-md py-1.5 font-medium',
                                        milik === m ? 'text-primary bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900',
                                    )}
                                >
                                    {m === 'saya' ? 'Tanggung jawab saya' : 'Semua petugas'}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-4 gap-1 rounded-lg bg-gray-100 p-1" role="tablist" aria-label="Status rujukan">
                            {TABS.map((t) => (
                                <button
                                    key={t.value}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === t.value}
                                    title={t.hint}
                                    onClick={() => router.get('/admin/rujukan', { tab: t.value, milik }, { preserveScroll: true })}
                                    className={cn(
                                        'flex flex-col items-center rounded-md px-1 py-1.5 text-[11px] leading-tight font-medium transition-colors',
                                        tab === t.value ? 'text-primary bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'text-sm font-semibold tabular-nums',
                                            t.value === 'perlu_tindakan' && (counts[t.value] ?? 0) > 0 && 'text-red-600',
                                        )}
                                    >
                                        {counts[t.value] ?? 0}
                                    </span>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                            <label htmlFor="cari-rujukan" className="sr-only">
                                Cari rujukan
                            </label>
                            <input
                                id="cari-rujukan"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari nama, portal, atau RJK-…"
                                className="focus:border-primary focus:ring-primary/20 h-10 w-full rounded-lg border border-gray-300 pr-3 pl-9 text-sm outline-none focus:ring-2"
                            />
                        </div>
                    </div>

                    <ul className="flex-1 divide-y divide-gray-100 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <li className="p-8 text-center text-sm text-gray-500">
                                {tab === 'perlu_tindakan' ? 'Tidak ada yang perlu ditindaklanjuti. Bagus!' : 'Tidak ada rujukan di sini.'}
                            </li>
                        ) : (
                            filtered.map((r) => (
                                <li key={r.kode}>
                                    <button
                                        type="button"
                                        onClick={() => open(r.kode)}
                                        aria-current={active?.kode === r.kode ? 'true' : undefined}
                                        className={cn(
                                            'flex w-full flex-col gap-1 px-4 py-3.5 text-left transition-colors',
                                            active?.kode === r.kode ? 'bg-brand-soft' : 'hover:bg-gray-50',
                                        )}
                                    >
                                        <span className="flex items-baseline justify-between gap-2">
                                            <span className="truncate font-semibold text-gray-900">{r.nama}</span>
                                            <span className="shrink-0 font-mono text-xs text-gray-500">{r.kode}</span>
                                        </span>
                                        <span className="text-sm text-gray-600">Ke {r.portal ?? '—'}</span>
                                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                            <StatusTag status={r.status} label={r.status_label} />
                                            {r.perlu_tindakan && r.status !== 'butuh_bantuan' && <Tag tone="red">Lewat batas</Tag>}
                                            {milik === 'semua' && r.pendamping && <span className="text-xs text-gray-500">· {r.pendamping}</span>}
                                            {r.batas && ['dirujuk', 'dibuka'].includes(r.status) && !r.perlu_tindakan && (
                                                <span className="ml-auto text-xs text-gray-500">batas {formatDate(r.batas)}</span>
                                            )}
                                        </span>
                                    </button>
                                </li>
                            ))
                        )}
                    </ul>
                </section>

                <section
                    aria-label="Detail rujukan"
                    className={cn('min-w-0 flex-col gap-4 lg:flex', mobileDetail && active ? 'flex' : 'hidden lg:flex')}
                >
                    {active ? (
                        <DetailPanel detail={active} admins={admins} onBack={() => setMobileDetail(false)} />
                    ) : (
                        <div className="grid flex-1 content-center gap-4 sm:grid-cols-2">
                            {TABS.slice(0, 3).map((t) => (
                                <div key={t.value} className="rounded-xl border border-gray-200 bg-white p-6">
                                    <t.icon className="text-primary mb-3 h-5 w-5" aria-hidden="true" />
                                    <p className="font-semibold text-gray-900">{t.label}</p>
                                    <p className="mt-1 text-sm text-gray-600">{t.hint}</p>
                                </div>
                            ))}
                            <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
                                <p className="font-semibold text-gray-900">Cara kerja</p>
                                Rujukan dibuat asisten AI atau petugas. Penanggung jawab dipilih otomatis (beban paling ringan) dan diingatkan setiap
                                pagi bila belum ada bukti.
                            </div>
                        </div>
                    )}

                    {board && board.length > 0 && (
                        <div className={cn('rounded-xl border border-gray-200 bg-white', active && 'hidden xl:block')}>
                            <p className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">Papan penanggung jawab</p>
                            <table className="w-full text-sm">
                                <thead className="text-left text-xs text-gray-500">
                                    <tr>
                                        <th className="px-4 py-2 font-medium">Petugas</th>
                                        <th className="px-4 py-2 text-right font-medium">Didampingi</th>
                                        <th className="px-4 py-2 text-right font-medium">Perlu tindakan</th>
                                        <th className="px-4 py-2 text-right font-medium">Berhasil 30 hari</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 tabular-nums">
                                    {board.map((b) => (
                                        <tr key={b.nama}>
                                            <td className="px-4 py-2 text-gray-800">{b.nama}</td>
                                            <td className="px-4 py-2 text-right">{b.aktif}</td>
                                            <td className={cn('px-4 py-2 text-right', b.perlu_tindakan > 0 && 'font-semibold text-red-600')}>
                                                {b.perlu_tindakan}
                                            </td>
                                            <td className="px-4 py-2 text-right">{b.berhasil_30}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </AdminLayout>
    );
}

function DetailPanel({ detail: d, admins, onBack }: { detail: Detail; admins: { id: number; name: string }[]; onBack: () => void }) {
    const [action, setAction] = useState<'catatan' | 'pesan' | 'berhasil' | 'alihkan' | 'tutup' | null>(null);
    const [copied, setCopied] = useState(false);

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(d.tautan_warga);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2500);
        } catch {
            setCopied(false);
        }
    };

    return (
        <>
            <div className="rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center gap-3 p-4">
                    <button
                        type="button"
                        onClick={onBack}
                        className="-ml-1 rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 lg:hidden"
                        aria-label="Kembali ke daftar"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-semibold text-gray-900">
                            {d.nama} <span className="font-normal text-gray-500">→ {d.portal}</span>
                        </p>
                        <p className="text-sm text-gray-600">
                            <span className="font-mono">{d.kode}</span> · penanggung jawab{' '}
                            <b className="font-medium text-gray-800">{d.pendamping ?? 'belum ada'}</b>
                        </p>
                    </div>
                    <StatusTag status={d.status} label={d.status_label} />
                </div>

                <dl className="grid gap-x-6 gap-y-3 border-t border-gray-100 p-4 text-sm sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <dt className="text-xs text-gray-500">Ringkasan aduan</dt>
                        <dd className="mt-0.5 text-gray-800">{d.ringkasan ?? '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-gray-500">Kontak warga</dt>
                        <dd className="mt-0.5 flex items-center gap-1.5 font-medium text-gray-900">
                            {d.kontak ? (
                                <>
                                    <Phone className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" /> {d.kontak}
                                </>
                            ) : (
                                <span className="font-normal text-gray-500">{d.percakapan_id ? 'Belum ada · hubungi lewat chat' : 'Belum ada'}</span>
                            )}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-gray-500">
                            {d.terbuka ? 'Batas tindak lanjut' : d.status === 'berhasil' ? d.bukti_label : 'Alasan ditutup'}
                        </dt>
                        <dd className={cn('mt-0.5 font-medium', d.perlu_tindakan ? 'text-red-600' : 'text-gray-900')}>
                            {d.terbuka ? (
                                d.batas ? (
                                    formatDateTime(d.batas)
                                ) : (
                                    '—'
                                )
                            ) : d.status === 'berhasil' ? (
                                <span className="font-mono">{d.bukti}</span>
                            ) : (
                                d.alasan_tutup
                            )}
                        </dd>
                    </div>
                </dl>

                <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 p-4 text-sm">
                    <button
                        type="button"
                        onClick={copyLink}
                        className="hover:border-primary hover:text-primary flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700"
                    >
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" /> {copied ? 'Tautan tersalin' : 'Salin tautan pengantar'}
                    </button>
                    {d.portal_url && (
                        <a
                            href={d.portal_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:border-primary hover:text-primary flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700"
                        >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Buka portal
                        </a>
                    )}
                    {d.percakapan_id && (
                        <Link
                            href={`/admin/chat?tab=semua&conversation=${d.percakapan_id}`}
                            className="hover:border-primary hover:text-primary flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700"
                        >
                            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> Buka percakapan
                        </Link>
                    )}
                </div>

                {d.terbuka && (
                    <div className="space-y-3 border-t border-gray-100 p-4">
                        <div className="flex flex-wrap gap-2">
                            <ActionButton
                                icon={NotebookPen}
                                active={action === 'catatan'}
                                onClick={() => setAction(action === 'catatan' ? null : 'catatan')}
                            >
                                Catat tindak lanjut
                            </ActionButton>
                            {d.percakapan_id && (
                                <ActionButton
                                    icon={SendHorizontal}
                                    active={action === 'pesan'}
                                    onClick={() => setAction(action === 'pesan' ? null : 'pesan')}
                                >
                                    Kirim pesan
                                </ActionButton>
                            )}
                            {d.bisa_kelola && (
                                <>
                                    <ActionButton
                                        icon={CheckCircle2}
                                        primary
                                        active={action === 'berhasil'}
                                        onClick={() => setAction(action === 'berhasil' ? null : 'berhasil')}
                                    >
                                        Tandai berhasil
                                    </ActionButton>
                                    <ActionButton
                                        icon={UserRoundCog}
                                        active={action === 'alihkan'}
                                        onClick={() => setAction(action === 'alihkan' ? null : 'alihkan')}
                                    >
                                        Alihkan
                                    </ActionButton>
                                    <ActionButton
                                        icon={XCircle}
                                        active={action === 'tutup'}
                                        onClick={() => setAction(action === 'tutup' ? null : 'tutup')}
                                    >
                                        Tutup tidak berhasil
                                    </ActionButton>
                                </>
                            )}
                        </div>
                        {action && <ActionForm kind={action} detail={d} admins={admins} onDone={() => setAction(null)} />}
                        {!d.bisa_kelola && (
                            <p className="text-xs text-gray-500">
                                Menandai berhasil, mengalihkan, dan menutup hanya oleh penanggung jawab atau Super Admin.
                            </p>
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1 rounded-xl border border-gray-200 bg-white p-4 md:p-6">
                <p className="mb-4 text-sm font-semibold text-gray-900">Jejak tindak lanjut</p>
                <ol className="relative space-y-5 border-l border-gray-200 pl-5">
                    {d.jejak.map((e) => (
                        <li key={e.id} className="relative">
                            <span
                                className={cn(
                                    'absolute top-1 -left-[26px] h-3 w-3 rounded-full border-2 border-white',
                                    e.jenis === 'berhasil'
                                        ? 'bg-emerald-500'
                                        : e.jenis === 'butuh_bantuan' || e.jenis === 'pengingat'
                                          ? 'bg-amber-500'
                                          : e.jenis === 'gagal'
                                            ? 'bg-gray-500'
                                            : 'bg-primary',
                                )}
                                aria-hidden="true"
                            />
                            <p className="text-sm">
                                <span className="font-medium text-gray-900">{e.label}</span>{' '}
                                <span className="text-gray-500">
                                    · {e.oleh} · {formatDateTime(e.pada)}
                                </span>
                            </p>
                            {e.catatan && <p className="mt-0.5 text-sm whitespace-pre-line text-gray-700">{e.catatan}</p>}
                        </li>
                    ))}
                </ol>
            </div>
        </>
    );
}

function ActionForm({
    kind,
    detail: d,
    admins,
    onDone,
}: {
    kind: 'catatan' | 'pesan' | 'berhasil' | 'alihkan' | 'tutup';
    detail: Detail;
    admins: { id: number; name: string }[];
    onDone: () => void;
}) {
    const form = useForm({ catatan: '', pesan: '', bukti: '', admin_id: '', alasan: '' });
    const field = { catatan: 'catatan', pesan: 'pesan', berhasil: 'bukti', alihkan: 'admin_id', tutup: 'alasan' }[kind] as
        | 'catatan'
        | 'pesan'
        | 'bukti'
        | 'admin_id'
        | 'alasan';
    const copy = {
        catatan: { label: 'Apa yang sudah dilakukan?', placeholder: 'Mis. sudah ditelepon, warga sedang menyiapkan KTP', button: 'Simpan catatan' },
        pesan: {
            label: 'Pesan untuk warga (dikirim ke chat)',
            placeholder: 'Mis. Bapak/Ibu, apakah sudah berhasil mengirim di Trans Tuntas?',
            button: 'Kirim pesan',
        },
        berhasil: { label: `${d.bukti_label} dari warga`, placeholder: d.bukti_label, button: 'Tandai berhasil' },
        alihkan: { label: 'Alihkan ke petugas', placeholder: '', button: 'Alihkan' },
        tutup: {
            label: 'Alasan ditutup tanpa bukti (wajib)',
            placeholder: 'Mis. warga tidak dapat dihubungi 3× dalam 5 hari kerja',
            button: 'Tutup rujukan',
        },
    }[kind];

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(`/admin/rujukan/${d.kode}/${kind}`, {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onDone();
            },
        });
    };

    return (
        <form onSubmit={submit} className="space-y-2 rounded-lg bg-gray-50 p-3">
            <label htmlFor={`aksi-${kind}`} className="block text-xs font-semibold text-gray-700">
                {copy.label}
            </label>
            {kind === 'alihkan' ? (
                <select
                    id={`aksi-${kind}`}
                    value={form.data.admin_id}
                    onChange={(e) => form.setData('admin_id', e.target.value)}
                    className="focus:border-primary h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none"
                >
                    <option value="">Pilih petugas…</option>
                    {admins
                        .filter((a) => a.id !== d.assigned_to)
                        .map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                </select>
            ) : kind === 'berhasil' ? (
                <input
                    id={`aksi-${kind}`}
                    value={form.data.bukti}
                    onChange={(e) => form.setData('bukti', e.target.value)}
                    placeholder={copy.placeholder}
                    className="focus:border-primary h-10 w-full rounded-lg border border-gray-300 bg-white px-3 font-mono text-sm uppercase outline-none placeholder:font-sans placeholder:normal-case"
                />
            ) : (
                <textarea
                    id={`aksi-${kind}`}
                    rows={3}
                    value={form.data[field]}
                    onChange={(e) => form.setData(field, e.target.value)}
                    placeholder={copy.placeholder}
                    className="focus:border-primary w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none"
                />
            )}
            {form.errors[field] && <p className="text-xs font-semibold text-rose-600">{form.errors[field]}</p>}
            {kind === 'catatan' && <p className="text-xs text-gray-500">Menyimpan catatan memperpanjang batas tindak lanjut 2 hari kerja.</p>}
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onDone} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
                    Batal
                </button>
                <button
                    type="submit"
                    disabled={form.processing || String(form.data[field]).trim() === ''}
                    className="bg-primary hover:bg-primary/90 rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                    {copy.button}
                </button>
            </div>
        </form>
    );
}

function ActionButton({
    icon: Icon,
    children,
    onClick,
    primary = false,
    active = false,
}: {
    icon: LucideIcon;
    children: ReactNode;
    onClick: () => void;
    primary?: boolean;
    active?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                'flex h-10 flex-auto items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium whitespace-nowrap transition-colors sm:flex-none',
                primary
                    ? 'bg-primary border-primary hover:bg-primary/90 text-white'
                    : 'hover:border-primary hover:text-primary border-gray-300 bg-white text-gray-800',
                active && !primary && 'border-primary text-primary',
            )}
        >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{children}</span>
        </button>
    );
}

function StatusTag({ status, label }: { status: Status; label: string }) {
    const tone: Record<Status, 'gray' | 'sky' | 'amber' | 'green' | 'red'> = {
        dirujuk: 'gray',
        dibuka: 'sky',
        butuh_bantuan: 'amber',
        berhasil: 'green',
        gagal: 'gray',
    };
    return (
        <Tag tone={tone[status]}>
            {status === 'butuh_bantuan' && <LifeBuoy className="mr-1 inline h-3 w-3" aria-hidden="true" />}
            {label}
        </Tag>
    );
}

function Tag({ tone, children }: { tone: 'gray' | 'sky' | 'amber' | 'green' | 'red'; children: ReactNode }) {
    return (
        <span
            className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset', {
                'bg-gray-50 text-gray-700 ring-gray-200': tone === 'gray',
                'bg-sky-50 text-sky-800 ring-sky-200': tone === 'sky',
                'bg-amber-50 text-amber-800 ring-amber-200': tone === 'amber',
                'bg-emerald-50 text-emerald-800 ring-emerald-200': tone === 'green',
                'bg-red-50 text-red-700 ring-red-200': tone === 'red',
            })}
        >
            {children}
        </span>
    );
}

function Kpi({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
    return (
        <div className="px-4 py-3">
            <p className="text-xs text-gray-600 sm:text-sm">{label}</p>
            <p className={cn('text-lg font-semibold tabular-nums sm:text-xl', warn ? 'text-red-600' : 'text-gray-900')}>{value}</p>
        </div>
    );
}

function formatDate(value: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

function formatDateTime(value: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
