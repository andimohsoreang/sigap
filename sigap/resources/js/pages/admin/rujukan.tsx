import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import AdminLayout from '@/layouts/admin-layout';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    CheckCircle2,
    ChevronDown,
    Hourglass,
    LifeBuoy,
    MoreHorizontal,
    Phone,
    Search,
    SendHorizontal,
    TriangleAlert,
} from 'lucide-react';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';

type Tab = 'perlu_tindakan' | 'menunggu' | 'selesai';
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
    tab: Tab | 'semua';
    milik: 'saya' | 'semua';
    tab_counts: Record<Tab, number>;
    referrals: Row[];
    active: Detail | null;
    kpi: { aktif: number; perlu_tindakan: number; berhasil_30: number; tingkat_berhasil: number | null; median_jam: number | null };
    board: { nama: string; aktif: number; perlu_tindakan: number; berhasil_30: number }[] | null;
    admins: { id: number; name: string }[];
}

const TABS: { value: Tab; label: string }[] = [
    { value: 'perlu_tindakan', label: 'Perlu tindakan' },
    { value: 'menunggu', label: 'Menunggu warga' },
    { value: 'selesai', label: 'Selesai' },
];

/**
 * Rujukan: daftar kerja penanggung jawab.
 *
 * Prinsip tampilan: setiap rujukan hanya menampilkan SATU langkah berikutnya
 * (apa yang harus dilakukan, dengan satu tombol). Aksi yang jarang dipakai
 * disimpan di menu "Lainnya".
 */
export default function Rujukan({ tab, milik, tab_counts: counts, referrals, active, kpi, board, admins }: Props) {
    const { auth } = usePage<SharedData>().props;
    const isSuper = auth?.user?.role === 'super_admin';
    const [search, setSearch] = useState('');
    const [mobileDetail, setMobileDetail] = useState(() =>
        typeof window === 'undefined' ? false : new URLSearchParams(window.location.search).has('rujukan'),
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return referrals;
        return referrals.filter((r) => [r.nama, r.kode, r.portal ?? ''].some((v) => v.toLowerCase().includes(q)));
    }, [referrals, search]);

    const visit = (params: Record<string, string>, keep = true) =>
        router.get('/admin/rujukan', { tab, milik, ...params }, { preserveState: keep, preserveScroll: true });
    const open = (kode: string) => {
        setMobileDetail(true);
        visit({ rujukan: kode });
    };

    return (
        <AdminLayout title="Rujukan" subtitle="Warga yang dirujuk ke portal lain. Dampingi sampai warga mengirim kode bukti dari portal tujuan.">
            <div
                className={cn(
                    'mb-4 grid-cols-3 divide-x divide-gray-200 rounded-xl border border-gray-200 bg-white',
                    mobileDetail && active ? 'hidden lg:grid' : 'grid',
                )}
            >
                <Kpi label="Perlu tindakan" value={String(kpi.perlu_tindakan)} warn={kpi.perlu_tindakan > 0} />
                <Kpi label="Sedang didampingi" value={String(kpi.aktif)} />
                <Kpi label="Berhasil 30 hari" value={String(kpi.berhasil_30)} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
                <section
                    aria-label="Daftar rujukan"
                    className={cn(
                        'flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white lg:h-[calc(100vh-15rem)] lg:min-h-[520px]',
                        mobileDetail && active ? 'hidden lg:flex' : 'flex',
                    )}
                >
                    <div className="space-y-3 border-b border-gray-200 p-4">
                        <div className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1" role="tablist" aria-label="Status rujukan">
                            {TABS.map((t) => (
                                <button
                                    key={t.value}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === t.value}
                                    onClick={() => router.get('/admin/rujukan', { tab: t.value, milik }, { preserveScroll: true })}
                                    className={cn(
                                        'flex flex-col items-center rounded-md px-1 py-1.5 text-xs font-medium transition-colors',
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
                                placeholder="Cari nama atau RJK-…"
                                className="focus:border-primary focus:ring-primary/20 h-10 w-full rounded-lg border border-gray-300 pr-3 pl-9 text-sm outline-none focus:ring-2"
                            />
                        </div>
                        {isSuper && (
                            <label className="flex items-center gap-2 text-sm text-gray-600">
                                <input
                                    type="checkbox"
                                    checked={milik === 'semua'}
                                    onChange={(e) =>
                                        router.get('/admin/rujukan', { tab, milik: e.target.checked ? 'semua' : 'saya' }, { preserveScroll: true })
                                    }
                                    className="accent-primary h-4 w-4"
                                />
                                Tampilkan rujukan semua petugas
                            </label>
                        )}
                    </div>

                    <ul className="flex-1 divide-y divide-gray-100 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <li className="p-8 text-center text-sm text-gray-500">
                                {tab === 'perlu_tindakan' ? 'Tidak ada yang perlu dikerjakan sekarang.' : 'Belum ada rujukan di sini.'}
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
                                        <span className="truncate font-semibold text-gray-900">{r.nama}</span>
                                        <span className="text-sm text-gray-600">
                                            Ke {r.portal ?? '—'}
                                            {milik === 'semua' && r.pendamping ? ` · ${r.pendamping}` : ''}
                                        </span>
                                        <RowState row={r} />
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
                        <DetailPanel key={active.kode} detail={active} admins={admins} onBack={() => setMobileDetail(false)} />
                    ) : (
                        <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
                            Pilih rujukan di sebelah kiri. Kerjakan tab <b className="mx-1 text-gray-800">Perlu tindakan</b> lebih dulu.
                        </div>
                    )}

                    {board && board.length > 0 && !active && (
                        <div className="rounded-xl border border-gray-200 bg-white">
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

/** Satu kalimat keadaan di daftar (bukan deretan label). */
function RowState({ row: r }: { row: Row }) {
    if (r.status === 'butuh_bantuan') return <State tone="amber" icon={LifeBuoy} text="Warga minta bantuan" />;
    if (r.status === 'berhasil') return <State tone="green" icon={CheckCircle2} text="Berhasil" />;
    if (r.status === 'gagal') return <State tone="gray" icon={CheckCircle2} text="Ditutup" />;
    if (r.perlu_tindakan) return <State tone="red" icon={TriangleAlert} text="Belum ada kabar, hubungi warga" />;
    return <State tone="gray" icon={Hourglass} text={`Menunggu warga sampai ${formatDate(r.batas)}`} />;
}

function State({ tone, icon: Icon, text }: { tone: 'amber' | 'green' | 'gray' | 'red'; icon: typeof LifeBuoy; text: string }) {
    return (
        <span
            className={cn('mt-0.5 flex items-center gap-1.5 text-xs font-medium', {
                'text-amber-700': tone === 'amber',
                'text-emerald-700': tone === 'green',
                'text-gray-500': tone === 'gray',
                'text-red-600': tone === 'red',
            })}
        >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {text}
        </span>
    );
}

type Extra = 'kode' | 'catat' | 'alihkan' | 'tutup' | null;

function DetailPanel({ detail: d, admins, onBack }: { detail: Detail; admins: { id: number; name: string }[]; onBack: () => void }) {
    const [extra, setExtra] = useState<Extra>(null);
    const [copied, setCopied] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);

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
                <div className="flex items-start gap-3 p-4">
                    <button
                        type="button"
                        onClick={onBack}
                        className="-ml-1 rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 lg:hidden"
                        aria-label="Kembali ke daftar"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-gray-900">
                            {d.nama} <span className="font-normal text-gray-500">→ {d.portal}</span>
                        </p>
                        <p className="text-sm text-gray-500">
                            {d.kode} · pendamping {d.pendamping ?? '—'}
                        </p>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-50"
                            >
                                <MoreHorizontal className="h-4 w-4" aria-hidden="true" /> Lainnya{' '}
                                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60">
                            {d.terbuka && d.percakapan_id && (
                                <DropdownMenuItem onSelect={() => setExtra('catat')}>Catat tanpa mengirim pesan</DropdownMenuItem>
                            )}
                            {d.terbuka && d.bisa_kelola && (
                                <DropdownMenuItem onSelect={() => setExtra('alihkan')}>Alihkan ke petugas lain</DropdownMenuItem>
                            )}
                            {d.terbuka && d.bisa_kelola && (
                                <DropdownMenuItem onSelect={() => setExtra('tutup')}>Tutup tidak berhasil</DropdownMenuItem>
                            )}
                            {d.terbuka && <DropdownMenuSeparator />}
                            <DropdownMenuItem onSelect={copyLink}>
                                {copied ? 'Tautan tersalin' : 'Salin tautan pengantar untuk warga'}
                            </DropdownMenuItem>
                            {d.portal_url && (
                                <DropdownMenuItem asChild>
                                    <a href={d.portal_url} target="_blank" rel="noopener noreferrer">
                                        Buka {d.portal}
                                    </a>
                                </DropdownMenuItem>
                            )}
                            {d.percakapan_id && (
                                <DropdownMenuItem asChild>
                                    <Link href={`/admin/chat?tab=semua&conversation=${d.percakapan_id}`}>Buka percakapan chat</Link>
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="border-t border-gray-100 p-4">
                    <NextStep detail={d} onEnterCode={() => setExtra('kode')} />
                    {extra && <ExtraForm kind={extra} detail={d} admins={admins} onDone={() => setExtra(null)} />}
                </div>

                <dl className="grid gap-x-6 gap-y-3 border-t border-gray-100 p-4 text-sm sm:grid-cols-[2fr_1fr]">
                    <div>
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
                                <span className="font-normal text-gray-500">{d.percakapan_id ? 'Belum ada · lewat chat' : 'Belum ada'}</span>
                            )}
                        </dd>
                    </div>
                </dl>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white">
                <button
                    type="button"
                    onClick={() => setHistoryOpen((v) => !v)}
                    aria-expanded={historyOpen}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-gray-900"
                >
                    Riwayat ({d.jejak.length} langkah)
                    <ChevronDown className={cn('h-4 w-4 text-gray-500 transition-transform', historyOpen && 'rotate-180')} aria-hidden="true" />
                </button>
                {historyOpen && (
                    <ol className="relative mx-4 mb-4 space-y-4 border-l border-gray-200 pl-5">
                        {d.jejak.map((e) => (
                            <li key={e.id} className="relative">
                                <span
                                    className={cn(
                                        'absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full',
                                        e.jenis === 'berhasil'
                                            ? 'bg-emerald-500'
                                            : ['butuh_bantuan', 'pengingat'].includes(e.jenis)
                                              ? 'bg-amber-500'
                                              : 'bg-gray-400',
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
                )}
            </div>
        </>
    );
}

/**
 * Kotak "Langkah berikutnya": menerangkan keadaan dalam satu kalimat dan
 * menyediakan satu aksi utama (membalas warga). Pesan otomatis terisi
 * template agar petugas tinggal mengirim.
 */
function NextStep({ detail: d, onEnterCode }: { detail: Detail; onEnterCode: () => void }) {
    const help = [...d.jejak].reverse().find((e) => e.jenis === 'butuh_bantuan');
    const viaChat = Boolean(d.percakapan_id);
    const greeting = `Halo Bapak/Ibu ${d.nama.split(' ')[0]}, `;

    if (d.status === 'berhasil') {
        return (
            <Box tone="green" icon={CheckCircle2} title="Selesai: warga berhasil">
                {d.bukti_label}: <b className="font-mono">{d.bukti}</b>. Tidak ada yang perlu dilakukan lagi.
            </Box>
        );
    }
    if (d.status === 'gagal') {
        return (
            <Box tone="gray" icon={CheckCircle2} title="Ditutup tidak berhasil">
                {d.alasan_tutup}
            </Box>
        );
    }

    const waiting = d.status !== 'butuh_bantuan' && !d.perlu_tindakan;
    const config =
        d.status === 'butuh_bantuan'
            ? {
                  tone: 'amber' as const,
                  icon: LifeBuoy,
                  title: 'Warga minta bantuan. Balas sekarang.',
                  text: help?.catatan ? `“${help.catatan}”` : 'Warga mengalami kendala di portal tujuan.',
                  template: `${greeting}kami sudah menerima kendala Anda. `,
              }
            : d.perlu_tindakan
              ? {
                    tone: 'red' as const,
                    icon: TriangleAlert,
                    title: 'Belum ada kabar. Tanyakan ke warga.',
                    text: `Lewat 2 hari kerja tanpa kode bukti dari ${d.portal}.`,
                    template: `${greeting}apakah aduan Anda di ${d.portal} sudah berhasil dikirim? Bila sudah, mohon kirim ${lcfirst(d.bukti_label)} yang Anda terima. Bila ada kendala, balas pesan ini.`,
                }
              : {
                    tone: 'gray' as const,
                    icon: Hourglass,
                    title: 'Menunggu warga. Belum perlu tindakan.',
                    text: `Warga sedang mengisi ${d.portal}. Anda diingatkan bila belum ada kabar sampai ${formatDateTime(d.batas)}.`,
                    template: `${greeting}kami ingin memastikan aduan Anda di ${d.portal} sudah terkirim. Bila sudah, mohon kirim ${lcfirst(d.bukti_label)} yang Anda terima.`,
                };

    return (
        <Box tone={config.tone} icon={config.icon} title={config.title}>
            <p>{config.text}</p>
            <Composer key={config.template} detail={d} viaChat={viaChat} template={config.template} collapsed={waiting} />
            {d.bisa_kelola && (
                <button type="button" onClick={onEnterCode} className="text-primary mt-3 text-sm font-medium underline-offset-2 hover:underline">
                    Warga sudah memberi {lcfirst(d.bukti_label)} lewat telepon? Masukkan di sini
                </button>
            )}
        </Box>
    );
}

/** Satu kotak tulis: kirim ke chat warga, atau catat hasil menghubungi bila tidak ada chat. */
function Composer({ detail: d, viaChat, template, collapsed }: { detail: Detail; viaChat: boolean; template: string; collapsed: boolean }) {
    const [open, setOpen] = useState(!collapsed);
    const form = useForm({ pesan: viaChat ? template : '', catatan: '' });
    const field = viaChat ? 'pesan' : 'catatan';

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="hover:border-primary hover:text-primary mt-3 flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700"
            >
                <SendHorizontal className="h-4 w-4" aria-hidden="true" /> {viaChat ? 'Kirim pengingat ke warga' : 'Catat hasil menghubungi warga'}
            </button>
        );
    }

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(`/admin/rujukan/${d.kode}/${viaChat ? 'pesan' : 'catatan'}`, { preserveScroll: true, onSuccess: () => form.reset() });
    };

    return (
        <form onSubmit={submit} className="mt-3 space-y-2">
            <label htmlFor="pesan-warga" className="block text-xs font-semibold text-gray-700">
                {viaChat ? 'Pesan ke warga (masuk ke chat-nya)' : `Hubungi ${d.kontak ?? 'warga'}, lalu tulis hasilnya`}
            </label>
            <textarea
                id="pesan-warga"
                rows={3}
                value={form.data[field]}
                onChange={(e) => form.setData(field, e.target.value)}
                placeholder={viaChat ? '' : 'Mis. sudah ditelepon, warga sedang menyiapkan KTP'}
                className="focus:border-primary w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none"
            />
            {form.errors[field] && <p className="text-xs font-semibold text-rose-600">{form.errors[field]}</p>}
            <button
                type="submit"
                disabled={form.processing || form.data[field].trim() === ''}
                className="bg-primary hover:bg-primary/90 flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white disabled:opacity-50"
            >
                <SendHorizontal className="h-4 w-4" aria-hidden="true" /> {viaChat ? 'Kirim ke warga' : 'Simpan catatan'}
            </button>
        </form>
    );
}

function ExtraForm({
    kind,
    detail: d,
    admins,
    onDone,
}: {
    kind: Exclude<Extra, null>;
    detail: Detail;
    admins: { id: number; name: string }[];
    onDone: () => void;
}) {
    const form = useForm({ bukti: '', catatan: '', admin_id: '', alasan: '' });
    const spec = {
        kode: {
            url: 'berhasil',
            field: 'bukti' as const,
            label: `${d.bukti_label} dari warga`,
            button: 'Tandai berhasil',
            placeholder: d.bukti_label,
        },
        catat: {
            url: 'catatan',
            field: 'catatan' as const,
            label: 'Catatan (tidak dikirim ke warga)',
            button: 'Simpan catatan',
            placeholder: 'Mis. sudah ditelepon',
        },
        alihkan: { url: 'alihkan', field: 'admin_id' as const, label: 'Alihkan ke', button: 'Alihkan', placeholder: '' },
        tutup: {
            url: 'tutup',
            field: 'alasan' as const,
            label: 'Alasan ditutup tanpa bukti',
            button: 'Tutup rujukan',
            placeholder: 'Mis. warga tidak dapat dihubungi 3× dalam 5 hari kerja',
        },
    }[kind];

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(`/admin/rujukan/${d.kode}/${spec.url}`, { preserveScroll: true, onSuccess: onDone });
    };

    return (
        <form onSubmit={submit} className="mt-4 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <label htmlFor="aksi-tambahan" className="block text-xs font-semibold text-gray-700">
                {spec.label}
            </label>
            {kind === 'alihkan' ? (
                <select
                    id="aksi-tambahan"
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
            ) : kind === 'kode' ? (
                <input
                    id="aksi-tambahan"
                    value={form.data.bukti}
                    onChange={(e) => form.setData('bukti', e.target.value)}
                    placeholder={spec.placeholder}
                    className="focus:border-primary h-10 w-full rounded-lg border border-gray-300 bg-white px-3 font-mono text-sm uppercase outline-none placeholder:font-sans placeholder:normal-case"
                />
            ) : (
                <textarea
                    id="aksi-tambahan"
                    rows={2}
                    value={form.data[spec.field]}
                    onChange={(e) => form.setData(spec.field, e.target.value)}
                    placeholder={spec.placeholder}
                    className="focus:border-primary w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none"
                />
            )}
            {form.errors[spec.field] && <p className="text-xs font-semibold text-rose-600">{form.errors[spec.field]}</p>}
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onDone} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
                    Batal
                </button>
                <button
                    type="submit"
                    disabled={form.processing || String(form.data[spec.field]).trim() === ''}
                    className="bg-primary hover:bg-primary/90 rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                    {spec.button}
                </button>
            </div>
        </form>
    );
}

function Box({
    tone,
    icon: Icon,
    title,
    children,
}: {
    tone: 'amber' | 'red' | 'gray' | 'green';
    icon: typeof LifeBuoy;
    title: string;
    children: ReactNode;
}) {
    return (
        <div
            className={cn('rounded-lg border p-4 text-sm', {
                'border-amber-200 bg-amber-50 text-amber-950': tone === 'amber',
                'border-red-200 bg-red-50 text-red-950': tone === 'red',
                'border-gray-200 bg-gray-50 text-gray-800': tone === 'gray',
                'border-emerald-200 bg-emerald-50 text-emerald-950': tone === 'green',
            })}
        >
            <p className="mb-1 flex items-center gap-2 text-base font-semibold">
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" /> {title}
            </p>
            <div className="text-gray-700">{children}</div>
        </div>
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

/** "Kode tracking" → "kode tracking", tetapi "Nomor tracking LAPOR!" tidak menjadi "lapor!". */
function lcfirst(text: string): string {
    return text.charAt(0).toLowerCase() + text.slice(1);
}
