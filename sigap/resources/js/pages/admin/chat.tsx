import { router, useForm } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { Send, Search } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Conversation {
    id: number;
    nama: string;
    inisial: string;
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
}

interface Active {
    id: number;
    nama: string;
    inisial: string;
    messages: Message[];
}

interface Props {
    conversations: Conversation[];
    active: Active | null;
}

export default function Chat({ conversations, active }: Props) {
    const [search, setSearch] = useState('');
    const reply = useForm({ body: '' });

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return conversations;
        return conversations.filter((c) => c.nama.toLowerCase().includes(q) || (c.cuplikan ?? '').toLowerCase().includes(q));
    }, [conversations, search]);

    // Reverb (PRD D5): pesan baru pada percakapan aktif & notifikasi tiket.
    useEffect(() => {
        const echo = echoInstance();
        if (!echo || !active) return;

        const channel = echo.private(`chat.${active.id}`);
        channel.listen('.chat.message', () => router.reload({ only: ['active', 'conversations'] }));

        return () => echo.leave(`chat.${active.id}`);
    }, [active?.id]);

    const open = (id: number) => router.get('/admin/chat', { conversation: id }, { preserveState: true, preserveScroll: true });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (!active) return;
        reply.post(`/admin/chat/${active.id}/balas`, { preserveScroll: true, onSuccess: () => reply.reset('body') });
    };

    return (
        <AdminLayout title="Pesan Masuk (Live Chat)" subtitle="Percakapan real-time via Laravel Reverb.">
            <div className="flex h-[600px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:flex-row dark:border-gray-700 dark:bg-dark-card">
                {/* Daftar percakapan */}
                <div className="flex w-full flex-col border-r border-gray-200 bg-gray-50 lg:w-1/3 dark:border-gray-700 dark:bg-gray-800">
                    <div className="border-b border-gray-200 p-4 dark:border-gray-700">
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
                                        'w-full border-b border-l-4 border-gray-100 p-4 text-left transition-colors dark:border-gray-700',
                                        active?.id === c.id ? 'border-l-brand-light bg-white dark:bg-gray-700' : 'border-l-transparent hover:bg-white dark:hover:bg-gray-700/50',
                                    )}
                                >
                                    <div className="mb-1 flex items-start justify-between">
                                        <h4 className="text-sm font-bold text-gray-800 dark:text-white">{c.nama}</h4>
                                        <span className="text-[10px] text-gray-500 dark:text-gray-400">{formatRelative(c.last_message_at)}</span>
                                    </div>
                                    <p className="truncate text-xs text-gray-600 dark:text-gray-300">{c.cuplikan ?? c.subjek ?? '—'}</p>
                                    {c.unread > 0 && <span className="mt-1 inline-block rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">{c.unread}</span>}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Thread */}
                <div className="flex flex-grow flex-col bg-white dark:bg-dark-card">
                    {!active ? (
                        <div className="flex flex-grow items-center justify-center text-sm text-gray-400">Pilih percakapan untuk membalas.</div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between border-b border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light/20 font-bold text-brand-light">{active.inisial}</div>
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-800 dark:text-white">{active.nama}</h4>
                                        <span className="text-[10px] font-bold text-green-500">● Online</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-grow flex-col gap-3 overflow-y-auto bg-gray-50 p-4 dark:bg-gray-900">
                                {active.messages.map((m) => (
                                    <div key={m.id} className={cn('flex gap-2', m.sender_type === 'admin' && 'justify-end')}>
                                        {m.sender_type !== 'admin' && (
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-light/20 text-xs font-bold text-brand-light">{active.inisial}</div>
                                        )}
                                        <div
                                            className={cn(
                                                'max-w-[80%] rounded-lg p-3 text-sm shadow-sm',
                                                m.sender_type === 'admin'
                                                    ? 'rounded-tr-none bg-brand-light text-white'
                                                    : 'rounded-tl-none border border-gray-100 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200',
                                            )}
                                        >
                                            {m.body}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <form onSubmit={submit} className="flex items-center gap-2 border-t border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                                <Input value={reply.data.body} onChange={(e) => reply.setData('body', e.target.value)} placeholder="Ketik balasan Anda..." className="flex-grow rounded-full" />
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