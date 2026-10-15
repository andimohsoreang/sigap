import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CHAT_UNREAD_EVENT, type ChatUnreadPayload } from '@/hooks/use-chat-unread';
import AdminLayout, { AdminStat } from '@/layouts/admin-layout';
import { cn } from '@/lib/utils';
import { Link, router, useForm } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { BadgeCheck, BookOpen, Bot, CheckCircle2, Clock, Hand, Phone, Search, Send, Ticket, UserRound } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';

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
    outcomes?: Record<string, string>;
}

const TABS: { value: Tab; label: string }[] = [
    { value: 'menunggu', label: 'Menunggu petugas' },
    { value: 'ai', label: 'Dijawab AI' },
    { value: 'selesai', label: 'Selesai' },
    { value: 'semua', label: 'Semua' },
];

/** Muat ulang daftar (dan utas aktif) tanpa kehilangan posisi gulir. */
function refresh(includeActive: boolean) {
    router.reload({
        only: includeActive ? ['active', 'conversations', 'chat_unread', 'tab_counts'] : ['conversations', 'chat_unread', 'tab_counts'],
    });
}

export default function Chat({
    conversations,
    active,
    tab = 'semua',
    tab_counts: tabCounts,
    ai_enabled: aiEnabled = false,
    kpi,
    outcomes = {},
}: Props) {
    const [search, setSearch] = useState('');
    const reply = useForm({ body: '' });

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return conversations;
        return conversations.filter(
            (c) => c.nama.toLowerCase().includes(q) || (c.cuplikan ?? '').toLowerCase().includes(q) || (c.referensi ?? '').toLowerCase().includes(q),
        );
    }, [conversations, search]);

    const activeId = active?.id;
    const closed = Boolean(active?.ditutup_at);
    // Pembaruan yang datang saat tab tersembunyi ditunda sampai tab terlihat lagi.
    const pending = useRef(false);
    const refreshWhenVisible = (includeActive: boolean) => {
        if (document.visibilityState === 'visible') refresh(includeActive);
        else pending.current = true;
    };

    // Pastikan URL memuat ?conversation=… agar reload berikutnya tetap di utas yang sama
    // (dan hanya utas yang benar-benar dibuka yang ditandai dibaca).
    useEffect(() => {
        if (!activeId) return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('conversation') !== String(activeId)) {
            router.get('/admin/chat', { tab, conversation: activeId }, { replace: true, preserveState: true, preserveScroll: true });
        }
    }, [activeId, tab]);

    // Pesan baru di utas aktif (termasuk balasan petugas lain) via kanal chat.{id}.
    useEffect(() => {
        const echo = echoInstance();
        if (!echo || !activeId) return;

        const channel = echo.private(`chat.${activeId}`);
        channel.listen('.chat.message', () => refreshWhenVisible(true));

        return () => echo.leave(`chat.${activeId}`);
    }, [activeId]);

    // Pesan masuk di percakapan mana pun (event dari layout, kanal admin.chat).
    // Bila tab tersembunyi, tunda sampai terlihat agar pesan tidak "terbaca" diam-diam.
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

    const open = (id: number) => router.get('/admin/chat', { tab, conversation: id }, { preserveState: true, preserveScroll: true });
    const switchTab = (value: Tab) => router.get('/admin/chat', { tab: value }, { preserveScroll: true });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (!active) return;
        reply.post(`/admin/chat/${active.id}/balas`, { preserveScroll: true, onSuccess: () => reply.reset('body') });
    };

    const take = () => active && router.post(`/admin/chat/${active.id}/ambil`, {}, { preserveScroll: true });
    const close = (hasil: string) => active && router.post(`/admin/chat/${active.id}/tutup`, { hasil }, { preserveScroll: true });

    return (
        <AdminLayout
            title={aiEnabled ? 'Kotak Masuk Percakapan' : 'Pesan Masuk (Live Chat)'}
            subtitle={aiEnabled ? 'Percakapan yang diteruskan asisten AI dan live chat warga.' : 'Percakapan real-time via Laravel Reverb.'}
        >
            {kpi && (
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <AdminStat
                        label="Selesai tanpa petugas"
                        value={kpi.selesai_tanpa_petugas === null ? '—' : `${kpi.selesai_tanpa_petugas}%`}
                        hint="30 hari terakhir"
                        icon={Bot}
                    />
                    <AdminStat
                        label="Waktu tunggu petugas"
                        value={kpi.tunggu_median_menit === null ? '—' : `${kpi.tunggu_median_menit} mnt`}
                        hint="Median sejak diteruskan"
                        tone="orange"
                        icon={Clock}
                    />
                    <AdminStat label="Percakapan" value={kpi.percakapan} hint="30 hari terakhir" tone="indigo" icon={CheckCircle2} />
                </div>
            )}

            {aiEnabled && tabCounts && (
                <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Status percakapan">
                    {TABS.map((t) => (
                        <button
                            key={t.value}
                            type="button"
                            role="tab"
                            aria-selected={tab === t.value}
                            onClick={() => switchTab(t.value)}
                            className={cn(
                                'rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors',
                                tab === t.value ? 'bg-primary text-white' : 'bg-white text-gray-700 shadow-sm hover:bg-gray-50',
                            )}
                        >
                            {t.label} · {tabCounts[t.value] ?? 0}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex flex-col gap-4 xl:flex-row">
                <div className="flex h-[640px] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:flex-row">
                    {/* Daftar percakapan */}
                    <div className="flex w-full flex-col border-r border-gray-200 bg-gray-50 lg:w-[320px] lg:shrink-0">
                        <div className="border-b border-gray-200 p-4">
                            <div className="relative">
                                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari nama, isi, atau referensi…"
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <div className="flex-grow overflow-y-auto">
                            {filtered.length === 0 ? (
                                <p className="p-6 text-center text-sm text-gray-500">Belum ada percakapan.</p>
                            ) : (
                                filtered.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => open(c.id)}
                                        className={cn(
                                            'w-full border-b border-l-4 border-gray-100 p-4 text-left transition-colors',
                                            active?.id === c.id ? 'border-l-brand-light bg-white' : 'border-l-transparent hover:bg-white',
                                        )}
                                    >
                                        <div className="mb-1 flex items-start justify-between gap-2">
                                            <h4 className="flex items-center gap-1 text-sm font-bold text-gray-800">
                                                {c.nama}
                                                {c.tipe === 'warga' ? (
                                                    <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" aria-label="Warga terdaftar" />
                                                ) : (
                                                    <span className="rounded bg-gray-200 px-1 text-[9px] font-semibold text-gray-600 uppercase">
                                                        Tamu
                                                    </span>
                                                )}
                                            </h4>
                                            <span className="shrink-0 text-[10px] text-gray-500">
                                                {formatRelative(c.diteruskan_at && !c.hasil ? c.diteruskan_at : c.last_message_at)}
                                            </span>
                                        </div>
                                        <p className="line-clamp-2 text-xs text-gray-600">{c.cuplikan ?? c.subjek ?? '—'}</p>
                                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                            {c.mode === 'ai' && !c.hasil && <Chip tone="violet">Dijawab AI</Chip>}
                                            {c.alasan && !c.hasil && <Chip tone="amber">{c.alasan}</Chip>}
                                            {c.butuh_dihubungi && <Chip tone="sky">Minta dihubungi</Chip>}
                                            {c.hasil && <Chip tone="green">{c.hasil}</Chip>}
                                            {c.unread > 0 && (
                                                <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                                    {c.unread}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Thread */}
                    <div className="flex min-w-0 flex-grow flex-col bg-white">
                        {!active ? (
                            <div className="flex flex-grow items-center justify-center text-sm text-gray-500">Pilih percakapan untuk membalas.</div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white p-4">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="bg-brand-light/20 text-brand-light flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold">
                                            {active.inisial}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-bold text-gray-800">{active.nama}</h4>
                                            {active.tipe === 'warga' ? (
                                                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                                                    <BadgeCheck className="h-3.5 w-3.5" /> Warga terdaftar
                                                    {active.username ? ` · ${active.username}` : ''}
                                                    {active.jumlah_tiket !== null ? ` · ${active.jumlah_tiket} tiket` : ''}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[11px] text-gray-500">
                                                    <UserRound className="h-3.5 w-3.5" /> Tamu · nama diisi sendiri, belum terverifikasi
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {aiEnabled && !closed && !active.milik_saya && (
                                        <Button size="sm" onClick={take} className="shrink-0 rounded-full">
                                            <Hand className="h-4 w-4" /> Ambil percakapan
                                        </Button>
                                    )}
                                </div>

                                {active.mode === 'ai' && !closed && (
                                    <p className="border-b border-violet-100 bg-violet-50 px-4 py-2 text-xs text-violet-800">
                                        Percakapan ini sedang dijawab asisten AI. Membalas atau mengambil percakapan akan menghentikan AI.
                                    </p>
                                )}

                                <div className="flex flex-grow flex-col gap-3 overflow-y-auto bg-gray-50 p-4">
                                    {active.messages.map((m) =>
                                        m.sender_type === 'system' ? (
                                            <p
                                                key={m.id}
                                                className="mx-auto max-w-[85%] rounded-lg bg-amber-50 px-3 py-1.5 text-center text-xs text-amber-900"
                                            >
                                                {m.body}
                                            </p>
                                        ) : (
                                            <div
                                                key={m.id}
                                                className={cn('flex gap-2', (m.sender_type === 'admin' || m.sender_type === 'ai') && 'justify-end')}
                                            >
                                                {m.sender_type !== 'admin' && m.sender_type !== 'ai' && (
                                                    <div className="bg-brand-light/20 text-brand-light flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                                                        {active.inisial}
                                                    </div>
                                                )}
                                                <div className="flex max-w-[80%] flex-col items-end gap-1">
                                                    {m.sender_type === 'ai' && (
                                                        <span className="flex items-center gap-1 text-[10px] text-gray-500">
                                                            <Bot className="h-3 w-3" aria-hidden="true" /> Asisten AI
                                                        </span>
                                                    )}
                                                    <div
                                                        className={cn(
                                                            'rounded-lg p-3 text-sm whitespace-pre-wrap shadow-sm',
                                                            m.sender_type === 'admin' && 'bg-brand-light rounded-tr-none text-white',
                                                            m.sender_type === 'ai' && 'bg-brand-soft text-primary rounded-tr-none',
                                                            m.sender_type !== 'admin' &&
                                                                m.sender_type !== 'ai' &&
                                                                'self-start rounded-tl-none border border-gray-100 bg-white text-gray-700',
                                                        )}
                                                    >
                                                        {m.body}
                                                        {(m.sumber?.length ?? 0) > 0 && (
                                                            <span className="mt-2 flex flex-col gap-0.5 border-t border-dashed border-current/20 pt-2 text-[11px]">
                                                                {m.sumber!.map((s, i) => (
                                                                    <span key={s.id} className="flex items-center gap-1">
                                                                        <BookOpen className="h-3 w-3" aria-hidden="true" />[{i + 1}]{' '}
                                                                        {s.label ?? s.judul}
                                                                    </span>
                                                                ))}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {m.nilai ? (
                                                        <span className="text-[10px] text-gray-500">
                                                            {m.nilai > 0 ? 'Dinilai membantu' : 'Dinilai tidak membantu'}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ),
                                    )}
                                </div>

                                {closed ? (
                                    <p className="border-t border-gray-200 bg-white p-4 text-center text-xs text-gray-500">
                                        Percakapan ditutup ({active.hasil}). Percakapan dibuka lagi bila warga menulis pesan baru.
                                    </p>
                                ) : (
                                    <form onSubmit={submit} className="flex items-center gap-2 border-t border-gray-200 bg-white p-4">
                                        <Input
                                            value={reply.data.body}
                                            onChange={(e) => reply.setData('body', e.target.value)}
                                            placeholder="Ketik balasan Anda..."
                                            aria-label="Balasan untuk warga"
                                            className="flex-grow rounded-full"
                                        />
                                        <Button
                                            type="submit"
                                            disabled={reply.processing}
                                            className="h-10 w-10 rounded-full p-0"
                                            aria-label="Kirim balasan"
                                        >
                                            <Send className="h-4 w-4" />
                                        </Button>
                                    </form>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Panel konteks */}
                {active && aiEnabled && (
                    <aside className="flex w-full flex-col gap-4 xl:w-80 xl:shrink-0" aria-label="Ringkasan dan tindakan">
                        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                            <p className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 text-xs font-bold tracking-wider text-gray-800 uppercase">
                                <Bot className="text-brand-light h-4 w-4" aria-hidden="true" /> Ringkasan dari asisten
                            </p>
                            <div className="space-y-3 p-4 text-sm">
                                <p className="whitespace-pre-wrap text-gray-700">
                                    {active.ringkasan ?? 'Belum ada ringkasan. Percakapan belum diteruskan oleh asisten.'}
                                </p>
                                <dl className="grid grid-cols-[88px_1fr] gap-x-2 gap-y-1.5 text-xs">
                                    {active.alasan && (
                                        <>
                                            <dt className="text-gray-500">Alasan</dt>
                                            <dd className="font-semibold">{active.alasan}</dd>
                                        </>
                                    )}
                                    {active.referensi && (
                                        <>
                                            <dt className="text-gray-500">Referensi</dt>
                                            <dd className="font-mono font-semibold">{active.referensi}</dd>
                                        </>
                                    )}
                                    {active.diteruskan_at && (
                                        <>
                                            <dt className="text-gray-500">Diteruskan</dt>
                                            <dd className="font-semibold">{formatDateTime(active.diteruskan_at)}</dd>
                                        </>
                                    )}
                                    {active.petugas && (
                                        <>
                                            <dt className="text-gray-500">Ditangani</dt>
                                            <dd className="font-semibold">{active.petugas}</dd>
                                        </>
                                    )}
                                </dl>
                                {active.kontak && (
                                    <p className="flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">
                                        <Phone className="h-3.5 w-3.5" aria-hidden="true" /> Hubungi: <b>{active.kontak}</b>
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                            <p className="text-xs font-bold tracking-wider text-gray-800 uppercase">{closed ? 'Hasil' : 'Tutup dengan hasil'}</p>
                            {closed ? (
                                <div className="space-y-2 text-sm">
                                    <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                                        {active.hasil}
                                    </span>
                                    {active.tiket && (
                                        <Link
                                            href={active.tiket.url}
                                            className="text-primary flex items-center gap-1 text-sm font-semibold hover:underline"
                                        >
                                            <Ticket className="h-4 w-4" aria-hidden="true" /> {active.tiket.nomor}
                                        </Link>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <Button asChild className="w-full rounded-full">
                                        <Link href={`/admin/input-manual?percakapan=${active.id}`}>
                                            <Ticket className="h-4 w-4" /> Terbitkan tiket dari percakapan
                                        </Link>
                                    </Button>
                                    {Object.entries(outcomes).map(([value, label]) => (
                                        <Button key={value} variant="outline" className="w-full rounded-full" onClick={() => close(value)}>
                                            {label}
                                        </Button>
                                    ))}
                                    <p className="pt-1 text-xs text-gray-500">AI hanya menyiapkan ringkasan. Tiket diterbitkan atas nama petugas.</p>
                                </>
                            )}
                        </div>
                    </aside>
                )}
            </div>
        </AdminLayout>
    );
}

function Chip({ tone, children }: { tone: 'violet' | 'amber' | 'sky' | 'green'; children: React.ReactNode }) {
    const tones = {
        violet: 'bg-violet-100 text-violet-800',
        amber: 'bg-amber-100 text-amber-900',
        sky: 'bg-sky-100 text-sky-900',
        green: 'bg-green-100 text-green-800',
    };
    return <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', tones[tone])}>{children}</span>;
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
