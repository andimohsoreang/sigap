import { RecaptchaNotice } from '@/components/sigap/recaptcha-notice';
import { useRecaptcha } from '@/hooks/use-recaptcha';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import {
    AlertTriangle,
    BookOpen,
    Bot,
    ChevronDown,
    ExternalLink,
    FileText,
    Globe,
    Headset,
    KeyRound,
    Landmark,
    LogIn,
    Maximize2,
    MessagesSquare,
    Send,
    Ticket,
    UserRound,
    X,
} from 'lucide-react';
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

/** Buka widget chat tanpa mengirim pertanyaan. */
export function openSigap() {
    askSigap('');
}

/** Wajah maskot TARA (tombol peluncur & kepala jendela chat versi beranda baru). */
const TRANSI_AVATAR = '/images/tara/avatar.webp';

export interface Source {
    /** Nomor seperti tertulis di jawaban ([n]). Pesan lama tanpa nomor memakai urutan. */
    no?: number;
    /** artikel = Basis Pengetahuan yang sudah ditinjau; kutipan = langsung dari situs/berkas resmi. */
    jenis?: 'artikel' | 'kutipan';
    id?: number;
    kutipan_id?: number;
    judul: string;
    label: string | null;
    url?: string | null;
    kutipan?: string;
    diambil?: string | null;
}

export interface TicketInfo {
    nomor: string;
    status: string | null;
    status_label: string | null;
    kategori: string | null;
    kawasan: string | null;
    tenggat: string | null;
    url: string;
}

export interface PortalCardInfo {
    kode: string;
    nama: string;
    kegunaan: string;
    url: string;
    tombol: string;
    domain: string;
    tersedia: boolean;
}

export interface ReferralInfo {
    kode: string;
    url: string;
    pendamping: string | null;
}

export interface ChatMessage {
    id: number;
    body: string;
    sender_type: string;
    /** true = pesan penanya sendiri (tampil di kanan). */
    mine?: boolean;
    penulis: string;
    pada: string | null;
    jenis?: string | null;
    sumber?: Source[];
    /** Sumber resmi yang dikutip menyebut ketentuan berbeda; semua versi ditampilkan. */
    beda_sumber?: boolean;
    /** Pertanyaan kebijakan/analitis; pernyataan resmi dan data kinerja diarahkan ke PPID. */
    kebijakan?: boolean;
    tiket?: TicketInfo | null;
    portal?: PortalCardInfo | null;
    rujukan?: ReferralInfo | null;
    referensi?: string | null;
    /** Foto/dokumen yang dikirim di chat. */
    lampiran?: ChatAttachment | null;
    /** Kartu konfirmasi data dari petugas. */
    konfirmasi?: ChatConfirmation | null;
    /** Tombol buat kata sandi untuk akun yang didaftarkan petugas. */
    aktivasi?: { url: string; berlaku_sampai: string; jenis?: 'aktivasi' | 'pemulihan' } | null;
    nilai?: number | null;
}

export interface ChatAttachment {
    nama: string;
    mime: string;
    ukuran: number;
    gambar: boolean;
    url: string;
}

export interface ChatConfirmation {
    id: number;
    pengantar: string;
    data: { label: string; nilai: string }[];
    status: 'menunggu' | 'benar' | 'ubah';
    koreksi: string | null;
}

export interface Identity {
    nama: string;
    tipe: 'warga' | 'tamu';
}

export interface Assistant {
    aktif: boolean;
    mode: 'ai' | 'petugas';
    jam_layanan: string;
    petugas_tersedia: boolean;
    referensi: string | null;
    butuh_kontak: boolean;
}

export interface ChatState {
    conversation_id: number | null;
    identitas: Identity | null;
    belum_dibaca: number;
    messages: ChatMessage[];
    asisten?: Assistant;
}

export function csrfToken(): string {
    const match = document.cookie.match(new RegExp('(^|;\\s*)' + XSRF_COOKIE + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : '';
}

export function isMine(m: ChatMessage): boolean {
    return m.mine ?? (m.sender_type === 'user' || m.sender_type === 'guest');
}

export function jam(value: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export async function postJson(url: string, body: unknown): Promise<Response> {
    return fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': csrfToken() },
        body: JSON.stringify(body),
    });
}

export function merge(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
    const byId = new Map(prev.map((m) => [m.id, m]));
    incoming.forEach((m) => byId.set(m.id, m));
    return [...byId.values()].sort((a, b) => a.id - b.id);
}

/**
 * `variant="transi"` (beranda baru): tombol peluncur berwajah maskot TARA
 * dengan gelembung sapaan, dan kepala jendela memakai nama TARA.
 */
export default function LiveChatWidget({ variant = 'default' }: { variant?: 'default' | 'transi' }) {
    const transi = variant === 'transi';
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
    const [outgoing, setOutgoing] = useState<string | null>(null);
    const waitLabel = useWaitLabel(sending);
    const [error, setError] = useState<string | null>(null);
    const [queued, setQueued] = useState<string | null>(null);

    const bodyRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);
    const openRef = useRef(open);
    openRef.current = open;

    const withAi = Boolean(assistant?.aktif && assistant.mode === 'ai');
    const awaitingStaff = Boolean(assistant?.aktif && !withAi && !messages.some((m) => m.sender_type === 'admin'));

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
            setOutgoing(body);
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
                setOutgoing(null);
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
        ? `Halo${identity ? `, ${identity.nama}` : ''}! Saya TARA, asisten SIGAP. Tanyakan syarat, prosedur, atau status tiket Anda. Untuk aduan, saya bantu teruskan ke petugas.`
        : `Halo${identity ? `, ${identity.nama}` : ''}! Ada yang bisa kami bantu?`;

    return (
        <div className="no-print">
            {/* Tombol bubble */}
            {transi ? (
                <div
                    className={cn(
                        'transi-launcher fixed right-4 bottom-4 z-[100] flex items-center gap-3 sm:right-6 sm:bottom-6',
                        open && 'is-hidden',
                    )}
                >
                    {!open && (
                        <button
                            type="button"
                            onClick={() => setOpen(true)}
                            className="transi-launcher__bubble hidden rounded-2xl rounded-br-sm bg-white px-4 py-2.5 text-sm font-semibold text-[#022b4a] shadow-[0_10px_24px_rgba(0,18,36,0.18)] sm:block"
                        >
                            Ada yang bisa dibantu?
                        </button>
                    )}
                    <button
                        ref={toggleRef}
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        aria-label={open ? 'Tutup chat TARA' : unread > 0 ? `Buka chat TARA, ${unread} balasan baru` : 'Buka chat TARA'}
                        aria-expanded={open}
                        aria-controls="sigap-live-chat"
                        className="transi-launcher__face relative h-16 w-16 rounded-full border-[3px] border-[#c29642] bg-[#f8f3ef] bg-cover bg-center shadow-[0_12px_28px_rgba(0,18,36,0.35)] sm:h-[72px] sm:w-[72px]"
                        style={{ backgroundImage: `url(${TRANSI_AVATAR})` }}
                    >
                        {unread > 0 && !open && (
                            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                                {unread > 9 ? '9+' : unread}
                            </span>
                        )}
                    </button>
                </div>
            ) : (
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
            )}

            {/* Jendela chat */}
            <div
                id="sigap-live-chat"
                className={cn(
                    'fixed right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-md origin-bottom-right flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl transition-transform duration-300 sm:right-6 sm:w-96',
                    transi ? 'bottom-24 rounded-2xl sm:bottom-28' : 'bottom-20 sm:bottom-24',
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
                <div className={cn('flex items-center justify-between px-4 py-3 text-white', transi ? 'bg-[#003d68]' : 'bg-primary')}>
                    <div className="flex min-w-0 items-center gap-2">
                        {transi ? (
                            <span
                                className="h-8 w-8 shrink-0 rounded-full bg-[#f8f3ef] bg-cover bg-center ring-2 ring-white/40"
                                style={{ backgroundImage: `url(${TRANSI_AVATAR})` }}
                                aria-hidden="true"
                            />
                        ) : withAi ? (
                            <Bot className="h-5 w-5 shrink-0" aria-hidden="true" />
                        ) : (
                            <Headset className="h-5 w-5 shrink-0" aria-hidden="true" />
                        )}
                        <div className="min-w-0">
                            <p className="text-sm leading-tight font-bold">{withAi ? 'TARA' : 'Petugas SIGAP'}</p>
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
                    <div className="flex items-center gap-3">
                        <a href="/chat" aria-label="Buka chat layar penuh" title="Buka layar penuh" className="hover:opacity-80">
                            <Maximize2 className="h-4 w-4" />
                        </a>
                        <button type="button" onClick={close} aria-label="Tutup live chat" className="hover:opacity-80">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
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
                            <Bubble mine={false} ai={withAi} author={withAi ? 'TARA' : 'Petugas SIGAP'}>
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
                                            ) : m.lampiran || m.konfirmasi ? (
                                                <a
                                                    href={m.lampiran && !m.konfirmasi ? m.lampiran.url : '/chat'}
                                                    target={m.lampiran && !m.konfirmasi ? '_blank' : undefined}
                                                    rel="noopener noreferrer"
                                                    className={cn(
                                                        'mt-1.5 block font-semibold underline underline-offset-2',
                                                        isMine(m) ? 'text-white' : 'text-primary',
                                                    )}
                                                >
                                                    {m.konfirmasi
                                                        ? m.konfirmasi.status === 'menunggu'
                                                            ? 'Jawab di layar penuh'
                                                            : 'Lihat di layar penuh'
                                                        : `Lihat lampiran (${m.lampiran!.nama})`}
                                                </a>
                                            ) : undefined
                                        }
                                    >
                                        {m.sender_type === 'ai' ? <AnswerBody text={m.body} /> : m.body}
                                    </Bubble>
                                ),
                            )}

                            {outgoing && (
                                <div className="opacity-85">
                                    <Bubble mine author="Anda" time="Mengirim…">
                                        {outgoing}
                                    </Bubble>
                                </div>
                            )}

                            {outgoing && (withAi || awaitingStaff) && (
                                <p className="text-xs text-gray-500" role="status">
                                    {waitLabel}
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

/**
 * Daftar sumber di bawah jawaban asisten. Kutipan dari situs/berkas resmi
 * menampilkan potongan teks aslinya + tanggal diambil, agar warga bisa
 * mencocokkan jawaban dengan sumbernya.
 */
/**
 * Isi jawaban TARA: baris berawalan "• ", "- ", atau "1." ditampilkan sebagai
 * daftar dengan indentasi gantung agar mudah dipindai di layar ponsel.
 */
export function AnswerBody({ text }: { text: string }) {
    const blocks: ({ type: 'p'; text: string } | { type: 'ul' | 'ol'; items: string[] })[] = [];
    for (const line of text.split('\n')) {
        const bullet = line.match(/^\s*[•\-–*]\s+(.*)$/);
        const numbered = line.match(/^\s*\d{1,2}[.)]\s+(.*)$/);
        const type = bullet ? 'ul' : numbered ? 'ol' : null;
        const last = blocks[blocks.length - 1];
        if (type) {
            const item = (bullet ?? numbered)![1];
            if (last && last.type === type) last.items.push(item);
            else blocks.push({ type, items: [item] });
        } else if (line.trim() !== '') {
            if (last && last.type === 'p') last.text += `\n${line}`;
            else blocks.push({ type: 'p', text: line });
        } else {
            blocks.push({ type: 'p', text: '' });
        }
    }

    return (
        <span className="flex flex-col gap-2 whitespace-normal">
            {blocks
                .filter((b) => b.type !== 'p' || b.text !== '')
                .map((b, i) =>
                    b.type === 'p' ? (
                        <span key={i} className="whitespace-pre-wrap">
                            {b.text}
                        </span>
                    ) : b.type === 'ul' ? (
                        <ul key={i} className="flex list-disc flex-col gap-1 pl-5 marker:text-current/60">
                            {b.items.map((it, j) => (
                                <li key={j}>{it}</li>
                            ))}
                        </ul>
                    ) : (
                        <ol key={i} className="flex list-decimal flex-col gap-1 pl-5 marker:text-current/60">
                            {b.items.map((it, j) => (
                                <li key={j}>{it}</li>
                            ))}
                        </ol>
                    ),
                )}
        </span>
    );
}

/**
 * Label tunggu bertahap: jawaban AI butuh beberapa detik, jadi warga diberi
 * tahu apa yang sedang terjadi alih-alih titik-titik saja.
 */
export function useWaitLabel(active: boolean): string {
    const [stage, setStage] = useState(0);

    useEffect(() => {
        if (!active) return;
        const timers = [setTimeout(() => setStage(1), 3000), setTimeout(() => setStage(2), 9000)];
        return () => {
            timers.forEach(clearTimeout);
            setStage(0);
        };
    }, [active]);

    return ['TARA sedang mengetik…', 'TARA sedang mencari di sumber resmi…', 'Masih menyusun jawaban, mohon tunggu sebentar…'][stage];
}

/**
 * Daftar sumber jawaban. Ringkas secara bawaan (judul saja) agar jawaban
 * tetap mudah dibaca di layar ponsel; kutipan dibuka bila diminta.
 */
export function SourceList({ sources }: { sources: Source[] }) {
    const [open, setOpen] = useState(false);
    const sorted = [...sources].sort((a, b) => (a.no ?? 0) - (b.no ?? 0));
    const hasQuotes = sorted.some((s) => s.jenis === 'kutipan' && (s.kutipan || s.label));

    return (
        <div className="mt-2 flex flex-col gap-1.5 border-t border-dashed border-gray-200 pt-2 whitespace-normal">
            <span className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold tracking-wide text-gray-500 uppercase">Sumber resmi ({sorted.length})</span>
                {hasQuotes && (
                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        aria-expanded={open}
                        className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                    >
                        {open ? 'Sembunyikan kutipan' : 'Lihat kutipan'}
                        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} aria-hidden="true" />
                    </button>
                )}
            </span>
            {sorted.map((s, i) => {
                const no = s.no ?? i + 1;
                const Icon = s.jenis === 'kutipan' ? (s.url?.startsWith('/sumber/') || !s.url ? FileText : Globe) : BookOpen;
                const title = s.jenis === 'kutipan' ? s.judul : (s.label ?? s.judul);
                const head = (
                    <>
                        <Icon className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className={cn(!open && 'line-clamp-2')}>
                            [{no}] {title}
                        </span>
                        {s.url && (
                            <>
                                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                                <span className="sr-only">(buka sumber di tab baru)</span>
                            </>
                        )}
                    </>
                );

                return (
                    <div key={`${s.jenis ?? 'artikel'}-${s.id ?? s.kutipan_id ?? i}`} className="flex flex-col gap-1">
                        {s.url ? (
                            <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={title}
                                className="text-primary flex items-start gap-1 text-[11px] font-semibold hover:underline"
                            >
                                {head}
                            </a>
                        ) : (
                            <span title={title} className="text-primary flex items-start gap-1 text-[11px] font-semibold">
                                {head}
                            </span>
                        )}
                        {open && s.jenis === 'kutipan' && (
                            <>
                                {s.kutipan && (
                                    <blockquote className="line-clamp-3 border-l-2 border-gray-300 pl-2 text-[11px] leading-snug text-gray-600 italic">
                                        “{s.kutipan}”
                                    </blockquote>
                                )}
                                {s.label && <span className="pl-2 text-[10px] text-gray-500">{s.label}</span>}
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/** Sumber, kartu status tiket, dan tombol penilaian di bawah jawaban asisten. */
export function AiExtras({
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

            {message.portal && <PortalCard portal={message.portal} referral={message.rujukan ?? null} />}

            {message.beda_sumber && (
                <div className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-snug whitespace-normal text-amber-900">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                        <strong>Sumber resmi menyebut ketentuan berbeda.</strong> Semua versi ditampilkan beserta sumbernya. Pastikan ketentuan yang
                        berlaku ke petugas atau dinas transmigrasi kabupaten/kota.
                    </span>
                </div>
            )}
            {message.kebijakan && (
                <div className="mt-2 flex items-start gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-2 text-[11px] leading-snug whitespace-normal text-blue-900">
                    <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                        <strong>Pertanyaan kebijakan.</strong> Untuk pernyataan resmi atau data kinerja, ajukan permohonan informasi ke{' '}
                        <a
                            href="https://ppid.transmigrasi.go.id"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 font-semibold underline"
                        >
                            PPID Kementerian Transmigrasi
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            <span className="sr-only">(membuka tab baru)</span>
                        </a>
                        .
                    </span>
                </div>
            )}
            {(message.sumber?.length ?? 0) > 0 && <SourceList sources={message.sumber!} />}

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

export function SystemNotice({ message }: { message: ChatMessage }) {
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
            {message.jenis === 'aktivasi' &&
                (message.aktivasi ? (
                    <a
                        href={message.aktivasi.url}
                        className="bg-primary mt-2 flex items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-[13px] font-semibold text-white hover:opacity-90"
                    >
                        <KeyRound className="h-4 w-4" aria-hidden="true" />{' '}
                        {message.aktivasi.jenis === 'pemulihan' ? 'Buat kata sandi baru' : 'Buat kata sandi'}
                    </a>
                ) : (
                    <span className="mt-1 block font-semibold">Tautan ini sudah tidak berlaku. Minta tautan baru ke petugas.</span>
                ))}
            {message.portal && (
                <div className="text-left text-gray-800">
                    <PortalCard portal={message.portal} referral={message.rujukan ?? null} />
                </div>
            )}
        </div>
    );
}

/**
 * Kartu portal tujuan. Dengan rujukan, tombol utama membuka halaman
 * pengantar SIGAP (langkah, ringkasan, tempat bukti) — bukan portal langsung.
 */
export function PortalCard({ portal, referral }: { portal: PortalCardInfo; referral: ReferralInfo | null }) {
    return (
        <div className="mt-2 overflow-hidden rounded-md border border-gray-200 bg-white whitespace-normal">
            <div className="px-2.5 py-2">
                <span className="text-primary flex items-center gap-1 text-[12px] font-bold">
                    <Globe className="h-3.5 w-3.5" aria-hidden="true" /> {portal.nama}
                </span>
                <p className="mt-0.5 text-[11px] text-gray-600">{portal.kegunaan}</p>
                <p className="mt-0.5 font-mono text-[10px] text-gray-400">{portal.domain}</p>
                {referral && (
                    <p className="mt-1 text-[11px] text-gray-600">
                        Rujukan <span className="font-mono font-semibold">{referral.kode}</span>
                        {referral.pendamping && <> · pendamping {referral.pendamping}</>}
                    </p>
                )}
            </div>
            {referral ? (
                <a href={referral.url} className="bg-primary block px-2.5 py-1.5 text-center text-[12px] font-semibold text-white hover:opacity-90">
                    Buka pengantar &amp; langkahnya
                </a>
            ) : portal.tersedia ? (
                <a
                    href={portal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary flex items-center justify-center gap-1 border-t border-gray-100 px-2.5 py-1.5 text-[12px] font-semibold hover:underline"
                >
                    {portal.tombol} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    <span className="sr-only">(membuka tab baru)</span>
                </a>
            ) : (
                <p className="border-t border-gray-100 px-2.5 py-1.5 text-center text-[11px] text-amber-700">Portal sedang tidak dapat diakses.</p>
            )}
        </div>
    );
}

/** Kontak untuk dihubungi petugas di luar jam layanan. */
export function ContactForm({ reference, onSaved }: { reference: string | null; onSaved: (reply: ChatMessage[], state: Assistant) => void }) {
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
