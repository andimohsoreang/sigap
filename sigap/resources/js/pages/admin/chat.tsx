import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CHAT_UNREAD_EVENT, type ChatUnreadPayload } from '@/hooks/use-chat-unread';
import AdminLayout from '@/layouts/admin-layout';
import { cn } from '@/lib/utils';
import { router, useForm } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { BadgeCheck, Search, Send, UserRound } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';

interface Conversation {
    id: number;
    nama: string;
    inisial: string;
    tipe: 'warga' | 'tamu';
    subjek: string | null;
    cuplikan: string | null;
    unread: number;
    last_message_at: string | null;
}

interface Message {
    id: number;
    body: string;
    sender_type: string;
    penulis: string;
    pada: string | null;
    dibaca?: boolean;
}

interface Active {
    id: number;
    nama: string;
    inisial: string;
    tipe: 'warga' | 'tamu';
    username: string | null;
    jumlah_tiket: number | null;
    mulai: string | null;
    messages: Message[];
}

interface Props {
    conversations: Conversation[];
    active: Active | null;
}

/** Muat ulang daftar (dan utas aktif) tanpa kehilangan posisi gulir. */
function refresh(includeActive: boolean) {
    router.reload({ only: includeActive ? ['active', 'conversations', 'chat_unread'] : ['conversations', 'chat_unread'] });
}

export default function Chat({ conversations, active }: Props) {
    const [search, setSearch] = useState('');
    const reply = useForm({ body: '' });

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return conversations;
        return conversations.filter((c) => c.nama.toLowerCase().includes(q) || (c.cuplikan ?? '').toLowerCase().includes(q));
    }, [conversations, search]);

    const activeId = active?.id;
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
            router.get('/admin/chat', { conversation: activeId }, { replace: true, preserveState: true, preserveScroll: true });
        }
    }, [activeId]);

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

    const open = (id: number) => router.get('/admin/chat', { conversation: id }, { preserveState: true, preserveScroll: true });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (!active) return;
        reply.post(`/admin/chat/${active.id}/balas`, { preserveScroll: true, onSuccess: () => reply.reset('body') });
    };

    return (
        <AdminLayout title="Pesan Masuk (Live Chat)" subtitle="Percakapan real-time via Laravel Reverb.">
            <div className="flex h-[600px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:flex-row">
                {/* Daftar percakapan */}
                <div className="flex w-full flex-col border-r border-gray-200 bg-gray-50 lg:w-1/3">
                    <div className="border-b border-gray-200 p-4">
                        <div className="relative">
                            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari obrolan..." className="pl-9" />
                        </div>
                    </div>
                    <div className="flex-grow overflow-y-auto">
                        {filtered.length === 0 ? (
                            <p className="p-6 text-center text-sm text-gray-400">Belum ada percakapan.</p>
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
                                    <div className="mb-1 flex items-start justify-between">
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
                                        <span className="text-[10px] text-gray-500">{formatRelative(c.last_message_at)}</span>
                                    </div>
                                    <p className="truncate text-xs text-gray-600">{c.cuplikan ?? c.subjek ?? '—'}</p>
                                    {c.unread > 0 && (
                                        <span className="mt-1 inline-block rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                                            {c.unread}
                                        </span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Thread */}
                <div className="flex flex-grow flex-col bg-white">
                    {!active ? (
                        <div className="flex flex-grow items-center justify-center text-sm text-gray-400">Pilih percakapan untuk membalas.</div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between border-b border-gray-200 bg-white p-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-brand-light/20 text-brand-light flex h-10 w-10 items-center justify-center rounded-full font-bold">
                                        {active.inisial}
                                    </div>
                                    <div>
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
                            </div>

                            <div className="flex flex-grow flex-col gap-3 overflow-y-auto bg-gray-50 p-4">
                                {active.messages.map((m) => (
                                    <div key={m.id} className={cn('flex gap-2', m.sender_type === 'admin' && 'justify-end')}>
                                        {m.sender_type !== 'admin' && (
                                            <div className="bg-brand-light/20 text-brand-light flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                                                {active.inisial}
                                            </div>
                                        )}
                                        <div
                                            className={cn(
                                                'max-w-[80%] rounded-lg p-3 text-sm shadow-sm',
                                                m.sender_type === 'admin'
                                                    ? 'bg-brand-light rounded-tr-none text-white'
                                                    : 'rounded-tl-none border border-gray-100 bg-white text-gray-700',
                                            )}
                                        >
                                            {m.body}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <form onSubmit={submit} className="flex items-center gap-2 border-t border-gray-200 bg-white p-4">
                                <Input
                                    value={reply.data.body}
                                    onChange={(e) => reply.setData('body', e.target.value)}
                                    placeholder="Ketik balasan Anda..."
                                    className="flex-grow rounded-full"
                                />
                                <Button type="submit" disabled={reply.processing} className="h-10 w-10 rounded-full p-0">
                                    <Send className="h-4 w-4" />
                                </Button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}

function formatRelative(value: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} mnt`;
    if (diffMin < 1440) return `${Math.round(diffMin / 60)} jam`;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

/** Ambil instance Echo global bila broadcasting sudah dikonfigurasi. */
function echoInstance() {
    try {
        return echoIsConfigured() ? echo() : null;
    } catch {
        return null;
    }
}
