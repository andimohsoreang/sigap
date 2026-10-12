import { RecaptchaNotice } from '@/components/sigap/recaptcha-notice';
import { useRecaptcha } from '@/hooks/use-recaptcha';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { Headset, LogIn, MessagesSquare, Send, UserRound, X } from 'lucide-react';
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

/**
 * Widget Live Chat SIGAP (PRD D5).
 *
 * Alur:
 * 1. Warga login → langsung chat atas nama akunnya.
 *    Tamu → isi NAMA dulu (POST /chat/mulai) atau pilih "Masuk sebagai warga".
 * 2. Pesan dikirim lewat POST /chat/pesan. Balasan petugas datang via Reverb
 *    (kanal privat `chat.{id}`, hanya pengguna login) dan/atau polling
 *    (tamu selalu polling; pengguna login polling sebagai cadangan).
 * 3. Membuka widget menandai balasan petugas sudah dibaca (`?baca=1`);
 *    balasan yang datang saat widget tertutup memunculkan titik merah.
 */

const XSRF_COOKIE = 'XSRF-TOKEN';
const POLL_OPEN_MS = 8000;
const POLL_CLOSED_MS = 30000;

interface ChatMessage {
    id: number;
    body: string;
    sender_type: string;
    /** true = pesan penanya sendiri (tampil di kanan). */
    mine?: boolean;
    penulis: string;
    pada: string | null;
}

interface Identity {
    nama: string;
    tipe: 'warga' | 'tamu';
}

interface ChatState {
    conversation_id: number | null;
    identitas: Identity | null;
    belum_dibaca: number;
    messages: ChatMessage[];
}

function csrfToken(): string {
    const match = document.cookie.match(new RegExp('(^|;\\s*)' + XSRF_COOKIE + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : '';
}

function isMine(m: ChatMessage): boolean {
    return m.mine ?? (m.sender_type !== 'admin' && m.sender_type !== 'system');
}

function jam(value: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

async function postJson(url: string, body: unknown): Promise<Response> {
    return fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': csrfToken() },
        body: JSON.stringify(body),
    });
}

export default function LiveChatWidget() {
    const { auth } = usePage<SharedData>().props;
    const loggedIn = Boolean(auth?.user);

    const [open, setOpen] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [identity, setIdentity] = useState<Identity | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [unread, setUnread] = useState(0);
    const [conversationId, setConversationId] = useState<number | null>(null);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const bodyRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);
    const openRef = useRef(open);
    openRef.current = open;

    const load = useCallback(async (markRead: boolean) => {
        try {
            const res = await fetch(`/chat/pesan${markRead ? '?baca=1' : ''}`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });
            if (!res.ok) return;
            const data = (await res.json()) as ChatState;
            setMessages(data.messages ?? []);
            setIdentity(data.identitas ?? null);
            setConversationId(data.conversation_id ?? null);
            setUnread(markRead ? 0 : (data.belum_dibaca ?? 0));
        } catch {
            /* offline: biarkan pesan lama tampil */
        } finally {
            setLoaded(true);
        }
    }, []);

    // Muat status awal (identitas & titik belum-dibaca), lalu saat widget dibuka.
    useEffect(() => {
        void load(false);
    }, [load, loggedIn]);

    useEffect(() => {
        if (!open) return;
        void load(true);
        // Fokus ke kolom yang relevan setelah animasi buka.
        const t = window.setTimeout(() => {
            (document.getElementById('sigap-chat-name') ?? inputRef.current)?.focus();
        }, 150);
        return () => window.clearTimeout(t);
    }, [open, load]);

    // Polling: tamu selalu (kanal privat tidak bisa diikuti tanpa akun);
    // pengguna login sebagai cadangan bila WebSocket putus. Jeda saat tab tersembunyi.
    useEffect(() => {
        if (!conversationId) return;
        const timer = window.setInterval(
            () => {
                if (document.visibilityState === 'visible') void load(openRef.current);
            },
            open ? POLL_OPEN_MS : POLL_CLOSED_MS,
        );
        return () => window.clearInterval(timer);
    }, [conversationId, open, load]);

    // Reverb: pesan baru realtime untuk pengguna login.
    useEffect(() => {
        if (!conversationId || !loggedIn || !echoIsConfigured()) return;
        let cleanup: (() => void) | undefined;
        try {
            const channel = echo().private(`chat.${conversationId}`);
            channel.listen('.chat.message', (payload: ChatMessage) => {
                setMessages((prev) => (prev.some((m) => m.id === payload.id) ? prev : [...prev, payload]));
                if (!isMine(payload)) {
                    if (openRef.current) void load(true);
                    else setUnread((n) => n + 1);
                }
            });
            cleanup = () => echo().leave(`chat.${conversationId}`);
        } catch {
            cleanup = undefined;
        }
        return () => cleanup?.();
    }, [conversationId, loggedIn, load]);

    // Auto-scroll ke pesan terbaru.
    useEffect(() => {
        bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, open]);

    const close = () => {
        setOpen(false);
        toggleRef.current?.focus();
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        const body = input.trim();
        if (!body || sending) return;

        setSending(true);
        setError(null);
        setInput('');

        try {
            const res = await postJson('/chat/pesan', { body });
            if (res.ok) {
                const data = (await res.json()) as { message: ChatMessage; conversation_id?: number };
                setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
                if (data.conversation_id) setConversationId(data.conversation_id);
                return;
            }

            setInput(body); // pulihkan agar tidak hilang
            if (res.status === 429) {
                setError('Terlalu banyak pesan. Tunggu sebentar lalu coba lagi.');
            } else if (res.status === 422) {
                const data = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
                if (data.code === 'identity_required') setIdentity(null);
                setError(data.message ?? 'Pesan tidak valid.');
            } else {
                setError('Pesan gagal terkirim. Coba lagi.');
            }
        } catch {
            setInput(body);
            setError('Tidak ada koneksi. Pesan belum terkirim.');
        } finally {
            setSending(false);
        }
    };

    const needsIdentity = loaded && !loggedIn && !identity;

    return (
        <div className="no-print">
            {/* Tombol bubble */}
            <button
                ref={toggleRef}
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? 'Tutup live chat' : unread > 0 ? `Buka live chat, ${unread} balasan baru` : 'Buka live chat'}
                aria-expanded={open}
                aria-controls="sigap-live-chat"
                className={cn(
                    'bg-secondary fixed right-4 bottom-4 z-[100] flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_4px_15px_rgba(195,161,103,0.4)] transition-transform hover:scale-110 sm:right-6 sm:bottom-6',
                    open && 'scale-0',
                )}
            >
                <MessagesSquare className="h-6 w-6" />
                {unread > 0 && !open && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {/* Jendela chat */}
            <div
                id="sigap-live-chat"
                className={cn(
                    'fixed right-4 bottom-20 z-[100] flex w-[calc(100vw-2rem)] max-w-sm origin-bottom-right flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl transition-transform duration-300 sm:right-6 sm:bottom-24 sm:w-80',
                    open ? 'scale-100' : 'pointer-events-none scale-0',
                )}
                role="dialog"
                aria-label="Live chat SIGAP"
                aria-hidden={!open}
                inert={!open}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') close();
                }}
            >
                <div className="bg-primary flex items-center justify-between px-4 py-3 text-white">
                    <div className="flex min-w-0 items-center gap-2">
                        <Headset className="h-5 w-5 shrink-0" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="text-sm leading-tight font-bold">Petugas SIGAP</p>
                            {identity && (
                                <p className="truncate text-[11px] leading-tight opacity-85">
                                    Anda: {identity.nama} · {identity.tipe === 'warga' ? 'Warga terdaftar' : 'Tamu'}
                                </p>
                            )}
                        </div>
                    </div>
                    <button type="button" onClick={close} aria-label="Tutup live chat" className="hover:opacity-80">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {needsIdentity ? (
                    <IdentityStep
                        onStarted={(id, conv) => {
                            setIdentity(id);
                            setConversationId(conv);
                            setError(null);
                            window.setTimeout(() => inputRef.current?.focus(), 50);
                        }}
                    />
                ) : (
                    <>
                        <div
                            ref={bodyRef}
                            role="log"
                            aria-live="polite"
                            aria-label="Riwayat percakapan"
                            className="flex h-72 max-h-[55vh] flex-col gap-3 overflow-y-auto scroll-smooth bg-gray-50 p-4 text-sm"
                        >
                            <Bubble mine={false} author="Petugas SIGAP">
                                Halo{identity ? `, ${identity.nama}` : ''}! 👋 Ada yang bisa kami bantu?
                            </Bubble>

                            {messages.map((m) => (
                                <Bubble key={m.id} mine={isMine(m)} author={isMine(m) ? 'Anda' : m.penulis} time={jam(m.pada)}>
                                    {m.body}
                                </Bubble>
                            ))}
                        </div>

                        {error && (
                            <p role="alert" className="border-t border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                                {error}
                            </p>
                        )}

                        <form onSubmit={submit} className="flex items-center gap-2 border-t border-gray-200 p-3">
                            <label htmlFor="sigap-chat-input" className="sr-only">
                                Ketik pesan
                            </label>
                            <input
                                ref={inputRef}
                                id="sigap-chat-input"
                                type="text"
                                value={input}
                                maxLength={2000}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ketik pesan..."
                                autoComplete="off"
                                className="flex-grow rounded-full border px-4 py-2 text-xs focus:outline-none"
                            />
                            <button
                                type="submit"
                                disabled={sending || input.trim() === ''}
                                aria-label="Kirim pesan"
                                className="bg-brand-light flex h-9 w-9 items-center justify-center rounded-full text-white disabled:opacity-50"
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}

function Bubble({ mine, author, time, children }: { mine: boolean; author: string; time?: string; children: ReactNode }) {
    return (
        <div className={cn('flex gap-2', mine && 'justify-end')}>
            {!mine && (
                <div className="bg-brand-light flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white" aria-hidden="true">
                    <Headset className="h-4 w-4" />
                </div>
            )}
            <div className={cn('flex max-w-[85%] flex-col', mine ? 'items-end' : 'items-start')}>
                <span className="sr-only">{author}: </span>
                <div
                    className={cn(
                        'rounded-lg p-2.5 text-xs break-words whitespace-pre-wrap shadow-sm',
                        mine ? 'bg-primary rounded-tr-none text-white' : 'rounded-tl-none border border-gray-100 bg-white text-gray-700',
                    )}
                >
                    {children}
                </div>
                {time && (
                    <span className="mt-0.5 text-[10px] text-gray-400">
                        {!mine && `${author} · `}
                        {time}
                    </span>
                )}
            </div>
        </div>
    );
}

/** Langkah 1 untuk tamu: isi nama (atau masuk sebagai warga). reCAPTCHA dimuat hanya di sini. */
function IdentityStep({ onStarted }: { onStarted: (identity: Identity, conversationId: number | null) => void }) {
    const recaptcha = useRecaptcha('chat');
    const [nama, setNama] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const send = async (token: string) => {
        try {
            const res = await postJson('/chat/mulai', { nama, recaptcha_token: token });
            const data = (await res.json().catch(() => ({}))) as {
                identitas?: Identity;
                conversation_id?: number;
                message?: string;
                errors?: Record<string, string[]>;
            };
            if (res.ok && data.identitas) {
                onStarted(data.identitas, data.conversation_id ?? null);
            } else if (res.status === 429) {
                setError('Terlalu banyak percobaan. Tunggu beberapa menit.');
            } else {
                setError(data.errors?.nama?.[0] ?? data.errors?.recaptcha_token?.[0] ?? data.message ?? 'Gagal memulai chat.');
            }
        } catch {
            setError('Tidak ada koneksi. Coba lagi.');
        } finally {
            setBusy(false);
        }
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (busy) return;
        if (nama.trim().length < 2) {
            setError('Nama minimal 2 huruf.');
            return;
        }
        setError(null);
        setBusy(true);
        let called = false;
        void recaptcha
            .withToken((token) => {
                called = true;
                void send(token);
            })
            .finally(() => {
                // withToken tidak memanggil send bila skrip reCAPTCHA gagal dimuat.
                if (!called) setBusy(false);
            });
    };

    return (
        <div className="space-y-4 bg-gray-50 p-4 text-sm">
            <div className="flex gap-2">
                <div className="bg-brand-light flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white" aria-hidden="true">
                    <Headset className="h-4 w-4" />
                </div>
                <p className="rounded-lg rounded-tl-none border border-gray-100 bg-white p-2.5 text-xs text-gray-700 shadow-sm">
                    Halo! 👋 Sebelum mulai, boleh kami tahu nama Anda? Agar petugas tahu siapa yang bertanya.
                </p>
            </div>

            <form onSubmit={submit} className="space-y-2" noValidate>
                <label htmlFor="sigap-chat-name" className="block text-xs font-semibold text-gray-700">
                    Nama <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                    <UserRound className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                    <input
                        id="sigap-chat-name"
                        type="text"
                        value={nama}
                        onChange={(e) => setNama(e.target.value)}
                        maxLength={100}
                        autoComplete="name"
                        required
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? 'sigap-chat-name-error' : undefined}
                        placeholder="Nama lengkap"
                        className="w-full rounded-lg border bg-white py-2 pr-3 pl-9 text-xs focus:outline-none"
                    />
                </div>
                {error && (
                    <p id="sigap-chat-name-error" role="alert" className="text-xs text-rose-600">
                        {error}
                    </p>
                )}
                <button
                    type="submit"
                    disabled={busy || recaptcha.verifying}
                    className="bg-primary w-full rounded-lg py-2 text-xs font-bold text-white disabled:opacity-60"
                >
                    {busy || recaptcha.verifying ? 'Memulai…' : 'Mulai chat'}
                </button>
                <p className="text-[11px] text-gray-500">
                    Dengan memulai chat, Anda menyetujui{' '}
                    <Link href="/kebijakan-privasi" className="underline">
                        Kebijakan Privasi
                    </Link>
                    .
                </p>
                <RecaptchaNotice enabled={recaptcha.enabled} error={recaptcha.error} />
            </form>

            <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <span className="h-px flex-1 bg-gray-200" /> atau <span className="h-px flex-1 bg-gray-200" />
            </div>
            <Link
                href="/masuk"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
                <LogIn className="h-4 w-4" aria-hidden="true" /> Masuk sebagai warga
            </Link>
        </div>
    );
}
