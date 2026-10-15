import { RecaptchaNotice } from '@/components/sigap/recaptcha-notice';
import { useRecaptcha } from '@/hooks/use-recaptcha';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { BookOpen, Bot, Headset, LogIn, MessagesSquare, Send, Ticket, UserRound, X } from 'lucide-react';
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

/**
 * Widget chat SIGAP (contact center).
 *
 * Alur:
 * 1. Warga login → langsung chat atas nama akunnya.
 *    Tamu → isi NAMA dulu (POST /chat/mulai) atau pilih "Masuk sebagai warga".
 * 2. Bila asisten AI aktif, pertanyaan dijawab AI dari Basis Pengetahuan
 *    (dengan sumber). Aduan, pertanyaan pribadi, atau permintaan warga
 *    diteruskan ke petugas (POST /chat/petugas). Di luar jam layanan warga
 *    diminta meninggalkan kontak (POST /chat/kontak).
 * 3. Balasan petugas datang via Reverb (kanal privat `chat.{id}`, hanya
 *    pengguna login) dan/atau polling (tamu selalu polling).
 * 4. Halaman lain dapat membuka widget dengan pertanyaan siap kirim lewat
 *    event `sigap:tanya` (lihat {@link askSigap}).
 */

const XSRF_COOKIE = 'XSRF-TOKEN';
const POLL_OPEN_MS = 8000;
const POLL_CLOSED_MS = 30000;
export const ASK_EVENT = 'sigap:tanya';

/** Buka widget chat dan kirim pertanyaan (dipakai kotak tanya beranda). */
export function askSigap(question: string) {
    window.dispatchEvent(new CustomEvent<{ question: string }>(ASK_EVENT, { detail: { question } }));
}

interface Source {
    id: number;
    judul: string;
    label: string | null;
}

interface TicketInfo {
    nomor: string;
    status: string | null;
    status_label: string | null;
    kategori: string | null;
    kawasan: string | null;
    tenggat: string | null;
    url: string;
}

interface ChatMessage {
    id: number;
    body: string;
    sender_type: string;
    /** true = pesan penanya sendiri (tampil di kanan). */
    mine?: boolean;
    penulis: string;
    pada: string | null;
    jenis?: string | null;
    sumber?: Source[];
    tiket?: TicketInfo | null;
    referensi?: string | null;
    nilai?: number | null;
}

interface Identity {
    nama: string;
    tipe: 'warga' | 'tamu';
}

interface Assistant {
    aktif: boolean;
    mode: 'ai' | 'petugas';
    jam_layanan: string;
    petugas_tersedia: boolean;
    referensi: string | null;
    butuh_kontak: boolean;
}

interface ChatState {
    conversation_id: number | null;
    identitas: Identity | null;
    belum_dibaca: number;
    messages: ChatMessage[];
    asisten?: Assistant;
}

function csrfToken(): string {
    const match = document.cookie.match(new RegExp('(^|;\\s*)' + XSRF_COOKIE + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : '';
}

function isMine(m: ChatMessage): boolean {
    return m.mine ?? (m.sender_type === 'user' || m.sender_type === 'guest');
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

function merge(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
    const byId = new Map(prev.map((m) => [m.id, m]));
    incoming.forEach((m) => byId.set(m.id, m));
    return [...byId.values()].sort((a, b) => a.id - b.id);
}

export default function LiveChatWidget() {
    const { auth } = usePage<SharedData>().props;
    const loggedIn = Boolean(auth?.user);

    const [open, setOpen] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [identity, setIdentity] = useState<Identity | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [assistant, setAssistant] = useState<Assistant | null>(null);
    const [unread, setUnread] = useState(0);
    const [conversationId, setConversationId] = useState<number | null>(null);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [queued, setQueued] = useState<string | null>(null);

    const bodyRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);
    const openRef = useRef(open);
    openRef.current = open;

    const withAi = Boolean(assistant?.aktif && assistant.mode === 'ai');

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
            setAssistant(data.asisten ?? null);
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
                setMessages((prev) => merge(prev, [payload]));
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
    }, [messages, open, sending]);

    const send = useCallback(
        async (body: string) => {
            if (!body || sending) return;

            setSending(true);
            setError(null);
            setInput('');

            try {
                const res = await postJson('/chat/pesan', { body });
                if (res.ok) {
                    const data = (await res.json()) as {
                        message: ChatMessage;
                        balasan?: ChatMessage[];
                        conversation_id?: number;
                        asisten?: Assistant;
                    };
                    setMessages((prev) => merge(prev, [data.message, ...(data.balasan ?? [])]));
                    if (data.conversation_id) setConversationId(data.conversation_id);
                    if (data.asisten) setAssistant(data.asisten);
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
        },
        [sending],
    );

    const needsIdentity = loaded && !loggedIn && !identity;

    // Pertanyaan dari halaman lain (kotak tanya beranda).
    useEffect(() => {
        const onAsk = (e: Event) => {
            const question = (e as CustomEvent<{ question: string }>).detail?.question?.trim();
            setOpen(true);
            if (question) setQueued(question);
        };
        window.addEventListener(ASK_EVENT, onAsk);
        return () => window.removeEventListener(ASK_EVENT, onAsk);
    }, []);

    // Kirim pertanyaan antrean begitu identitas siap.
    useEffect(() => {
        if (!queued || !loaded || needsIdentity || sending) return;
        const question = queued;
        setQueued(null);
        void send(question);
    }, [queued, loaded, needsIdentity, sending, send]);

    const close = () => {
        setOpen(false);
        toggleRef.current?.focus();
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        void send(input.trim());
    };

    const requestStaff = async () => {
        if (sending) return;
        setSending(true);
        setError(null);
        try {
            const res = await postJson('/chat/petugas', {});
            const data = (await res.json().catch(() => ({}))) as { balasan?: ChatMessage[]; asisten?: Assistant; message?: string };
            if (res.ok) {
                setMessages((prev) => merge(prev, data.balasan ?? []));
                if (data.asisten) setAssistant(data.asisten);
            } else {
                setError(data.message ?? 'Gagal menghubungi petugas. Coba lagi.');
            }
        } catch {
            setError('Tidak ada koneksi. Coba lagi.');
        } finally {
            setSending(false);
        }
    };

    const rate = async (m: ChatMessage, helpful: boolean) => {
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, nilai: helpful ? 1 : -1 } : x)));
        await postJson(`/chat/pesan/${m.id}/nilai`, { membantu: helpful }).catch(() => undefined);
    };

    const greeting = withAi
        ? `Halo${identity ? `, ${identity.nama}` : ''}! Saya Asisten SIGAP. Tanyakan syarat, prosedur, atau status tiket Anda. Untuk aduan, saya bantu teruskan ke petugas.`
        : `Halo${identity ? `, ${identity.nama}` : ''}! Ada yang bisa kami bantu?`;

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
                    'fixed right-4 bottom-20 z-[100] flex w-[calc(100vw-2rem)] max-w-md origin-bottom-right flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl transition-transform duration-300 sm:right-6 sm:bottom-24 sm:w-96',
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
                        {withAi ? (
                            <Bot className="h-5 w-5 shrink-0" aria-hidden="true" />
                        ) : (
                            <Headset className="h-5 w-5 shrink-0" aria-hidden="true" />
                        )}
                        <div className="min-w-0">
                            <p className="text-sm leading-tight font-bold">{withAi ? 'Asisten SIGAP' : 'Petugas SIGAP'}</p>
                            <p className="truncate text-[11px] leading-tight opacity-85">
                                {withAi
                                    ? 'Menjawab dari sumber resmi'
                                    : assistant?.aktif && !assistant.petugas_tersedia
                                      ? `Petugas: ${assistant.jam_layanan}`
                                      : identity
                                        ? `Anda: ${identity.nama} · ${identity.tipe === 'warga' ? 'Warga terdaftar' : 'Tamu'}`
                                        : 'Live chat'}
                            </p>
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
                            void load(true);
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
                            className="flex h-96 max-h-[60vh] flex-col gap-3 overflow-y-auto scroll-smooth bg-gray-50 p-4 text-sm"
                        >
                            <Bubble mine={false} ai={withAi} author={withAi ? 'Asisten SIGAP' : 'Petugas SIGAP'}>
                                {greeting}
                            </Bubble>

                            {messages.map((m) =>
                                m.sender_type === 'system' ? (
                                    <SystemNotice key={m.id} message={m} />
                                ) : (
                                    <Bubble
                                        key={m.id}
                                        mine={isMine(m)}
                                        ai={m.sender_type === 'ai'}
                                        author={isMine(m) ? 'Anda' : m.penulis}
                                        time={jam(m.pada)}
                                        footer={
                                            m.sender_type === 'ai' ? (
                                                <AiExtras
                                                    message={m}
                                                    onRate={(helpful) => void rate(m, helpful)}
                                                    onStaff={() => void requestStaff()}
                                                    canAskStaff={withAi}
                                                />
                                            ) : undefined
                                        }
                                    >
                                        {m.body}
                                    </Bubble>
                                ),
                            )}

                            {sending && withAi && (
                                <p className="text-xs text-gray-500" role="status">
                                    Asisten sedang menyiapkan jawaban…
                                </p>
                            )}
                        </div>

                        {assistant?.butuh_kontak && (
                            <ContactForm
                                reference={assistant.referensi}
                                onSaved={(reply, state) => {
                                    setMessages((prev) => merge(prev, reply));
                                    setAssistant(state);
                                }}
                            />
                        )}

                        {error && (
                            <p role="alert" className="border-t border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                                {error}
                            </p>
                        )}

                        {withAi && (
                            <div className="flex justify-center border-t border-gray-100 bg-white px-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => void requestStaff()}
                                    disabled={sending}
                                    className="border-primary text-primary flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50"
                                >
                                    <Headset className="h-3.5 w-3.5" aria-hidden="true" /> Bicara dengan petugas
                                </button>
                            </div>
                        )}

                        <form onSubmit={submit} className="flex items-center gap-2 bg-white p-3">
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
                                placeholder={withAi ? 'Tulis pertanyaan…' : 'Ketik pesan...'}
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

function Bubble({
    mine,
    ai = false,
    author,
    time,
    footer,
    children,
}: {
    mine: boolean;
    ai?: boolean;
    author: string;
    time?: string;
    footer?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className={cn('flex gap-2', mine && 'justify-end')}>
            {!mine && (
                <div className="bg-brand-light flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white" aria-hidden="true">
                    {ai ? <Bot className="h-4 w-4" /> : <Headset className="h-4 w-4" />}
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
                    {footer}
                </div>
                {time && (
                    <span className="mt-0.5 text-[10px] text-gray-500">
                        {!mine && `${author} · `}
                        {time}
                    </span>
                )}
            </div>
        </div>
    );
}

/** Sumber, kartu status tiket, dan tombol penilaian di bawah jawaban asisten. */
function AiExtras({
    message,
    onRate,
    onStaff,
    canAskStaff,
}: {
    message: ChatMessage;
    onRate: (helpful: boolean) => void;
    onStaff: () => void;
    canAskStaff: boolean;
}) {
    const t = message.tiket;

    return (
        <>
            {t && (
                <div className="mt-2 overflow-hidden rounded-md border border-gray-200 whitespace-normal">
                    <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-2.5 py-1.5">
                        <span className="text-primary flex items-center gap-1 font-bold">
                            <Ticket className="h-3.5 w-3.5" aria-hidden="true" /> {t.nomor}
                        </span>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 uppercase">{t.status_label}</span>
                    </div>
                    <dl className="grid grid-cols-[70px_1fr] gap-x-2 gap-y-1 px-2.5 py-2 text-[11px]">
                        <dt className="text-gray-500">Kategori</dt>
                        <dd className="font-semibold">{t.kategori ?? '—'}</dd>
                        <dt className="text-gray-500">Kawasan</dt>
                        <dd className="font-semibold">{t.kawasan ?? '—'}</dd>
                        <dt className="text-gray-500">Batas waktu</dt>
                        <dd className="font-semibold">
                            {t.tenggat ? new Date(t.tenggat).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </dd>
                    </dl>
                    <Link href={t.url} className="text-primary block border-t border-gray-100 px-2.5 py-1.5 font-semibold hover:underline">
                        Lihat riwayat lengkap
                    </Link>
                </div>
            )}

            {(message.sumber?.length ?? 0) > 0 && (
                <div className="mt-2 flex flex-col gap-1 border-t border-dashed border-gray-200 pt-2 whitespace-normal">
                    {message.sumber!.map((s, i) => (
                        <span key={s.id} className="text-primary flex items-start gap-1 text-[11px] font-semibold">
                            <BookOpen className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />[{i + 1}] {s.label ?? s.judul}
                        </span>
                    ))}
                </div>
            )}

            {message.jenis === 'jawaban' && (
                <div className="mt-2 flex items-center gap-2 text-[11px] whitespace-normal text-gray-500">
                    {message.nilai ? (
                        <span>Terima kasih atas penilaian Anda.</span>
                    ) : (
                        <>
                            Membantu?
                            <button
                                type="button"
                                onClick={() => onRate(true)}
                                className="rounded-full border border-gray-300 px-2 py-0.5 hover:bg-gray-50"
                            >
                                Ya
                            </button>
                            <button
                                type="button"
                                onClick={() => onRate(false)}
                                className="rounded-full border border-gray-300 px-2 py-0.5 hover:bg-gray-50"
                            >
                                Tidak
                            </button>
                        </>
                    )}
                </div>
            )}

            {(message.jenis === 'tidak_tahu' || message.jenis === 'tidak_jelas') && canAskStaff && (
                <button
                    type="button"
                    onClick={onStaff}
                    className="border-primary text-primary mt-2 flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-normal hover:bg-gray-50"
                >
                    <Headset className="h-3 w-3" aria-hidden="true" /> Tanyakan ke petugas
                </button>
            )}
        </>
    );
}

function SystemNotice({ message }: { message: ChatMessage }) {
    const amber = message.jenis === 'diteruskan' || message.jenis === 'minta_kontak' || message.jenis === 'kontak_tersimpan';

    return (
        <div
            className={cn(
                'mx-auto max-w-[92%] rounded-lg border px-3 py-2 text-center text-[11px] leading-relaxed whitespace-pre-wrap',
                amber ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900',
            )}
        >
            {message.body}
            {message.referensi && <span className="mt-1 block font-bold">Nomor referensi: {message.referensi}</span>}
        </div>
    );
}

/** Kontak untuk dihubungi petugas di luar jam layanan. */
function ContactForm({ reference, onSaved }: { reference: string | null; onSaved: (reply: ChatMessage[], state: Assistant) => void }) {
    const [value, setValue] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (busy || value.trim() === '') return;
        setBusy(true);
        setError(null);
        try {
            const res = await postJson('/chat/kontak', { kontak: value.trim() });
            const data = (await res.json().catch(() => ({}))) as {
                balasan?: ChatMessage[];
                asisten?: Assistant;
                errors?: Record<string, string[]>;
                message?: string;
            };
            if (res.ok && data.asisten) onSaved(data.balasan ?? [], data.asisten);
            else setError(data.errors?.kontak?.[0] ?? data.message ?? 'Kontak belum tersimpan.');
        } catch {
            setError('Tidak ada koneksi. Coba lagi.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <form onSubmit={submit} className="space-y-2 border-t border-amber-200 bg-amber-50 p-3">
            <label htmlFor="sigap-chat-contact" className="block text-xs font-semibold text-amber-900">
                Nomor WhatsApp atau surel {reference ? `(ref. ${reference})` : ''}
            </label>
            <div className="flex gap-2">
                <input
                    id="sigap-chat-contact"
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    maxLength={100}
                    autoComplete="tel"
                    placeholder="08xx-xxxx-xxxx"
                    aria-invalid={Boolean(error)}
                    className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-xs focus:outline-none"
                />
                <button type="submit" disabled={busy} className="bg-primary rounded-lg px-3 text-xs font-bold text-white disabled:opacity-60">
                    {busy ? 'Menyimpan…' : 'Simpan'}
                </button>
            </div>
            {error && (
                <p role="alert" className="text-xs text-rose-600">
                    {error}
                </p>
            )}
            <p className="text-[11px] text-amber-900">Kontak hanya dipakai petugas untuk menindaklanjuti percakapan ini.</p>
        </form>
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
                    Halo! Sebelum mulai, boleh kami tahu nama Anda? Agar petugas tahu siapa yang bertanya bila pertanyaan Anda perlu diteruskan.
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
