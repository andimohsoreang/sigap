import { Head, Link, usePage } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import {
    ArrowLeft,
    ArrowUpRight,
    BookOpen,
    Bot,
    Briefcase,
    Camera,
    Check,
    CheckCheck,
    ChevronRight,
    ClipboardList,
    Clock3,
    Copy,
    Download,
    FileText,
    Headset,
    History,
    Loader2,
    LogIn,
    LogOut,
    Megaphone,
    MessageCircle,
    MoreVertical,
    Paperclip,
    Search,
    SendHorizontal,
    ShieldCheck,
    Ticket,
    Timer,
    UserPlus,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { external, waLink, type KanalPublik } from '@/components/sigap/kanal-resmi';
import {
    AiExtras,
    AnswerBody,
    ContactForm,
    SystemNotice,
    csrfToken,
    isMine,
    jam,
    merge,
    postJson,
    staffActive,
    useWaitLabel,
    type Assistant,
    type ChatAttachment,
    type ChatConfirmation,
    type ChatMessage,
    type ChatState,
    type Identity,
} from '@/components/sigap/live-chat-widget';
import { RecaptchaNotice } from '@/components/sigap/recaptcha-notice';
import TransiHeader from '@/components/sigap/transi-header';
import { useRecaptcha } from '@/hooks/use-recaptcha';
import { clearPendingQuestion, leaveChat, peekPendingQuestion } from '@/lib/chat-transition';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';

/**
 * Chat TARA layar penuh (/chat) — desain pen.dev "Publik / Chat TARA".
 *
 * Memakai endpoint yang sama dengan widget (/chat/pesan, /chat/mulai, …),
 * jadi riwayat percakapan satu. Tamu mengisi nama lewat kartu "Kenalan dulu"
 * di utas; pertanyaan dari landing ditahan lalu terkirim setelah nama terisi.
 */

const AVATAR = '/images/tara/avatar.webp';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function ukuran(bytes: number): string {
    return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
const POLL_MS = 5000;

interface TicketPanelData {
    nomor: string;
    status: string | null;
    status_label: string | null;
    kategori: string | null;
    prioritas: string | null;
    dibuat_at: string | null;
    diproses_at: string | null;
    selesai_at: string | null;
    target_at: string | null;
    url: string;
}

interface Panel {
    referensi: string | null;
    dimulai_at: string | null;
    diteruskan_at: string | null;
    data_diverifikasi_at: string | null;
    konfirmasi: 'menunggu' | 'benar' | 'ubah' | null;
    ditutup: boolean;
    petugas: { nama: string; unit: string } | null;
    kontak: string | null;
    tiket: TicketPanelData | null;
}

interface Layanan {
    ai_aktif: boolean;
    jam_label: string;
    petugas_tersedia: boolean;
    tutup_pukul: string;
    median_menit: number | null;
}

const TOPICS: { icon: LucideIcon; label: string; question: string }[] = [
    { icon: Headset, label: 'Lapor masalah', question: 'Saya mau melapor masalah' },
    { icon: Search, label: 'Cek status tiket', question: 'Saya mau cek status tiket' },
    { icon: BookOpen, label: 'Syarat pendaftaran', question: 'Apa saja syarat pendaftaran transmigrasi?' },
    { icon: UserPlus, label: 'Buatkan akun', question: 'Saya mau dibuatkan akun SIGAP' },
];

/** Tombol kanal lain di atas kolom pesan; tautan ikut Admin → Pengaturan (kanal_publik). */
function channelLinks(kanal: KanalPublik): { key: string; label: string; href: string; icon: LucideIcon }[] {
    const links: { key: string; label: string; href: string; icon: LucideIcon }[] = [];
    if (kanal.lapor.aktif && kanal.lapor.url) links.push({ key: 'lapor', label: 'SP4N-LAPOR!', href: kanal.lapor.url, icon: Megaphone });
    if (kanal.sosmed.whatsapp) links.push({ key: 'wa', label: 'Hotline WA', href: waLink(kanal.sosmed.whatsapp), icon: MessageCircle });
    if (kanal.internal.aktif && kanal.internal.url) {
        links.push({ key: 'internal', label: 'Form Pengaduan Internal Pegawai', href: kanal.internal.url, icon: Briefcase });
    }
    links.push({ key: 'masyarakat', label: 'Form Pengaduan Masyarakat', href: '/pengaduan/baru', icon: ClipboardList });
    return links;
}

function tanggal(value: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const today = new Date();
    const same = d.toDateString() === today.toDateString();
    const label = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return same ? `Hari ini · ${label}` : label;
}

function tanggalPendek(value: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export default function ChatPage({ layanan, kanal }: { layanan: Layanan; kanal: KanalPublik }) {
    const { auth } = usePage<SharedData>().props;
    const loggedIn = Boolean(auth?.user);
    const recaptcha = useRecaptcha('chat');

    const [loaded, setLoaded] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [identity, setIdentity] = useState<Identity | null>(null);
    const [assistant, setAssistant] = useState<Assistant | null>(null);
    const [panel, setPanel] = useState<Panel | null>(null);
    const [conversationId, setConversationId] = useState<number | null>(null);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    // Pesan yang sedang dikirim: langsung tampil sebelum balasan TARA datang.
    const [outgoing, setOutgoing] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState<string | null>(null);
    const [resumeOpen, setResumeOpen] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [confirmEnd, setConfirmEnd] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const threadRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const pendingSent = useRef(false);

    const withAi = Boolean(assistant?.aktif && assistant.mode === 'ai');
    const needsIdentity = loaded && !loggedIn && !identity;
    const staff = panel?.petugas ?? null;
    const closed = Boolean(panel?.ditutup);
    // Diteruskan tetapi petugas tidak sedang membalas: TARA masih menjawab pertanyaan umum.
    const awaitingStaff = Boolean(assistant?.aktif && !withAi && !closed && !staffActive(messages));
    const links = useMemo(() => channelLinks(kanal), [kanal]);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/chat/pesan?baca=1', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
            if (!res.ok) return;
            const data = (await res.json()) as ChatState & { panel?: Panel | null };
            setMessages(data.messages ?? []);
            setIdentity(data.identitas ?? null);
            setConversationId(data.conversation_id ?? null);
            setAssistant(data.asisten ?? null);
            setPanel(data.panel ?? null);
        } catch {
            /* offline: tetap tampilkan pesan lama */
        } finally {
            setLoaded(true);
        }
    }, []);

    useEffect(() => {
        setPending(peekPendingQuestion());
        void load();
    }, [load]);

    // Polling saat tab terlihat (tamu tidak bisa ikut kanal privat; pengguna login sebagai cadangan).
    useEffect(() => {
        if (!conversationId) return;
        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible') void load();
        }, POLL_MS);
        return () => window.clearInterval(timer);
    }, [conversationId, load]);

    // Realtime (Reverb) untuk pengguna login.
    useEffect(() => {
        if (!conversationId || !loggedIn || !echoIsConfigured()) return;
        let cleanup: (() => void) | undefined;
        try {
            const channel = echo().private(`chat.${conversationId}`);
            channel.listen('.chat.message', (payload: ChatMessage) => {
                setMessages((prev) => merge(prev, [payload]));
                if (!isMine(payload)) void load();
            });
            cleanup = () => echo().leave(`chat.${conversationId}`);
        } catch {
            cleanup = undefined;
        }
        return () => cleanup?.();
    }, [conversationId, loggedIn, load]);

    // Kolom pesan nonaktif selama kartu nama tampil; fokuskan begitu nama tersimpan.
    useEffect(() => {
        if (loaded && !needsIdentity) inputRef.current?.focus();
    }, [loaded, needsIdentity]);

    useEffect(() => {
        threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages.length, sending, needsIdentity, pending, assistant?.butuh_kontak]);

    const send = useCallback(
        async (body: string): Promise<boolean> => {
            const text = body.trim();
            if (!text || sending) return false;
            setSending(true);
            setOutgoing(text);
            setError(null);
            try {
                const res = await postJson('/chat/pesan', { body: text });
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
                    void load();
                    return true;
                }
                if (res.status === 429) setError('Terlalu banyak pesan. Tunggu sebentar lalu coba lagi.');
                else if (res.status === 422) {
                    const data = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
                    if (data.code === 'identity_required') setIdentity(null);
                    setError(data.message ?? 'Pesan tidak valid.');
                } else setError('Pesan gagal terkirim. Coba lagi.');
            } catch {
                setError('Tidak ada koneksi. Pesan belum terkirim.');
            } finally {
                setSending(false);
                setOutgoing(null);
            }
            return false;
        },
        [sending, load],
    );

    // Pertanyaan dari landing terkirim begitu identitas siap (sekali saja).
    useEffect(() => {
        if (!loaded || needsIdentity || !pending || pendingSent.current || sending) return;
        pendingSent.current = true;
        void send(pending).then((ok) => {
            if (ok) {
                clearPendingQuestion();
                setPending(null);
            } else {
                pendingSent.current = false;
            }
        });
    }, [loaded, needsIdentity, pending, sending, send]);

    const startWithName = (nama: string) => {
        const name = nama.trim().replace(/\s+/g, ' ');
        if (name.length < 2) {
            setError('Nama minimal 2 huruf.');
            return;
        }
        setError(null);
        setSending(true);
        let called = false;
        void recaptcha
            .withToken(async (token) => {
                called = true;
                try {
                    const res = await postJson('/chat/mulai', { nama: name, recaptcha_token: token });
                    const data = (await res.json().catch(() => ({}))) as {
                        identitas?: Identity;
                        conversation_id?: number;
                        message?: string;
                        errors?: Record<string, string[]>;
                    };
                    if (res.ok && data.identitas) {
                        setIdentity(data.identitas);
                        setConversationId(data.conversation_id ?? null);
                        void load();
                    } else if (res.status === 429) {
                        setError('Terlalu banyak percobaan. Tunggu beberapa menit.');
                    } else {
                        setError(data.errors?.nama?.[0] ?? data.errors?.recaptcha_token?.[0] ?? data.message ?? 'Nama belum bisa disimpan.');
                    }
                } catch {
                    setError('Tidak ada koneksi. Coba lagi.');
                } finally {
                    setSending(false);
                }
            })
            .finally(() => {
                if (!called) setSending(false);
            });
    };

    const pickFile = (f: File | null | undefined) => {
        if (!f) return;
        if (!FILE_TYPES.includes(f.type)) {
            setError('Hanya foto (JPG, PNG, WEBP) atau PDF yang bisa dikirim.');
            return;
        }
        if (f.size > MAX_FILE_BYTES) {
            setError('Ukuran file maksimal 5 MB.');
            return;
        }
        setError(null);
        setFile(f);
        setFilePreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
        inputRef.current?.focus();
    };

    const clearFile = () => {
        if (filePreview) URL.revokeObjectURL(filePreview);
        setFile(null);
        setFilePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const upload = async () => {
        if (!file || sending) return;
        setSending(true);
        setError(null);
        const form = new FormData();
        form.append('lampiran', file);
        if (input.trim()) form.append('body', input.trim());
        try {
            const res = await fetch('/chat/lampiran', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { Accept: 'application/json', 'X-XSRF-TOKEN': csrfToken() },
                body: form,
            });
            const data = (await res.json().catch(() => ({}))) as {
                message?: ChatMessage;
                balasan?: ChatMessage[];
                asisten?: Assistant;
                errors?: Record<string, string[]>;
                message_text?: string;
            } & { message?: ChatMessage | string };
            if (res.ok && data.message && typeof data.message !== 'string') {
                setMessages((prev) => merge(prev, [data.message as ChatMessage, ...(data.balasan ?? [])]));
                if (data.asisten) setAssistant(data.asisten);
                setInput('');
                clearFile();
                void load();
            } else if (res.status === 413) {
                setError('Ukuran file maksimal 5 MB.');
            } else if (res.status === 429) {
                setError('Terlalu banyak file dikirim. Tunggu sebentar lalu coba lagi.');
            } else {
                setError(data.errors?.lampiran?.[0] ?? (typeof data.message === 'string' ? data.message : null) ?? 'Lampiran gagal terkirim.');
            }
        } catch {
            setError('Tidak ada koneksi. Lampiran belum terkirim.');
        } finally {
            setSending(false);
        }
    };

    const answerCard = async (card: ChatConfirmation, jawaban: 'benar' | 'ubah', koreksi?: string): Promise<boolean> => {
        try {
            const res = await postJson(`/chat/konfirmasi/${card.id}`, { jawaban, koreksi: koreksi ?? null });
            const data = (await res.json().catch(() => ({}))) as { kartu?: ChatMessage; message?: ChatMessage; panel?: Panel; message_text?: string };
            if (res.ok && data.kartu && data.message) {
                setMessages((prev) => merge(prev, [data.kartu!, data.message!]));
                if (data.panel) setPanel(data.panel);
                return true;
            }
            setError('Jawaban belum tersimpan. Coba lagi.');
        } catch {
            setError('Tidak ada koneksi. Coba lagi.');
        }
        return false;
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (needsIdentity) return;
        if (file) {
            void upload();
            return;
        }
        const body = input;
        setInput('');
        void send(body).then((ok) => {
            if (!ok) setInput(body);
        });
    };

    const askTopic = (question: string) => {
        if (needsIdentity) {
            setPending(question);
            document.getElementById(NAME_INPUT_ID)?.focus();
            return;
        }
        void send(question);
    };

    const requestStaff = async () => {
        if (sending) return;
        setSending(true);
        try {
            const res = await postJson('/chat/petugas', {});
            const data = (await res.json().catch(() => ({}))) as { balasan?: ChatMessage[]; asisten?: Assistant; message?: string };
            if (res.ok) {
                setMessages((prev) => merge(prev, data.balasan ?? []));
                if (data.asisten) setAssistant(data.asisten);
                void load();
            } else setError(data.message ?? 'Gagal menghubungi petugas. Coba lagi.');
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

    const endChat = async () => {
        setConfirmEnd(false);
        setMenuOpen(false);
        setSheetOpen(false);
        try {
            const res = await postJson('/chat/akhiri', {});
            const data = (await res.json().catch(() => ({}))) as { balasan?: ChatMessage[]; asisten?: Assistant; panel?: Panel };
            if (res.ok) {
                setMessages((prev) => merge(prev, data.balasan ?? []));
                if (data.asisten) setAssistant(data.asisten);
                if (data.panel) setPanel(data.panel);
            }
        } catch {
            setError('Tidak ada koneksi. Coba lagi.');
        }
    };

    const hasConversation = conversationId !== null && messages.length > 0;
    const title = staff ? `TARA & ${staff.nama.split(' ')[0]}` : 'TARA';
    const status = closed
        ? 'Percakapan diakhiri · tulis pesan untuk melanjutkan'
        : staff
          ? `Terhubung ke petugas${panel?.tiket ? ` · Tiket ${panel.tiket.nomor}` : ''}`
          : withAi || !assistant
            ? 'Asisten SIGAP · menjawab dari sumber resmi'
            : layanan.petugas_tersedia
              ? 'Petugas SIGAP · siap membantu'
              : `Petugas: ${layanan.jam_label}`;

    const quickReplies: { label: string; onClick: () => void }[] = needsIdentity
        ? []
        : withAi
          ? [
                { label: 'Bicara dengan petugas', onClick: () => void requestStaff() },
                { label: 'Cek status tiket', onClick: () => askTopic('Saya mau cek status tiket') },
                { label: 'Lapor masalah', onClick: () => askTopic('Saya mau melapor masalah') },
            ]
          : staff
            ? [
                  { label: 'Kapan selesai?', onClick: () => askTopic('Kira-kira kapan laporan saya selesai?') },
                  { label: 'Kirim dokumen', onClick: () => fileInputRef.current?.click() },
                  { label: 'Terima kasih', onClick: () => askTopic('Terima kasih, Kak.') },
              ]
            : [];

    const actions = (
        <>
            <a
                href="/chat/transkrip"
                aria-disabled={!hasConversation}
                className={cn(
                    'flex h-9 items-center gap-1.5 rounded-full border border-[#d5dee6] px-3.5 text-sm font-semibold text-[var(--t-navy)] transition-colors hover:bg-[#f2f5f8]',
                    !hasConversation && 'pointer-events-none opacity-40',
                )}
            >
                <Download className="h-4 w-4" aria-hidden="true" /> Transkrip
            </a>
            <button
                type="button"
                disabled={!hasConversation || closed}
                onClick={() => setConfirmEnd(true)}
                className="flex h-9 items-center gap-1.5 rounded-full border border-[#d5dee6] px-3.5 text-sm font-semibold text-[#b42318] transition-colors hover:bg-[#fef3f2] disabled:opacity-40"
            >
                <LogOut className="h-4 w-4" aria-hidden="true" /> Akhiri
            </button>
        </>
    );

    return (
        <>
            <Head title="Chat TARA — SIGAP">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    rel="stylesheet"
                    href="https://fonts.bunny.net/css?family=space-grotesk:500,600,700|jost:400,500,600|jetbrains-mono:500,600"
                    head-key="transi-fonts"
                />
            </Head>

            <div className="transi-page flex h-[100dvh] flex-col bg-white text-[#0f2233] antialiased">
                <TransiHeader
                    loggedIn={loggedIn}
                    isAdmin={Boolean(auth?.user?.is_admin)}
                    active="chat"
                    onChat={() => inputRef.current?.focus()}
                    className="hidden lg:block"
                />

                <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] lg:grid-cols-[264px_minmax(0,1fr)_300px] xl:grid-cols-[300px_minmax(0,1fr)_340px]">
                    <LeftPanel layanan={layanan} onTopic={askTopic} />

                    {/* Percakapan */}
                    <section className="vt-chat-target flex min-h-0 flex-col bg-white" aria-label="Percakapan dengan TARA">
                        <MobileTopBar
                            title={title}
                            status={status}
                            staffName={staff?.nama ?? null}
                            onMenu={() => setMenuOpen((v) => !v)}
                            menuOpen={menuOpen}
                        >
                            <div className="absolute top-14 right-3 z-30 w-60 overflow-hidden rounded-xl border border-[#e8edf2] bg-white py-1 text-sm shadow-[0_16px_40px_rgba(2,43,74,0.18)]">
                                <a
                                    href="/chat/transkrip"
                                    className={cn(
                                        'flex items-center gap-2.5 px-4 py-3 hover:bg-[#f6f8fa]',
                                        !hasConversation && 'pointer-events-none opacity-40',
                                    )}
                                >
                                    <Download className="h-4 w-4 text-[var(--t-navy)]" /> Unduh transkrip
                                </a>
                                <button
                                    type="button"
                                    disabled={!hasConversation || closed}
                                    onClick={() => {
                                        setMenuOpen(false);
                                        setConfirmEnd(true);
                                    }}
                                    className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[#b42318] hover:bg-[#fef3f2] disabled:opacity-40"
                                >
                                    <LogOut className="h-4 w-4" /> Akhiri chat
                                </button>
                                {!loggedIn && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMenuOpen(false);
                                            setResumeOpen(true);
                                        }}
                                        className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-[#f6f8fa]"
                                    >
                                        <History className="h-4 w-4 text-[var(--t-navy)]" /> Lanjutkan chat dari HP lain
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => leaveChat()}
                                    className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-[#f6f8fa]"
                                >
                                    <ArrowLeft className="h-4 w-4 text-[var(--t-navy)]" /> Kembali ke beranda
                                </button>
                            </div>
                        </MobileTopBar>

                        {(panel?.tiket || panel?.referensi || panel?.konfirmasi || panel?.petugas) && (
                            <TicketStrip panel={panel} onDetail={() => setSheetOpen(true)} />
                        )}

                        {/* Kepala percakapan (desktop) */}
                        <div className="hidden items-center gap-3 border-b border-[#e8edf2] px-7 py-3.5 lg:flex">
                            <AvatarGroup staffName={staff?.nama ?? null} size={40} />
                            <div className="min-w-0 flex-1">
                                <p className="font-heading truncate text-base font-bold text-[var(--t-deep)]">
                                    {title}
                                    {staff && <span className="font-body text-sm font-medium text-[#5b6b7a]"> ({staff.unit})</span>}
                                </p>
                                <p className="flex items-center gap-1.5 truncate text-[13px] text-[#5b6b7a]">
                                    <span
                                        className={cn('h-2 w-2 shrink-0 rounded-full', closed ? 'bg-[#8a96a3]' : 'bg-[#22c55e]')}
                                        aria-hidden="true"
                                    />
                                    {status}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">{actions}</div>
                        </div>

                        {/* Utas */}
                        <div
                            ref={threadRef}
                            role="log"
                            aria-live="polite"
                            aria-label="Riwayat percakapan"
                            className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto bg-[#f7f9fb] px-3.5 py-5 sm:px-6 lg:px-10"
                        >
                            {!loaded ? (
                                <ThreadSkeleton />
                            ) : (
                                <>
                                    <div className="flex-1" />
                                    {messages.length === 0 && (
                                        <AiBubble time={null}>
                                            Halo{identity ? `, ${identity.nama.split(' ')[0]}` : ''}! Saya TARA 👋 saya mendengar dan menindaklanjuti
                                            setiap keluhan, masukan, maupun laporan Anda terkait pelayanan publik, fasilitas umum, maupun hal-hal lain
                                            yang memerlukan perhatian kami
                                        </AiBubble>
                                    )}
                                    {messages.length === 0 && (
                                        <AiBubble time={null}>
                                            Kami menjamin kerahasiaan data pribadi Anda. Laporan yang masuk akan diproses dan tindak lanjut pengaduan
                                            akan diselesaikan maksimal 7 hari kerja.
                                            {!needsIdentity && !pending && (
                                                <span className="mt-3 flex flex-wrap gap-2">
                                                    {TOPICS.map((t) => (
                                                        <button
                                                            key={t.label}
                                                            type="button"
                                                            onClick={() => askTopic(t.question)}
                                                            className="transi-lift rounded-full border border-[#c8d4df] bg-white px-3 py-1.5 text-[13px] font-medium text-[var(--t-navy)] hover:border-[var(--t-navy)]"
                                                        >
                                                            {t.label}
                                                        </button>
                                                    ))}
                                                </span>
                                            )}
                                        </AiBubble>
                                    )}
                                    <MessageList
                                        messages={messages}
                                        withAi={withAi}
                                        closed={closed}
                                        onRate={rate}
                                        onStaff={() => void requestStaff()}
                                        onAnswer={answerCard}
                                    />

                                    {(needsIdentity ? pending : outgoing) && (
                                        <div className="transi-msg-in flex flex-col items-end gap-1">
                                            <p className="max-w-[85%] rounded-2xl rounded-tr-[4px] bg-[var(--t-navy)] px-3.5 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap text-white opacity-85 sm:max-w-[420px]">
                                                {needsIdentity ? pending : outgoing}
                                            </p>
                                            {needsIdentity ? (
                                                <span className="flex items-center gap-1.5 text-xs font-medium text-[#9a7330]">
                                                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> Dikirim setelah Anda mengisi nama
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-xs text-[#8a96a3]">
                                                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> Mengirim…
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {needsIdentity && (
                                        <AiBubble time={null}>
                                            {pending
                                                ? 'Sebelum saya bantu, boleh kenalan dulu? Pertanyaan Anda langsung saya proses setelah itu.'
                                                : 'Sebelum mulai, boleh kenalan dulu? Supaya petugas tahu siapa yang bertanya.'}
                                            <span className="mt-3 flex flex-wrap gap-2">
                                                <Link
                                                    href="/masuk"
                                                    className="flex items-center gap-1.5 rounded-full border border-[#c8d4df] px-3 py-1.5 text-[13px] font-medium text-[var(--t-navy)] hover:border-[var(--t-navy)]"
                                                >
                                                    <LogIn className="h-3.5 w-3.5" aria-hidden="true" /> Sudah punya akun? Masuk
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() => setResumeOpen((v) => !v)}
                                                    aria-expanded={resumeOpen}
                                                    className="flex items-center gap-1.5 rounded-full border border-[#c8d4df] px-3 py-1.5 text-[13px] font-medium text-[var(--t-navy)] hover:border-[var(--t-navy)]"
                                                >
                                                    <History className="h-3.5 w-3.5" aria-hidden="true" /> Pernah chat dari HP lain?
                                                </button>
                                            </span>
                                        </AiBubble>
                                    )}

                                    {needsIdentity && (
                                        <IdentityCard
                                            busy={sending || recaptcha.verifying}
                                            error={error}
                                            recaptcha={recaptcha}
                                            onEdit={() => setError(null)}
                                            onSubmit={startWithName}
                                        />
                                    )}

                                    {resumeOpen && !loggedIn && (
                                        <ResumeForm
                                            onDone={() => {
                                                setResumeOpen(false);
                                                void load();
                                            }}
                                            onCancel={() => setResumeOpen(false)}
                                        />
                                    )}

                                    {outgoing && !needsIdentity && (withAi || awaitingStaff) && <Typing />}

                                    {assistant?.butuh_kontak && (
                                        <div className="overflow-hidden rounded-2xl border border-amber-200">
                                            <ContactForm
                                                reference={assistant.referensi}
                                                onSaved={(reply, state) => {
                                                    setMessages((prev) => merge(prev, reply));
                                                    setAssistant(state);
                                                    void load();
                                                }}
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Konfirmasi akhiri */}
                        {confirmEnd && (
                            <div className="flex flex-wrap items-center gap-3 border-t border-[#fde3e1] bg-[#fef3f2] px-4 py-3 text-sm text-[#7a1f16] sm:px-6 lg:px-10">
                                <span className="min-w-0 flex-1">Akhiri percakapan? Riwayatnya tetap tersimpan dan bisa dilanjutkan kapan saja.</span>
                                <button
                                    type="button"
                                    onClick={() => setConfirmEnd(false)}
                                    className="rounded-full px-3 py-1.5 font-medium hover:bg-white/60"
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void endChat()}
                                    className="rounded-full bg-[#b42318] px-4 py-1.5 font-semibold text-white hover:bg-[#9a1d14]"
                                >
                                    Akhiri chat
                                </button>
                            </div>
                        )}

                        {/* Balasan cepat */}
                        {quickReplies.length > 0 && (
                            <div className="transi-chips flex gap-2 overflow-x-auto border-t border-[#eef2f6] bg-white px-3.5 pt-2.5 sm:px-6 lg:px-10">
                                {quickReplies.map((q) => (
                                    <button
                                        key={q.label}
                                        type="button"
                                        onClick={q.onClick}
                                        disabled={sending}
                                        className="shrink-0 rounded-full border border-[#c8d4df] bg-white px-3.5 py-2 text-[13px] font-medium text-[var(--t-navy)] transition-colors hover:border-[var(--t-navy)] disabled:opacity-50"
                                    >
                                        {q.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Kanal pengaduan lain */}
                        {links.length > 0 && (
                            <nav
                                aria-label="Kanal pengaduan lain"
                                className={cn(
                                    'transi-chips flex gap-2 overflow-x-auto bg-white px-3.5 pt-2 sm:px-6 lg:px-10',
                                    quickReplies.length === 0 && 'border-t border-[#eef2f6] pt-2.5',
                                )}
                            >
                                {links.map((l) => (
                                    <a
                                        key={l.key}
                                        href={l.href}
                                        {...external(l.href)}
                                        className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#e6d6b4] bg-[#fbf7ee] px-3 py-1.5 text-xs font-semibold text-[var(--t-deep)] transition-colors hover:border-[var(--t-gold)] hover:bg-[#f7efdc]"
                                    >
                                        <l.icon className="h-3.5 w-3.5 text-[#9a7330]" aria-hidden="true" />
                                        {l.label}
                                        {l.href.startsWith('http') && (
                                            <>
                                                <ArrowUpRight className="h-3.5 w-3.5 text-[#9a7330]" aria-hidden="true" />
                                                <span className="sr-only">(tab baru)</span>
                                            </>
                                        )}
                                    </a>
                                ))}
                            </nav>
                        )}

                        {/* Penulis pesan */}
                        <form
                            onSubmit={submit}
                            className="border-t border-transparent bg-white px-3 pt-2.5 pb-[max(env(safe-area-inset-bottom),12px)] sm:px-6 lg:px-10 lg:pb-4"
                        >
                            {error && !needsIdentity && (
                                <p role="alert" className="mb-2 text-xs font-semibold text-rose-600">
                                    {error}
                                </p>
                            )}
                            {file && (
                                <div className="transi-msg-in mb-2 flex items-center gap-3 rounded-2xl border border-[#e1e7ed] bg-[#f6f8fa] p-2 pr-3">
                                    {filePreview ? (
                                        <img src={filePreview} alt="" className="h-12 w-12 rounded-xl object-cover" />
                                    ) : (
                                        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white">
                                            <FileText className="h-6 w-6 text-[var(--t-navy)]" aria-hidden="true" />
                                        </span>
                                    )}
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold text-[#1f2d3a]">{file.name}</span>
                                        <span className="block text-xs text-[#5b6b7a]">
                                            {ukuran(file.size)} · {sending ? 'Mengunggah…' : 'Tambahkan keterangan bila perlu, lalu kirim'}
                                        </span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={clearFile}
                                        disabled={sending}
                                        aria-label="Batalkan lampiran"
                                        className="rounded-full p-1.5 text-[#5b6b7a] hover:bg-white"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                className="hidden"
                                onChange={(e) => pickFile(e.target.files?.[0])}
                            />
                            <input
                                ref={cameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(e) => pickFile(e.target.files?.[0])}
                            />
                            <div
                                className={cn(
                                    'flex h-14 items-center gap-1 rounded-full border bg-[#f6f8fa] pr-1.5 pl-2 transition-colors focus-within:bg-white',
                                    'border-[#d5dee7] focus-within:border-[var(--t-navy)]',
                                    needsIdentity && 'opacity-60',
                                )}
                            >
                                {!needsIdentity && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={sending}
                                            aria-label="Lampirkan foto atau dokumen"
                                            title="Lampirkan foto atau PDF (maks. 5 MB)"
                                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#5b6b7a] transition-colors hover:bg-white hover:text-[var(--t-navy)] disabled:opacity-50"
                                        >
                                            <Paperclip className="h-5 w-5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => cameraInputRef.current?.click()}
                                            disabled={sending}
                                            aria-label="Ambil foto"
                                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#5b6b7a] transition-colors hover:bg-white hover:text-[var(--t-navy)] disabled:opacity-50 lg:hidden"
                                        >
                                            <Camera className="h-5 w-5" />
                                        </button>
                                    </>
                                )}
                                {needsIdentity && <span className="w-3" aria-hidden="true" />}
                                <label htmlFor="pesan-chat" className="sr-only">
                                    Pesan
                                </label>
                                <input
                                    id="pesan-chat"
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    autoComplete="off"
                                    disabled={needsIdentity}
                                    maxLength={2000}
                                    placeholder={
                                        needsIdentity
                                            ? 'Isi nama di atas untuk mulai chat'
                                            : staff && !closed
                                              ? `Balas ke ${staff.nama.split(' ')[0]} atau tanya TARA…`
                                              : 'Tulis pertanyaan atau keluhan Anda…'
                                    }
                                    className="min-w-0 flex-1 bg-transparent text-[15px] text-[#1f2d3a] outline-none placeholder:text-[#8a96a3]"
                                />
                                <button
                                    type="submit"
                                    disabled={needsIdentity || sending || (input.trim() === '' && !file)}
                                    className="font-heading flex h-11 shrink-0 items-center gap-2 rounded-full bg-[var(--t-gold)] px-4 text-sm font-bold text-[var(--t-deep)] transition-[background-color,opacity] hover:bg-[#d0a552] disabled:opacity-50 sm:px-5"
                                >
                                    <span className="hidden sm:inline">Kirim</span>
                                    {sending && file ? (
                                        <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
                                    ) : (
                                        <SendHorizontal className="h-[18px] w-[18px]" aria-hidden="true" />
                                    )}
                                    <span className="sr-only sm:hidden">Kirim</span>
                                </button>
                            </div>
                            <p className="mt-2 hidden text-xs text-[#8a96a3] sm:block">
                                TARA bisa keliru. Keputusan resmi selalu disampaikan petugas melalui tiket Anda.
                            </p>
                        </form>
                    </section>

                    <aside
                        className="hidden min-h-0 overflow-y-auto border-l border-[#e8edf2] bg-white px-6 py-7 lg:block"
                        aria-label="Tiket dari percakapan ini"
                    >
                        <TicketPanel panel={panel} />
                    </aside>
                </div>

                {sheetOpen && panel && (
                    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Detail tiket">
                        <button
                            type="button"
                            aria-label="Tutup detail"
                            className="absolute inset-0 bg-[#022b4a]/50"
                            onClick={() => setSheetOpen(false)}
                        />
                        <div className="transi-sheet-in absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[26px] bg-white px-5 pt-3 pb-[max(env(safe-area-inset-bottom),20px)]">
                            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#d5dee6]" aria-hidden="true" />
                            <div className="mb-2 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setSheetOpen(false)}
                                    aria-label="Tutup"
                                    className="rounded-full p-2 text-[#5b6b7a] hover:bg-[#f2f5f8]"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <TicketPanel panel={panel} />
                            <div className="mt-5 grid grid-cols-2 gap-3">
                                <a
                                    href="/chat/transkrip"
                                    className="flex h-12 items-center justify-center gap-2 rounded-full border border-[#d5dee6] text-sm font-semibold text-[var(--t-navy)]"
                                >
                                    <Download className="h-4 w-4" /> Transkrip
                                </a>
                                <button
                                    type="button"
                                    disabled={closed}
                                    onClick={() => {
                                        setSheetOpen(false);
                                        setConfirmEnd(true);
                                    }}
                                    className="flex h-12 items-center justify-center gap-2 rounded-full border border-[#d5dee6] text-sm font-semibold text-[#b42318] disabled:opacity-40"
                                >
                                    <LogOut className="h-4 w-4" /> Akhiri chat
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

/* ------------------------------------------------------------- left panel */

function LeftPanel({ layanan, onTopic }: { layanan: Layanan; onTopic: (q: string) => void }) {
    return (
        <aside
            className="hidden min-h-0 flex-col gap-7 overflow-y-auto px-6 py-7 text-white lg:flex"
            style={{ background: 'radial-gradient(160% 90% at 20% 5%, rgba(11,90,140,0.6) 0%, rgba(2,43,74,0) 70%), var(--t-deep)' }}
        >
            <button
                type="button"
                onClick={() => leaveChat()}
                className="flex w-fit items-center gap-2 text-[13px] font-medium text-[#bcd0e0] transition-colors hover:text-white"
            >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kembali ke Beranda
            </button>
            <div className="flex flex-col gap-3">
                <img
                    src="/images/tara/tablet.webp"
                    alt=""
                    width={273}
                    height={900}
                    className="transi-float h-48 w-32 object-contain xl:h-56 xl:w-36"
                />
                <h1 className="font-heading text-[22px] font-bold">TARA</h1>
                <p className="text-[13px] leading-relaxed text-[#bcd0e0]">
                    Asisten SIGAP. Menjawab dari sumber resmi Kementerian Transmigrasi, lalu meneruskan ke petugas bila perlu tindakan.
                </p>
            </div>
            <div className="flex flex-col gap-3">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-[#8fa9bf] uppercase">Status layanan</p>
                {layanan.ai_aktif && <StatusRow icon={Bot} label="TARA" value="Online 24 jam" dot="bg-[#4ade80]" />}
                <StatusRow
                    icon={Headset}
                    label="Petugas"
                    value={layanan.petugas_tersedia ? `Aktif · s.d. ${layanan.tutup_pukul} WIB` : 'Di luar jam layanan'}
                    dot={layanan.petugas_tersedia ? 'bg-[#4ade80]' : 'bg-[#f0b100]'}
                />
                {layanan.median_menit !== null && (
                    <StatusRow icon={Timer} label="Rata-rata respons" value={`± ${Math.max(1, layanan.median_menit)} menit`} />
                )}
                {!layanan.petugas_tersedia && <p className="text-xs text-[#8fa9bf]">Jam petugas: {layanan.jam_label}</p>}
            </div>
            <div className="flex flex-col gap-2.5">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-[#8fa9bf] uppercase">Mulai topik baru</p>
                {TOPICS.map((t) => (
                    <button
                        key={t.label}
                        type="button"
                        onClick={() => onTopic(t.question)}
                        className="group flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-3 text-left text-[13px] font-medium transition-colors hover:border-white/25 hover:bg-white/[0.1]"
                    >
                        <t.icon className="h-4 w-4 text-[var(--t-gold)]" aria-hidden="true" />
                        <span className="flex-1">{t.label}</span>
                        <ChevronRight className="h-4 w-4 text-white/40 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </button>
                ))}
            </div>
            <p className="mt-auto flex gap-2 text-xs leading-relaxed text-[#8fa9bf]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> NIK dan nomor HP disamarkan otomatis. Percakapan tersimpan dan
                bisa dilanjutkan kapan saja.
            </p>
        </aside>
    );
}

function StatusRow({ icon: Icon, label, value, dot }: { icon: LucideIcon; label: string; value: string; dot?: string }) {
    return (
        <div className="flex items-center gap-2.5 text-[13px]">
            <Icon className="h-4 w-4 text-[#8fa9bf]" aria-hidden="true" />
            <span className="flex-1 text-[#e6eef5]">{label}</span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-white">
                {dot && <span className={cn('h-2 w-2 rounded-full', dot)} aria-hidden="true" />}
                {value}
            </span>
        </div>
    );
}

/* -------------------------------------------------------------- top bar (HP) */

function MobileTopBar({
    title,
    status,
    staffName,
    onMenu,
    menuOpen,
    children,
}: {
    title: string;
    status: string;
    staffName: string | null;
    onMenu: () => void;
    menuOpen: boolean;
    children: ReactNode;
}) {
    return (
        <div className="relative flex h-16 shrink-0 items-center gap-1.5 bg-[var(--t-navy)] px-1 pt-[env(safe-area-inset-top)] text-white lg:hidden">
            <button
                type="button"
                onClick={() => leaveChat()}
                aria-label="Kembali ke beranda"
                className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
            >
                <ArrowLeft className="h-[22px] w-[22px]" />
            </button>
            <AvatarGroup staffName={staffName} size={38} ring />
            <div className="ml-1.5 min-w-0 flex-1">
                <p className="font-heading truncate text-base font-bold">{title}</p>
                <p className="truncate text-xs text-[#bcd0e0]">{status}</p>
            </div>
            <button
                type="button"
                onClick={onMenu}
                aria-expanded={menuOpen}
                aria-label="Menu lainnya"
                className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
            >
                <MoreVertical className="h-5 w-5" />
            </button>
            {menuOpen && children}
        </div>
    );
}

function AvatarGroup({ staffName, size, ring = false }: { staffName: string | null; size: number; ring?: boolean }) {
    return (
        <span className="relative flex shrink-0 items-center" style={{ width: staffName ? size * 1.55 : size, height: size }}>
            <span
                className={cn('absolute left-0 rounded-full bg-[var(--t-cream)] bg-cover bg-center', ring && 'ring-2 ring-[var(--t-navy)]')}
                style={{ width: size, height: size, backgroundImage: `url(${AVATAR})` }}
                aria-hidden="true"
            />
            {staffName && (
                <span
                    className="font-heading absolute right-0 bottom-0 flex items-center justify-center rounded-full bg-[#f3e6cc] text-sm font-bold text-[var(--t-deep)] ring-2 ring-white"
                    style={{ width: size * 0.85, height: size * 0.85 }}
                    aria-hidden="true"
                >
                    {staffName.charAt(0).toUpperCase()}
                </span>
            )}
        </span>
    );
}

/* ------------------------------------------------------------- ticket strip */

function TicketStrip({ panel, onDetail }: { panel: Panel; onDetail: () => void }) {
    const t = panel.tiket;
    return (
        <div className="flex shrink-0 items-center gap-3 border-b border-[#e8edf2] bg-white px-4 py-2.5 lg:hidden">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef3f7]">
                <Ticket className="h-[18px] w-[18px] text-[var(--t-navy)]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
                <p className={cn('truncate text-[13px] font-bold text-[var(--t-deep)]', (t || panel.referensi) && 'font-mono')}>
                    {t?.nomor ?? panel.referensi ?? 'Perkembangan laporan'}
                </p>
                <p className="truncate text-xs font-medium text-[#8a6420]">
                    {t ? (t.status_label ?? 'Diproses') : panel.petugas ? 'Ditangani petugas' : 'Diteruskan ke petugas'}
                </p>
            </div>
            <button
                type="button"
                onClick={onDetail}
                className="flex items-center gap-1 rounded-full border border-[#d5dee6] px-3 py-1.5 text-xs font-semibold text-[var(--t-navy)]"
            >
                Detail <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
        </div>
    );
}

/* ------------------------------------------------------------- ticket panel */

function TicketPanel({ panel }: { panel: Panel | null }) {
    const [copied, setCopied] = useState(false);
    const t = panel?.tiket ?? null;

    if (!panel || (!t && !panel.referensi && !panel.konfirmasi && !panel.petugas)) {
        return (
            <div className="flex flex-col gap-4">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-[#8a96a3] uppercase">Tiket dari percakapan ini</p>
                <div className="flex flex-col gap-3 rounded-2xl bg-[#f6f8fa] p-5">
                    <Ticket className="h-7 w-7 text-[#8a96a3]" aria-hidden="true" />
                    <p className="font-heading text-[17px] font-bold text-[var(--t-deep)]">Belum ada tiket</p>
                    <p className="text-sm leading-relaxed text-[#5b6b7a]">
                        Bila urusan Anda perlu ditindaklanjuti, nomor tiket, petugas, dan perkembangannya muncul di sini.
                    </p>
                </div>
            </div>
        );
    }

    const done = t?.status === 'selesai';
    const steps: { label: string; at: string | null; done: boolean; sub?: string | null }[] = [
        { label: 'Laporan diterima TARA', at: panel.dimulai_at, done: true },
        ...(panel.konfirmasi
            ? [
                  {
                      label: 'Data diverifikasi',
                      at: panel.data_diverifikasi_at,
                      done: Boolean(panel.data_diverifikasi_at),
                      sub:
                          panel.konfirmasi === 'menunggu'
                              ? 'Menunggu konfirmasi Anda'
                              : panel.konfirmasi === 'ubah'
                                ? 'Data sedang diperbaiki'
                                : null,
                  },
              ]
            : []),
        {
            label: 'Diteruskan ke petugas',
            at: panel.diteruskan_at,
            done: Boolean(panel.diteruskan_at),
            sub: panel.petugas?.nama.split(' ')[0] ?? null,
        },
        { label: 'Tiket diterbitkan', at: t?.dibuat_at ?? null, done: Boolean(t) },
        {
            label: 'Ditindaklanjuti',
            at: t?.diproses_at ?? null,
            done: Boolean(t?.diproses_at) || done,
            sub: !t?.diproses_at && t?.target_at ? `Target selesai ${tanggalPendek(t.target_at)}` : null,
        },
        { label: 'Selesai & penilaian', at: t?.selesai_at ?? null, done },
    ];
    const current = steps.findIndex((s) => !s.done);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(t?.nomor ?? panel.referensi ?? '');
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
        } catch {
            /* clipboard ditolak: nomor tetap bisa diseleksi */
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2.5">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-[#8a96a3] uppercase">
                    {t ? 'Tiket dari percakapan ini' : panel.referensi ? 'Nomor referensi percakapan' : 'Perkembangan laporan'}
                </p>
                <div className={cn('flex items-center gap-2', !t && !panel.referensi && 'hidden')}>
                    <span className="font-mono text-xl font-bold text-[var(--t-deep)] select-all">{t?.nomor ?? panel.referensi}</span>
                    <button
                        type="button"
                        onClick={() => void copy()}
                        aria-label="Salin nomor"
                        className="rounded-lg p-1.5 text-[#5b6b7a] hover:bg-[#f2f5f8]"
                    >
                        {copied ? <Check className="h-4 w-4 text-[#0d7a5f]" /> : <Copy className="h-4 w-4" />}
                    </button>
                </div>
                {t && (
                    <div className="flex flex-wrap gap-2">
                        {t.kategori && <span className="rounded-full bg-[#eef2f6] px-2.5 py-1 text-xs font-medium text-[#3d4b59]">{t.kategori}</span>}
                        {t.prioritas && (
                            <span className="rounded-full bg-[#f7efe2] px-2.5 py-1 text-xs font-medium text-[#8a6420]">
                                Prioritas {t.prioritas.toLowerCase()}
                            </span>
                        )}
                        {t.status === 'ditolak' && (
                            <span className="rounded-full bg-[#fef3f2] px-2.5 py-1 text-xs font-medium text-[#b42318]">Ditolak</span>
                        )}
                    </div>
                )}
            </div>

            <ol className="flex flex-col">
                {steps.map((s, i) => {
                    const isCurrent = i === current;
                    const last = i === steps.length - 1;
                    return (
                        <li key={s.label} className="flex gap-3">
                            <div className="flex w-6 flex-col items-center">
                                <span
                                    className={cn(
                                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                                        s.done
                                            ? 'border-[#0d7a5f] bg-[#0d7a5f] text-white'
                                            : isCurrent
                                              ? 'border-[var(--t-gold)] bg-white'
                                              : 'border-[#d5dee6] bg-white',
                                    )}
                                >
                                    {s.done ? (
                                        <Check className="h-3.5 w-3.5" />
                                    ) : isCurrent ? (
                                        <span className="h-2 w-2 rounded-full bg-[var(--t-gold)]" />
                                    ) : null}
                                </span>
                                {!last && <span className={cn('w-0.5 flex-1', s.done ? 'bg-[#0d7a5f]' : 'bg-[#e1e7ed]')} aria-hidden="true" />}
                            </div>
                            <div className={cn('min-w-0 flex-1', !last && 'pb-5')}>
                                <p className={cn('text-sm', s.done || isCurrent ? 'font-semibold text-[#1f2d3a]' : 'text-[#8a96a3]')}>{s.label}</p>
                                <p className={cn('text-xs', isCurrent ? 'text-[#8a6420]' : 'text-[#8a96a3]')}>
                                    {[s.at ? `${tanggalPendek(s.at)} ${jam(s.at)}` : null, s.sub].filter(Boolean).join(' · ') ||
                                        (isCurrent ? 'Sedang berlangsung' : '')}
                                </p>
                            </div>
                        </li>
                    );
                })}
            </ol>

            {panel.petugas && (
                <div className="flex items-center gap-3 rounded-2xl bg-[#f6f8fa] p-3.5">
                    <span className="font-heading flex h-10 w-10 items-center justify-center rounded-full bg-[#f3e6cc] font-bold text-[var(--t-deep)]">
                        {panel.petugas.nama.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[#1f2d3a]">{panel.petugas.nama}</span>
                        <span className="block truncate text-xs text-[#5b6b7a]">{panel.petugas.unit}</span>
                    </span>
                </div>
            )}

            {panel.kontak && (
                <p className="flex gap-2.5 text-[13px] leading-relaxed text-[#3d4b59]">
                    <Headset className="mt-0.5 h-4 w-4 shrink-0 text-[var(--t-navy)]" aria-hidden="true" />
                    Petugas dapat menghubungi Anda di {panel.kontak}, meskipun halaman ini ditutup.
                </p>
            )}

            {t && (
                <Link
                    href={t.url}
                    className="flex h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-[var(--t-navy)] text-sm font-semibold text-[var(--t-navy)] transition-colors hover:bg-[var(--t-navy)] hover:text-white"
                >
                    <Search className="h-4 w-4" aria-hidden="true" /> Buka halaman lacak tiket
                </Link>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ thread */

function AiBubble({ children, time, author = 'TARA' }: { children: ReactNode; time: string | null; author?: string }) {
    return (
        <div className="transi-msg-in flex gap-2.5">
            <span
                className="mt-5 h-8 w-8 shrink-0 rounded-full bg-[var(--t-cream)] bg-cover bg-center"
                style={{ backgroundImage: `url(${AVATAR})` }}
                aria-hidden="true"
            />
            <div className="flex max-w-[88%] min-w-0 flex-col gap-1 sm:max-w-[520px]">
                <p className="flex gap-1.5 text-xs">
                    <span className="font-semibold text-[var(--t-deep)]">{author}</span>
                    {time && <span className="text-[#8a96a3]">{time}</span>}
                </p>
                <div className="rounded-2xl rounded-tl-[4px] border border-[#e6ebf0] bg-white px-3.5 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-[#1f2d3a]">
                    {children}
                </div>
            </div>
        </div>
    );
}

function MessageList({
    messages,
    withAi,
    closed,
    onRate,
    onStaff,
    onAnswer,
}: {
    messages: ChatMessage[];
    withAi: boolean;
    closed: boolean;
    onRate: (m: ChatMessage, helpful: boolean) => void;
    onStaff: () => void;
    onAnswer: (card: ChatConfirmation, jawaban: 'benar' | 'ubah', koreksi?: string) => Promise<boolean>;
}) {
    const rows = useMemo(() => {
        const out: ({ type: 'day'; key: string; label: string } | { type: 'msg'; m: ChatMessage })[] = [];
        let lastDay = '';
        for (const m of messages) {
            const day = m.pada ? new Date(m.pada).toDateString() : '';
            if (day && day !== lastDay) {
                out.push({ type: 'day', key: `d-${day}`, label: tanggal(m.pada) });
                lastDay = day;
            }
            out.push({ type: 'msg', m });
        }
        return out;
    }, [messages]);

    return (
        <>
            {rows.map((r) =>
                r.type === 'day' ? (
                    <div key={r.key} className="flex items-center gap-3 py-1">
                        <span className="h-px flex-1 bg-[#dfe5eb]" />
                        <span className="rounded-full bg-[#eef2f6] px-3 py-1 text-xs font-medium text-[#5b6b7a]">{r.label}</span>
                        <span className="h-px flex-1 bg-[#dfe5eb]" />
                    </div>
                ) : (
                    <MessageRow key={r.m.id} m={r.m} canAskStaff={withAi && !closed} onRate={onRate} onStaff={onStaff} onAnswer={onAnswer} />
                ),
            )}
        </>
    );
}

function MessageRow({
    m,
    canAskStaff,
    onRate,
    onStaff,
    onAnswer,
}: {
    m: ChatMessage;
    canAskStaff: boolean;
    onRate: (m: ChatMessage, helpful: boolean) => void;
    onStaff: () => void;
    onAnswer: (card: ChatConfirmation, jawaban: 'benar' | 'ubah', koreksi?: string) => Promise<boolean>;
}) {
    if (m.sender_type === 'system') {
        return (
            <div className="transi-msg-in flex justify-center">
                <div className="w-full max-w-[560px]">
                    <SystemNotice message={m} />
                </div>
            </div>
        );
    }

    if (isMine(m)) {
        return (
            <div className="transi-msg-in flex flex-col items-end gap-1">
                <div className="flex max-w-[85%] flex-col gap-2 rounded-2xl rounded-tr-[4px] bg-[var(--t-navy)] px-3.5 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap text-white sm:max-w-[420px]">
                    {!(m.lampiran && m.body.startsWith('📎')) && <span>{m.body}</span>}
                    {m.lampiran && <AttachmentView a={m.lampiran} mine />}
                </div>
                <span className="flex items-center gap-1 text-xs text-[#8a96a3]">
                    {jam(m.pada)} <CheckCheck className="h-3.5 w-3.5 text-[#0b7fc7]" aria-label="Terkirim" />
                </span>
            </div>
        );
    }

    const fromStaff = m.sender_type === 'admin';

    return (
        <div className="transi-msg-in flex gap-2.5">
            {fromStaff ? (
                <span
                    className="font-heading mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f3e6cc] text-sm font-bold text-[var(--t-deep)]"
                    aria-hidden="true"
                >
                    {m.penulis.charAt(0).toUpperCase()}
                </span>
            ) : (
                <span
                    className="mt-5 h-8 w-8 shrink-0 rounded-full bg-[var(--t-cream)] bg-cover bg-center"
                    style={{ backgroundImage: `url(${AVATAR})` }}
                    aria-hidden="true"
                />
            )}
            <div className="flex max-w-[88%] min-w-0 flex-col gap-1 sm:max-w-[520px]">
                <p className="flex gap-1.5 text-xs">
                    <span className="font-semibold text-[var(--t-deep)]">{fromStaff ? `${m.penulis} · Petugas` : 'TARA'}</span>
                    <span className="text-[#8a96a3]">{jam(m.pada)}</span>
                </p>
                <div className="rounded-2xl rounded-tl-[4px] border border-[#e6ebf0] bg-white px-3.5 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap text-[#1f2d3a]">
                    {m.konfirmasi ? (
                        <ConfirmationCard card={m.konfirmasi} onAnswer={onAnswer} />
                    ) : (
                        !(m.lampiran && m.body.startsWith('📎')) && (fromStaff ? m.body : <AnswerBody text={m.body} />)
                    )}
                    {m.lampiran && (
                        <span className="mt-2 block">
                            <AttachmentView a={m.lampiran} />
                        </span>
                    )}
                    {!fromStaff && <AiExtras message={m} onRate={(h) => onRate(m, h)} onStaff={onStaff} canAskStaff={canAskStaff} />}
                </div>
            </div>
        </div>
    );
}

function AttachmentView({ a, mine = false }: { a: ChatAttachment; mine?: boolean }) {
    if (a.gambar) {
        return (
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl" title={`Buka ${a.nama}`}>
                <img src={a.url} alt={`Lampiran: ${a.nama}`} loading="lazy" className="max-h-60 w-full max-w-[280px] object-cover" />
            </a>
        );
    }
    return (
        <a
            href={a.url}
            className={cn(
                'flex items-center gap-3 rounded-xl p-2.5 pr-3.5 whitespace-normal transition-colors',
                mine ? 'bg-white/10 hover:bg-white/15' : 'border border-[#e6ebf0] bg-[#f6f8fa] hover:bg-[#eef2f6]',
            )}
        >
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', mine ? 'bg-white/15' : 'bg-white')}>
                <FileText className={cn('h-5 w-5', mine ? 'text-white' : 'text-[var(--t-navy)]')} aria-hidden="true" />
            </span>
            <span className="min-w-0">
                <span className={cn('block truncate text-sm font-semibold', mine ? 'text-white' : 'text-[#1f2d3a]')}>{a.nama}</span>
                <span className={cn('block text-xs', mine ? 'text-[#bcd0e0]' : 'text-[#5b6b7a]')}>
                    {a.mime === 'application/pdf' ? 'PDF' : 'File'} · {ukuran(a.ukuran)}
                </span>
            </span>
        </a>
    );
}

function ConfirmationCard({
    card,
    onAnswer,
}: {
    card: ChatConfirmation;
    onAnswer: (card: ChatConfirmation, jawaban: 'benar' | 'ubah', koreksi?: string) => Promise<boolean>;
}) {
    const [editing, setEditing] = useState(false);
    const [koreksi, setKoreksi] = useState('');
    const [busy, setBusy] = useState(false);
    const answer = async (j: 'benar' | 'ubah') => {
        setBusy(true);
        const ok = await onAnswer(card, j, j === 'ubah' ? koreksi : undefined);
        setBusy(false);
        if (ok) setEditing(false);
    };

    return (
        <span className="block whitespace-normal">
            <span className="block">{card.pengantar}</span>
            <dl className="mt-2.5 grid gap-2 rounded-xl border border-[#e6ebf0] bg-[#f6f8fa] p-3">
                {card.data.map((d) => (
                    <div key={d.label}>
                        <dt className="text-[11px] text-[#5b6b7a]">{d.label}</dt>
                        <dd className="text-[13px] font-medium text-[#1f2d3a]">{d.nilai}</dd>
                    </div>
                ))}
            </dl>
            {card.status === 'menunggu' ? (
                editing ? (
                    <span className="mt-2.5 flex flex-col gap-2">
                        <label htmlFor={`koreksi-${card.id}`} className="text-xs font-semibold text-[#3d4b59]">
                            Apa yang perlu diubah?
                        </label>
                        <textarea
                            id={`koreksi-${card.id}`}
                            rows={2}
                            value={koreksi}
                            onChange={(e) => setKoreksi(e.target.value)}
                            maxLength={500}
                            placeholder="Mis. lokasi yang benar UPT Mahalona SP3"
                            className="w-full rounded-xl border border-[#d5dee6] px-3 py-2 text-sm outline-none focus:border-[var(--t-navy)]"
                        />
                        <span className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setEditing(false)}
                                className="rounded-full px-3 py-1.5 text-xs text-[#5b6b7a] hover:bg-[#f2f5f8]"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                disabled={busy || koreksi.trim() === ''}
                                onClick={() => void answer('ubah')}
                                className="rounded-full bg-[var(--t-navy)] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                                Kirim perbaikan
                            </button>
                        </span>
                    </span>
                ) : (
                    <span className="mt-2.5 flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void answer('benar')}
                            className="flex items-center gap-1.5 rounded-full border border-[var(--t-navy)] px-3 py-1.5 text-xs font-semibold text-[var(--t-navy)] hover:bg-[var(--t-navy)] hover:text-white disabled:opacity-50"
                        >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" /> Data sudah benar
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => setEditing(true)}
                            className="rounded-full border border-[#c8d4df] px-3 py-1.5 text-xs font-semibold text-[var(--t-navy)] hover:border-[var(--t-navy)] disabled:opacity-50"
                        >
                            Ubah data
                        </button>
                    </span>
                )
            ) : (
                <span
                    className={cn(
                        'mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                        card.status === 'benar' ? 'bg-[#e7f6ef] text-[#0d7a5f]' : 'bg-[#f7efe2] text-[#8a6420]',
                    )}
                >
                    {card.status === 'benar' ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                    {card.status === 'benar' ? 'Anda menyatakan data sudah benar' : 'Anda meminta perbaikan data'}
                </span>
            )}
        </span>
    );
}

function Typing() {
    const label = useWaitLabel(true);

    return (
        <div className="flex items-center gap-2.5" role="status" aria-label={label}>
            <span
                className="h-8 w-8 shrink-0 rounded-full bg-[var(--t-cream)] bg-cover bg-center"
                style={{ backgroundImage: `url(${AVATAR})` }}
                aria-hidden="true"
            />
            <span className="transi-typing flex gap-1 rounded-2xl border border-[#e6ebf0] bg-white px-3.5 py-3" style={{ animation: 'none' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-[#8a96a3]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#8a96a3]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#8a96a3]" />
            </span>
            <span className="text-xs text-[#8a96a3]">{label}</span>
        </div>
    );
}

function ThreadSkeleton() {
    return (
        <div className="flex flex-1 flex-col justify-end gap-4" aria-hidden="true">
            {[260, 180, 320].map((w, i) => (
                <div
                    key={i}
                    className={cn('h-11 animate-pulse rounded-2xl bg-[#e9eef3]', i === 1 && 'self-end')}
                    style={{ width: w, maxWidth: '80%' }}
                />
            ))}
        </div>
    );
}

/* ------------------------------------------------------------ identity card */

const NAME_INPUT_ID = 'nama-tamu';

/** Sama dengan aturan StartChatRequest agar salah ketik terlihat sebelum dikirim. */
function nameError(value: string): string | null {
    const name = value.trim().replace(/\s+/g, ' ');
    if (name === '') return 'Nama wajib diisi.';
    if (name.length < 2) return 'Nama minimal 2 huruf.';
    if (!/^[\p{L}\p{M}][\p{L}\p{M} .,'’-]*$/u.test(name)) {
        return 'Nama hanya boleh berisi huruf, spasi, titik, koma, apostrof, dan tanda hubung.';
    }
    return null;
}

function IdentityCard({
    busy,
    error,
    recaptcha,
    onEdit,
    onSubmit,
}: {
    busy: boolean;
    error: string | null;
    recaptcha: { enabled: boolean; error: string | null };
    onEdit: () => void;
    onSubmit: (nama: string) => void;
}) {
    const [nama, setNama] = useState('');
    const [touched, setTouched] = useState(false);
    const invalid = nameError(nama);
    const valid = invalid === null;
    const message = (touched ? invalid : null) ?? error;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        setTouched(true);
        if (invalid) {
            document.getElementById(NAME_INPUT_ID)?.focus();
            return;
        }
        onSubmit(nama);
    };

    return (
        <form
            onSubmit={submit}
            noValidate
            className="transi-msg-in flex w-full max-w-[460px] flex-col gap-3 self-start rounded-2xl border border-[#e6ebf0] bg-white p-4 shadow-[0_10px_30px_rgba(2,43,74,0.06)] sm:ml-[42px] sm:p-5"
        >
            <div className="flex items-baseline justify-between gap-3">
                <p className="font-heading text-[17px] font-bold text-[var(--t-deep)]">Kenalan dulu, yuk</p>
                <span className={cn('font-mono text-xs', valid ? 'text-[#0d7a5f]' : 'text-[#8a96a3]')}>{valid ? '1/1' : '0/1'} valid</span>
            </div>
            <span className={cn('h-1 rounded-full transition-colors', valid ? 'bg-[#0d7a5f]' : 'bg-[#e1e7ed]')} aria-hidden="true" />
            <label htmlFor={NAME_INPUT_ID} className="mt-1 text-sm font-semibold text-[#3d4b59]">
                Nama lengkap <span className="text-[#d92d20]">*</span>
            </label>
            <input
                id={NAME_INPUT_ID}
                value={nama}
                onChange={(e) => {
                    setNama(e.target.value);
                    if (error) onEdit();
                }}
                onBlur={() => nama.trim() !== '' && setTouched(true)}
                autoFocus
                autoComplete="name"
                maxLength={100}
                required
                aria-invalid={Boolean(message)}
                aria-describedby={`${NAME_INPUT_ID}-info`}
                placeholder="Nama Anda"
                className={cn(
                    'h-12 w-full rounded-xl border bg-white px-3.5 text-[15px] text-[#1f2d3a] transition-[border-color,box-shadow] outline-none placeholder:text-[#8a96a3]',
                    message
                        ? 'border-[#d92d20] ring-4 ring-[#d92d20]/10'
                        : valid
                          ? 'border-[#0d7a5f] focus:ring-4 focus:ring-[#0d7a5f]/10'
                          : 'border-[#d5dee6] focus:border-[var(--t-navy)] focus:ring-4 focus:ring-[#0b5a8c]/10',
                )}
            />
            <p
                id={`${NAME_INPUT_ID}-info`}
                role={message ? 'alert' : undefined}
                className={cn('text-xs leading-relaxed', message ? 'font-semibold text-[#b42318]' : 'text-[#5b6b7a]')}
            >
                {message ?? 'Agar petugas tahu siapa yang bertanya. Jangan tulis NIK atau nomor rekening di sini.'}
            </p>
            <button
                type="submit"
                disabled={busy}
                className="font-heading flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--t-gold)] text-sm font-bold text-[var(--t-deep)] transition-[background-color,opacity] hover:bg-[#d0a552] disabled:opacity-50"
            >
                {busy ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" /> : null}
                Mulai chat
                {!busy && <SendHorizontal className="h-[18px] w-[18px]" aria-hidden="true" />}
            </button>
            <div className="text-xs text-[#5b6b7a]">
                <RecaptchaNotice enabled={recaptcha.enabled} error={recaptcha.error} />
            </div>
        </form>
    );
}

/* -------------------------------------------------------------- resume form */

function ResumeForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
    const [ref, setRef] = useState('');
    const [kontak, setKontak] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            const res = await postJson('/chat/lanjutkan', { referensi: ref, kontak });
            const data = (await res.json().catch(() => ({}))) as { message?: string; errors?: Record<string, string[]> };
            if (res.ok) onDone();
            else setError(data.errors?.referensi?.[0] ?? data.errors?.kontak?.[0] ?? data.message ?? 'Belum bisa dilanjutkan.');
        } catch {
            setError('Tidak ada koneksi. Coba lagi.');
        } finally {
            setBusy(false);
        }
    };

    const field = 'h-11 w-full rounded-xl border border-[#d5dee6] bg-white px-3.5 text-[15px] outline-none focus:border-[var(--t-navy)]';

    return (
        <form
            onSubmit={submit}
            className="transi-msg-in mx-auto flex w-full max-w-[460px] flex-col gap-3 rounded-2xl border border-[#e6ebf0] bg-white p-4 shadow-[0_10px_30px_rgba(2,43,74,0.06)]"
        >
            <p className="font-heading text-base font-bold text-[var(--t-deep)]">Lanjutkan chat dari HP lain</p>
            <p className="text-sm leading-relaxed text-[#5b6b7a]">
                Masukkan nomor referensi (REF-…) dan nomor WhatsApp atau surel yang Anda tinggalkan di chat sebelumnya.
            </p>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[#3d4b59]" htmlFor="lanjut-ref">
                Nomor referensi
                <input
                    id="lanjut-ref"
                    value={ref}
                    onChange={(e) => setRef(e.target.value)}
                    placeholder="REF-261025-NMAJ"
                    autoComplete="off"
                    className={cn(field, 'font-mono uppercase')}
                />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[#3d4b59]" htmlFor="lanjut-kontak">
                Nomor WhatsApp atau surel
                <input
                    id="lanjut-kontak"
                    value={kontak}
                    onChange={(e) => setKontak(e.target.value)}
                    placeholder="08…"
                    autoComplete="tel"
                    className={field}
                />
            </label>
            {error && (
                <p role="alert" className="text-xs font-semibold text-rose-600">
                    {error}
                </p>
            )}
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-[#5b6b7a] hover:bg-[#f2f5f8]">
                    Batal
                </button>
                <button
                    type="submit"
                    disabled={busy || ref.trim() === '' || kontak.trim() === ''}
                    className="rounded-full bg-[var(--t-navy)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                    {busy ? 'Mencocokkan…' : 'Lanjutkan'}
                </button>
            </div>
        </form>
    );
}
