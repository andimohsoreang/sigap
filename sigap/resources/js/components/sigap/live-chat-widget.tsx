import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { Headset, MessagesSquare, Send, X } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';

/**
 * Widget Live Chat SIGAP (PRD D5).
 *
 * - Pesan tersimpan lewat POST /chat/pesan dan disiarkan via Reverb pada
 *   channel privat `chat.{conversationId}`.
 * - Bila WebSocket tidak tersedia, widget jatuh ke polling ringan tiap 8 detik
 *   sehingga percakapan tetap berjalan (fallback yang dijanjikan TECH-SPEC §7).
 */

const XSRF_COOKIE = 'XSRF-TOKEN';

interface ChatMessage {
    id: number;
    body: string;
    sender_type: string;
    penulis: string;
    pada: string | null;
}

function csrfToken(): string {
    const match = document.cookie.match(new RegExp('(^|;\\s*)' + XSRF_COOKIE + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : '';
}

export default function LiveChatWidget() {
    const { auth } = usePage<SharedData>().props;
    // Kanal Reverb bersifat privat, jadi hanya pengguna terautentikasi
    // (warga/admin) yang berlangganan. Tamu memakai fallback polling.
    const canSubscribe = Boolean(auth?.user);
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [conversationId, setConversationId] = useState<number | null>(null);
    const bodyRef = useRef<HTMLDivElement>(null);

    const loadMessages = async () => {
        try {
            const res = await fetch('/chat/pesan', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
            if (!res.ok) return;
            const data = (await res.json()) as { messages: ChatMessage[]; conversation_id?: number };
            setMessages(data.messages ?? []);
            if (data.conversation_id) setConversationId(data.conversation_id);
        } catch {
            /* offline / WS-only: biarkan pesan lama tampil */
        }
    };

    // Muat pesan pertama & saat widget dibuka.
    useEffect(() => {
        void loadMessages();
    }, []);

    useEffect(() => {
        if (open) void loadMessages();
    }, [open]);

    // Reverb: dengarkan pesan baru pada percakapan aktif (pengguna login).
    useEffect(() => {
        if (!conversationId || !canSubscribe) return;

        let cleanup: (() => void) | undefined;

        try {
            if (echoIsConfigured()) {
                const channel = echo().private(`chat.${conversationId}`);
                channel.listen('.chat.message', (payload: ChatMessage) => {
                    setMessages((prev) => (prev.some((m) => m.id === payload.id) ? prev : [...prev, payload]));
                });
                cleanup = () => echo().leave(`chat.${conversationId}`);
            }
        } catch {
            cleanup = undefined;
        }

        // Fallback polling ringan bila WebSocket tidak aktif.
        const timer = window.setInterval(() => void loadMessages(), 8000);

        return () => {
            cleanup?.();
            window.clearInterval(timer);
        };
    }, [conversationId, canSubscribe]);

    // Auto-scroll ke pesan terbaru.
    useEffect(() => {
        bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, open]);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        const body = input.trim();
        if (!body || sending) return;

        setSending(true);
        setInput('');

        try {
            const res = await fetch('/chat/pesan', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': csrfToken(),
                },
                body: JSON.stringify({ body }),
            });

            if (res.ok) {
                const data = (await res.json()) as { message: ChatMessage; conversation_id?: number };
                setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
                if (data.conversation_id) setConversationId(data.conversation_id);
            } else {
                setInput(body); // pulihkan agar tidak hilang saat gagal
            }
        } catch {
            setInput(body);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="no-print">
            {/* Tombol bubble */}
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? 'Tutup live chat' : 'Buka live chat'}
                aria-expanded={open}
                className={cn(
                    'bg-secondary fixed right-6 bottom-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_4px_15px_rgba(195,161,103,0.4)] transition-transform hover:scale-110',
                    open && 'scale-0',
                )}
            >
                <MessagesSquare className="h-6 w-6" />
            </button>

            {/* Jendela chat */}
            <div
                className={cn(
                    'dark:bg-dark-card fixed right-6 bottom-24 z-[100] flex w-80 origin-bottom-right flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl transition-transform duration-300 dark:border-gray-700',
                    open ? 'scale-100' : 'pointer-events-none scale-0',
                )}
                role="dialog"
                aria-label="Live chat SIGAP"
            >
                <div className="bg-primary flex items-center justify-between px-4 py-3 text-white dark:bg-blue-900">
                    <div className="flex items-center gap-2">
                        <Headset className="h-5 w-5" />
                        <span className="text-sm font-bold">Admin SIGAP</span>
                    </div>
                    <button type="button" onClick={() => setOpen(false)} aria-label="Tutup live chat" className="hover:opacity-80">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div
                    ref={bodyRef}
                    role="log"
                    aria-live="polite"
                    aria-label="Riwayat percakapan"
                    className="flex h-64 flex-col gap-3 overflow-y-auto scroll-smooth bg-gray-50 p-4 text-sm dark:bg-gray-900"
                >
                    {/* Sapaan pembuka (paritas tampilan lama). */}
                    <div className="flex gap-2">
                        <div className="bg-brand-light flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white">
                            <Headset className="h-4 w-4" />
                        </div>
                        <div className="max-w-[85%] rounded-lg border border-gray-100 bg-white p-2.5 text-xs shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                            Halo! 👋 Ada yang bisa dibantu?
                        </div>
                    </div>

                    {messages.map((m) => (
                        <div key={m.id} className={cn('flex gap-2', m.sender_type === 'admin' && 'justify-end')}>
                            {m.sender_type !== 'admin' && (
                                <div className="bg-brand-light flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white">
                                    <Headset className="h-4 w-4" />
                                </div>
                            )}
                            <div
                                className={cn(
                                    'max-w-[85%] rounded-lg p-2.5 text-xs shadow-sm',
                                    m.sender_type === 'admin'
                                        ? 'bg-primary rounded-tr-none text-white'
                                        : 'rounded-tl-none border border-gray-100 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200',
                                )}
                            >
                                {m.body}
                            </div>
                        </div>
                    ))}
                </div>

                <form onSubmit={submit} className="dark:bg-dark-card flex items-center gap-2 border-t border-gray-200 p-3 dark:border-gray-700">
                    <label htmlFor="sigap-chat-input" className="sr-only">
                        Ketik pesan
                    </label>
                    <input
                        id="sigap-chat-input"
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ketik pesan..."
                        autoComplete="off"
                        className="flex-grow rounded-full border px-4 py-2 text-xs focus:outline-none dark:bg-gray-800 dark:text-white"
                    />
                    <button
                        type="submit"
                        disabled={sending}
                        aria-label="Kirim pesan"
                        className="bg-brand-light flex h-9 w-9 items-center justify-center rounded-full text-white disabled:opacity-50"
                    >
                        <Send className="h-4 w-4" />
                    </button>
                </form>
            </div>
        </div>
    );
}
