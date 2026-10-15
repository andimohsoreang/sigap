import { CHAT_UNREAD_EVENT, type ChatUnreadPayload } from '@/hooks/use-chat-unread';
import AdminLayout from '@/layouts/admin-layout';
import { cn } from '@/lib/utils';
import { Link, router, useForm } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import {
    ArrowLeft,
    BadgeCheck,
    BookOpen,
    Bot,
    CheckCircle2,
    ChevronUp,
    Clock,
    Hand,
    Inbox,
    MessageCircleQuestion,
    Phone,
    Search,
    SendHorizontal,
    ShieldAlert,
    Ticket,
    UserRound,
    type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';

type Tab = 'menunggu' | 'ai' | 'selesai' | 'semua';

interface Conversation {
    id: number;
    nama: string;
    inisial: string;
    tipe: 'warga' | 'tamu';
    subjek: string | null;
    cuplikan: string | null;
    unread: number;
    last_message_at: string | null;
    mode?: 'ai' | 'petugas';
    alasan?: string | null;
    diteruskan_at?: string | null;
    hasil?: string | null;
    referensi?: string | null;
    butuh_dihubungi?: boolean;
    petugas?: string | null;
}

interface Message {
    id: number;
    body: string;
    sender_type: string;
    penulis: string;
    pada: string | null;
    dibaca?: boolean;
    jenis?: string | null;
    sumber?: { id: number; judul: string; label: string | null }[];
    nilai?: number | null;
}

interface Active {
    id: number;
    nama: string;
    inisial: string;
    tipe: 'warga' | 'tamu';
    username: string | null;
    jumlah_tiket: number | null;
    riwayat_tiket?: { nomor: string; judul: string; status: string | null; url: string }[];
    mulai: string | null;
    mode?: 'ai' | 'petugas';
    ringkasan?: string | null;
    alasan?: string | null;
    diteruskan_at?: string | null;
    referensi?: string | null;
    kontak?: string | null;
    petugas?: string | null;
    milik_saya?: boolean;
    hasil?: string | null;
    ditutup_at?: string | null;
    tiket?: { nomor: string; url: string } | null;
    messages: Message[];
}

interface Props {
    conversations: Conversation[];
    active: Active | null;
    tab?: Tab;
    tab_counts?: Record<Tab, number>;
    ai_enabled?: boolean;
    kpi?: { percakapan: number; selesai_tanpa_petugas: number | null; tunggu_median_menit: number | null } | null;
    /** Label hasil dari server (tombol memakai label ringkas sendiri). */
    outcomes?: Record<string, string>;
}

const TABS: { value: Tab; label: string; icon: LucideIcon; hint: string }[] = [
    { value: 'menunggu', label: 'Menunggu', icon: Clock, hint: 'Diteruskan asisten AI atau ditulis warga, belum selesai.' },
    { value: 'ai', label: 'Dijawab AI', icon: Bot, hint: 'Sedang dijawab asisten. Ambil bila perlu campur tangan.' },
    { value: 'selesai', label: 'Selesai', icon: CheckCircle2, hint: 'Ditutup dengan hasil: terjawab, tiket, atau dirujuk.' },
    { value: 'semua', label: 'Semua', icon: Inbox, hint: 'Seluruh percakapan, terbaru di atas.' },
];

/** Muat ulang daftar (dan utas aktif) tanpa kehilangan posisi gulir. */
function refresh(includeActive: boolean) {
    router.reload({
        only: includeActive
            ? ['active', 'conversations', 'chat_unread', 'chat_waiting', 'tab_counts']
            : ['conversations', 'chat_unread', 'chat_waiting', 'tab_counts'],
    });
}

export default function Chat({ conversations, active, tab = 'semua', tab_counts: tabCounts, ai_enabled: aiEnabled = false, kpi }: Props) {
    const [search, setSearch] = useState('');
    // Detail konteks terbuka di layar lebar; di HP ditutup agar pesan langsung terlihat.
    const [detailsOpen, setDetailsOpen] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= 1024));
    // Di layar kecil daftar dan percakapan tampil bergantian.
    const [mobileThread, setMobileThread] = useState(() =>
        typeof window === 'undefined' ? false : new URLSearchParams(window.location.search).has('conversation'),
    );
    const reply = useForm({ body: '' });
    const bottomRef = useRef<HTMLDivElement>(null);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return conversations;
        return conversations.filter(
            (c) => c.nama.toLowerCase().includes(q) || (c.cuplikan ?? '').toLowerCase().includes(q) || (c.referensi ?? '').toLowerCase().includes(q),
        );
    }, [conversations, search]);

    const activeId = active?.id;
    const closed = Boolean(active?.ditutup_at);
    const pending = useRef(false);
    const refreshWhenVisible = (includeActive: boolean) => {
        if (document.visibilityState === 'visible') refresh(includeActive);
        else pending.current = true;
    };

    // Pastikan URL memuat ?conversation=… agar reload berikutnya tetap di utas yang sama.
    useEffect(() => {
        if (!activeId) return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('conversation') !== String(activeId)) {
            router.get('/admin/chat', { tab, conversation: activeId }, { replace: true, preserveState: true, preserveScroll: true });
        }
    }, [activeId, tab]);

    // Gulir ke pesan terbaru saat utas berganti atau pesan bertambah.
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ block: 'end' });
    }, [activeId, active?.messages.length]);

    // Pesan baru di utas aktif via kanal chat.{id}.
    useEffect(() => {
        const instance = echoInstance();
        if (!instance || !activeId) return;
        const channel = instance.private(`chat.${activeId}`);
        channel.listen('.chat.message', () => refreshWhenVisible(true));
        return () => instance.leave(`chat.${activeId}`);
    }, [activeId]);

    // Pesan masuk di percakapan mana pun (event dari layout, kanal admin.chat).
    useEffect(() => {
        const onUnread = (e: Event) => {
            const detail = (e as CustomEvent<ChatUnreadPayload>).detail;
            refreshWhenVisible(detail?.conversation_id === activeId);
        };
        const onVisible = () => {
            if (pending.current && document.visibilityState === 'visible') {
                pending.current = false;
                refresh(true);
            }
        };
        window.addEventListener(CHAT_UNREAD_EVENT, onUnread);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.removeEventListener(CHAT_UNREAD_EVENT, onUnread);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [activeId]);

    const open = (id: number) => {
        setMobileThread(true);
        router.get('/admin/chat', { tab, conversation: id }, { preserveState: true, preserveScroll: true });
    };
    const switchTab = (value: Tab) => router.get('/admin/chat', { tab: value }, { preserveScroll: true });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (!active || reply.data.body.trim() === '') return;
        reply.post(`/admin/chat/${active.id}/balas`, { preserveScroll: true, onSuccess: () => reply.reset('body') });
    };

    const take = () => active && router.post(`/admin/chat/${active.id}/ambil`, {}, { preserveScroll: true });
    const close = (hasil: string) => active && router.post(`/admin/chat/${active.id}/tutup`, { hasil }, { preserveScroll: true });

    return (
        <AdminLayout
            title={aiEnabled ? 'Kotak Masuk' : 'Pesan Masuk (Live Chat)'}
            badge={aiEnabled ? 'Asisten AI aktif' : undefined}
            subtitle={aiEnabled ? 'Percakapan yang diteruskan asisten dan live chat warga.' : 'Percakapan real-time via Laravel Reverb.'}
        >
            {kpi && (
                <div
                    className={cn(
                        'mb-4 grid-cols-3 divide-x divide-gray-200 rounded-xl border border-gray-200 bg-white',
                        mobileThread && active ? 'hidden lg:grid' : 'grid',
                    )}
                >
                    <Kpi label="Selesai tanpa petugas" value={kpi.selesai_tanpa_petugas === null ? '—' : `${kpi.selesai_tanpa_petugas}%`} />
                    <Kpi label="Waktu tunggu petugas" value={kpi.tunggu_median_menit === null ? '—' : `${kpi.tunggu_median_menit} mnt`} />
                    <Kpi label="Percakapan 30 hari" value={String(kpi.percakapan)} />
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
                {/* Antrean */}
                <section
                    aria-label="Daftar percakapan"
                    className={cn(
                        'flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white lg:h-[calc(100vh-15rem)] lg:min-h-[560px]',
                        mobileThread && active ? 'hidden lg:flex' : 'flex',
                    )}
                >
                    <div className="space-y-3 border-b border-gray-200 p-4">
                        {aiEnabled && tabCounts && (
                            <div className="grid grid-cols-4 gap-1 rounded-lg bg-gray-100 p-1" role="tablist" aria-label="Status percakapan">
                                {TABS.map((t) => (
                                    <button
                                        key={t.value}
                                        type="button"
                                        role="tab"
                                        aria-selected={tab === t.value}
                                        onClick={() => switchTab(t.value)}
                                        className={cn(
                                            'flex flex-col items-center rounded-md px-1 py-1.5 text-xs font-medium transition-colors',
                                            tab === t.value ? 'text-primary bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900',
                                        )}
                                    >
                                        <span className="text-sm font-semibold tabular-nums">{tabCounts[t.value] ?? 0}</span>
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="relative">
                            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                            <label htmlFor="cari-percakapan" className="sr-only">
                                Cari percakapan
                            </label>
                            <input
                                id="cari-percakapan"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari nama, isi, atau REF-…"
                                className="focus:border-primary focus:ring-primary/20 h-10 w-full rounded-lg border border-gray-300 pr-3 pl-9 text-sm outline-none focus:ring-2"
                            />
                        </div>
                    </div>

                    <ul className="flex-1 divide-y divide-gray-100 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <li className="p-8 text-center text-sm text-gray-500">Tidak ada percakapan di sini.</li>
                        ) : (
                            filtered.map((c) => (
                                <li key={c.id}>
                                    <button
                                        type="button"
                                        onClick={() => open(c.id)}
                                        aria-current={active?.id === c.id ? 'true' : undefined}
                                        className={cn(
                                            'flex w-full gap-3 px-4 py-3.5 text-left transition-colors',
                                            active?.id === c.id ? 'bg-brand-soft' : 'hover:bg-gray-50',
                                        )}
                                    >
                                        <Avatar label={c.inisial} tone={c.mode === 'ai' && !c.hasil ? 'ai' : 'person'} />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-baseline justify-between gap-2">
                                                <span className="flex min-w-0 items-center gap-1 font-semibold text-gray-900">
                                                    <span className="truncate">{c.nama}</span>
                                                    {c.tipe === 'warga' && (
                                                        <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Warga terdaftar" />
                                                    )}
                                                </span>
                                                <span
                                                    className={cn(
                                                        'shrink-0 text-xs',
                                                        c.diteruskan_at && !c.hasil ? 'font-semibold text-amber-700' : 'text-gray-500',
                                                    )}
                                                >
                                                    {formatRelative(c.diteruskan_at && !c.hasil ? c.diteruskan_at : c.last_message_at)}
                                                </span>
                                            </span>
                                            <span className="mt-0.5 line-clamp-2 text-sm text-gray-600">{c.cuplikan ?? c.subjek ?? '—'}</span>
                                            <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                                {c.mode === 'ai' && !c.hasil && <Tag tone="violet">Dijawab AI</Tag>}
                                                {c.alasan && !c.hasil && <Tag tone="amber">{c.alasan}</Tag>}
                                                {c.butuh_dihubungi && <Tag tone="sky">Minta dihubungi</Tag>}
                                                {c.hasil && <Tag tone="green">{c.hasil}</Tag>}
                                                {c.unread > 0 && (
                                                    <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                                                        {c.unread}
                                                    </span>
                                                )}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            ))
                        )}
                    </ul>
                </section>

                {/* Percakapan */}
                <section
                    aria-label="Percakapan"
                    className={cn(
                        'min-w-0 flex-col gap-4 lg:flex lg:h-[calc(100vh-15rem)] lg:min-h-[560px]',
                        mobileThread && active ? 'flex' : 'hidden lg:flex',
                    )}
                >
                    {!active ? (
                        <EmptyState counts={tabCounts} aiEnabled={aiEnabled} onPick={switchTab} />
                    ) : (
                        <>
                            {/* Kartu konteks */}
                            <div className="shrink-0 rounded-xl border border-gray-200 bg-white">
                                <div className="flex items-center gap-3 p-4">
                                    <button
                                        type="button"
                                        onClick={() => setMobileThread(false)}
                                        className="-ml-1 rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 lg:hidden"
                                        aria-label="Kembali ke daftar"
                                    >
                                        <ArrowLeft className="h-5 w-5" />
                                    </button>
                                    <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 sm:flex">
                                        <UserRound className="h-5 w-5" aria-hidden="true" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="flex items-center gap-1.5 text-base font-semibold text-gray-900">
                                            <span className="truncate">{active.nama}</span>
                                            {active.tipe === 'warga' && (
                                                <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Warga terdaftar" />
                                            )}
                                        </p>
                                        <p className="truncate text-sm text-gray-600">
                                            {active.tipe === 'warga'
                                                ? `Warga terdaftar${active.username ? ` · ${active.username}` : ''}`
                                                : 'Tamu · nama diisi sendiri'}
                                            {active.referensi ? ` · ${active.referensi}` : ''}
                                        </p>
                                    </div>
                                    {aiEnabled && !closed && !active.milik_saya && (
                                        <button
                                            type="button"
                                            onClick={take}
                                            className="hover:border-primary hover:text-primary flex h-10 shrink-0 items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-800"
                                        >
                                            <Hand className="h-4 w-4" aria-hidden="true" />
                                            <span className="hidden sm:inline">Ambil percakapan</span>
                                            <span className="sm:hidden">Ambil</span>
                                        </button>
                                    )}
                                    {aiEnabled && (
                                        <button
                                            type="button"
                                            onClick={() => setDetailsOpen((v) => !v)}
                                            aria-expanded={detailsOpen}
                                            aria-label={detailsOpen ? 'Sembunyikan detail' : 'Tampilkan detail'}
                                            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                                        >
                                            <ChevronUp className={cn('h-5 w-5 transition-transform', !detailsOpen && 'rotate-180')} />
                                        </button>
                                    )}
                                </div>

                                {aiEnabled && detailsOpen && (
                                    <div className="space-y-4 border-t border-gray-100 p-4">
                                        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1.2fr]">
                                            <div className="sm:col-span-2 xl:col-span-1">
                                                <dt className="text-xs text-gray-500">Ringkasan asisten</dt>
                                                <dd className="mt-0.5 text-gray-800">
                                                    {active.ringkasan ?? 'Belum ada ringkasan; percakapan belum diteruskan asisten.'}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs text-gray-500">Kontak</dt>
                                                <dd className="mt-0.5 flex items-center gap-1.5 font-medium text-gray-900">
                                                    {active.kontak ? (
                                                        <>
                                                            <Phone className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" /> {active.kontak}
                                                        </>
                                                    ) : (
                                                        <span className="font-normal text-gray-500">Tidak ada</span>
                                                    )}
                                                </dd>
                                                {active.alasan && (
                                                    <>
                                                        <dt className="mt-3 text-xs text-gray-500">Alasan diteruskan</dt>
                                                        <dd className="mt-0.5 font-medium text-gray-900">
                                                            {active.alasan}
                                                            {active.diteruskan_at ? (
                                                                <span className="font-normal text-gray-500">
                                                                    {' '}
                                                                    · {formatDateTime(active.diteruskan_at)}
                                                                </span>
                                                            ) : null}
                                                        </dd>
                                                    </>
                                                )}
                                            </div>
                                            <div>
                                                <dt className="text-xs text-gray-500">Riwayat tiket</dt>
                                                <dd className="mt-0.5">
                                                    {active.riwayat_tiket && active.riwayat_tiket.length > 0 ? (
                                                        <ul className="space-y-1">
                                                            {active.riwayat_tiket.map((t) => (
                                                                <li key={t.nomor}>
                                                                    <Link href={t.url} className="text-primary font-medium hover:underline">
                                                                        {t.nomor}
                                                                    </Link>{' '}
                                                                    <span className="text-gray-500">· {t.status}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <span className="text-gray-500">
                                                            {active.tipe === 'tamu' ? 'Tamu belum dapat dikenali' : 'Belum ada tiket'}
                                                        </span>
                                                    )}
                                                </dd>
                                            </div>
                                        </dl>

                                        {closed ? (
                                            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                                                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                                Ditutup: <b>{active.hasil}</b>
                                                {active.tiket && (
                                                    <Link href={active.tiket.url} className="text-primary ml-auto font-semibold hover:underline">
                                                        Buka {active.tiket.nomor}
                                                    </Link>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                                                <ActionButton icon={Ticket} href={`/admin/input-manual?percakapan=${active.id}`} primary>
                                                    Terbitkan tiket
                                                </ActionButton>
                                                <ActionButton icon={CheckCircle2} onClick={() => close('terjawab_petugas')}>
                                                    Sudah terjawab
                                                </ActionButton>
                                                <ActionButton icon={SendHorizontal} onClick={() => close('lapor')}>
                                                    Rujuk ke LAPOR!
                                                </ActionButton>
                                                <ActionButton icon={ShieldAlert} onClick={() => close('wbs')}>
                                                    Rujuk ke WBS
                                                </ActionButton>
                                            </div>
                                        )}
                                        {!closed && (
                                            <button
                                                type="button"
                                                onClick={() => close('tidak_selesai')}
                                                className="text-xs text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline"
                                            >
                                                Tandai tidak selesai (warga tidak membalas)
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Pesan */}
                            <div className="min-h-[360px] flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 md:p-6">
                                {active.mode === 'ai' && !closed && (
                                    <p className="mb-5 rounded-lg bg-violet-50 px-4 py-2.5 text-sm text-violet-900">
                                        Sedang dijawab asisten AI. Membalas atau mengambil percakapan akan menghentikan AI.
                                    </p>
                                )}
                                <ol className="space-y-6">
                                    {active.messages.map((m) => (
                                        <MessageItem key={m.id} message={m} participant={active.nama} initial={active.inisial} />
                                    ))}
                                </ol>
                                <div ref={bottomRef} />
                            </div>

                            {/* Kolom tulis */}
                            {closed ? (
                                <p className="shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm text-gray-600">
                                    Percakapan ditutup. Akan terbuka lagi bila warga menulis pesan baru.
                                </p>
                            ) : (
                                <form onSubmit={submit} className="flex shrink-0 items-center gap-3">
                                    <label htmlFor="balasan" className="sr-only">
                                        Balasan untuk warga
                                    </label>
                                    <input
                                        id="balasan"
                                        value={reply.data.body}
                                        onChange={(e) => reply.setData('body', e.target.value)}
                                        placeholder={`Tulis balasan untuk ${active.nama}…`}
                                        autoComplete="off"
                                        className="focus:border-primary focus:ring-primary/20 h-12 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-4 text-[15px] outline-none focus:ring-2"
                                    />
                                    <button
                                        type="submit"
                                        disabled={reply.processing || reply.data.body.trim() === ''}
                                        aria-label="Kirim balasan"
                                        className="bg-primary hover:bg-primary/90 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white disabled:opacity-50"
                                    >
                                        <SendHorizontal className="h-5 w-5" />
                                    </button>
                                </form>
                            )}
                        </>
                    )}
                </section>
            </div>
        </AdminLayout>
    );
}

function MessageItem({ message: m, participant, initial }: { message: Message; participant: string; initial: string }) {
    if (m.sender_type === 'system') {
        return (
            <li className="flex justify-center">
                <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-center text-xs text-amber-900">{m.body}</span>
            </li>
        );
    }

    const fromStaff = m.sender_type === 'admin';
    const fromAi = m.sender_type === 'ai';
    const name = fromAi ? 'Asisten SIGAP' : fromStaff ? m.penulis : participant;

    return (
        <li className="flex gap-3">
            {fromAi ? (
                <span className="border-primary/20 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-white">
                    <Bot className="h-5 w-5" aria-hidden="true" />
                </span>
            ) : (
                <Avatar label={fromStaff ? (m.penulis.charAt(0) || 'P').toUpperCase() : initial} tone={fromStaff ? 'staff' : 'person'} />
            )}
            <div className="min-w-0 flex-1">
                <p className="mb-1.5 flex items-baseline gap-2 text-sm">
                    <span className="font-semibold text-gray-900">{name}</span>
                    {fromStaff && <span className="text-xs text-gray-500">Petugas</span>}
                    <span className="text-xs text-gray-500">{formatTime(m.pada)}</span>
                </p>
                <div
                    className={cn(
                        'rounded-xl px-4 py-3 text-[15px] leading-relaxed break-words whitespace-pre-wrap',
                        fromStaff ? 'bg-primary text-white' : 'border border-gray-200 bg-white text-gray-800',
                        fromAi && 'bg-gray-50',
                    )}
                >
                    {m.body}
                    {(m.sumber?.length ?? 0) > 0 && (
                        <span className="mt-3 flex flex-col gap-1 border-t border-gray-200 pt-2.5 text-xs text-gray-600">
                            {m.sumber!.map((s, i) => (
                                <span key={s.id} className="flex items-center gap-1.5">
                                    <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />[{i + 1}] {s.label ?? s.judul}
                                </span>
                            ))}
                        </span>
                    )}
                </div>
                {fromAi && m.nilai ? (
                    <p className="mt-1.5 text-xs text-gray-500">Warga menilai: {m.nilai > 0 ? 'membantu' : 'tidak membantu'}</p>
                ) : null}
            </div>
        </li>
    );
}

function EmptyState({ counts, aiEnabled, onPick }: { counts?: Record<Tab, number>; aiEnabled: boolean; onPick: (t: Tab) => void }) {
    if (!aiEnabled || !counts) {
        return (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
                <span>
                    <MessageCircleQuestion className="mx-auto mb-3 h-8 w-8 text-gray-400" aria-hidden="true" />
                    Pilih percakapan untuk membalas.
                </span>
            </div>
        );
    }

    return (
        <div className="grid flex-1 content-center gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {TABS.map((t) => (
                <button
                    key={t.value}
                    type="button"
                    onClick={() => onPick(t.value)}
                    className="hover:border-primary flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 text-center transition-colors"
                >
                    <span className="text-primary mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-gray-200">
                        <t.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-lg font-semibold text-gray-900">{t.label}</span>
                    <span className="text-primary my-1 text-2xl font-semibold tabular-nums">{counts[t.value] ?? 0}</span>
                    <span className="text-sm text-gray-600">{t.hint}</span>
                </button>
            ))}
        </div>
    );
}

function ActionButton({
    icon: Icon,
    children,
    onClick,
    href,
    primary = false,
}: {
    icon: LucideIcon;
    children: ReactNode;
    onClick?: () => void;
    href?: string;
    primary?: boolean;
}) {
    const className = cn(
        'flex h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-[13px] font-medium transition-colors sm:gap-2 sm:px-3 sm:text-sm',
        primary
            ? 'bg-primary border-primary hover:bg-primary/90 text-white'
            : 'hover:border-primary hover:text-primary border-gray-300 bg-white text-gray-800',
    );
    const content = (
        <>
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{children}</span>
        </>
    );
    return href ? (
        <Link href={href} className={className}>
            {content}
        </Link>
    ) : (
        <button type="button" onClick={onClick} className={className}>
            {content}
        </button>
    );
}

function Kpi({ label, value }: { label: string; value: string }) {
    return (
        <div className="px-4 py-3">
            <p className="text-xs text-gray-600 sm:text-sm">{label}</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums sm:text-xl">{value}</p>
        </div>
    );
}

function Avatar({ label, tone }: { label: string; tone: 'person' | 'staff' | 'ai' }) {
    return (
        <span
            className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                tone === 'staff' && 'bg-primary text-white',
                tone === 'person' && 'bg-brand-soft text-primary',
                tone === 'ai' && 'bg-violet-100 text-violet-800',
            )}
            aria-hidden="true"
        >
            {label}
        </span>
    );
}

function Tag({ tone, children }: { tone: 'violet' | 'amber' | 'sky' | 'green'; children: ReactNode }) {
    const tones = {
        violet: 'bg-violet-50 text-violet-800 ring-violet-200',
        amber: 'bg-amber-50 text-amber-900 ring-amber-200',
        sky: 'bg-sky-50 text-sky-900 ring-sky-200',
        green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    };
    return <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone])}>{children}</span>;
}

function formatRelative(value: string | null | undefined): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} mnt`;
    if (diffMin < 1440) return `${Math.round(diffMin / 60)} jam`;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

function formatTime(value: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value: string): string {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Ambil instance Echo global bila broadcasting sudah dikonfigurasi. */
function echoInstance() {
    try {
        return echoIsConfigured() ? echo() : null;
    } catch {
        return null;
    }
}
