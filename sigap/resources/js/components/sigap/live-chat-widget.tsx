import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { AlertTriangle, BookOpen, ChevronDown, ExternalLink, FileText, Globe, Headset, KeyRound, Landmark, Ticket } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';

/**
 * Bagian bersama Chat TARA (halaman /chat): tipe pesan, polling, label tunggu,
 * jawaban asisten beserta sumber, kartu portal, dan formulir kontak.
 *
 * Widget live chat melayang yang dulu tinggal di file ini sudah dihapus
 * bersama tampilan lama; nama file dipertahankan agar impor tidak berubah.
 */

const XSRF_COOKIE = 'XSRF-TOKEN';
/**
 * Selama TARA menyiapkan jawaban, polling dirapatkan sebagai cadangan Reverb
 * (tamu tidak ikut kanal privat): 1,5 dtk selama 15 dtk pertama, lalu 4 dtk —
 * tetap di bawah batas `chat-baca` 30 permintaan/menit per sesi.
 */
export const POLL_TYPING_FAST_MS = 1500;
export const POLL_TYPING_SLOW_MS = 4000;
export const POLL_TYPING_FAST_FOR_MS = 15000;

/** Jeda polling berikutnya setelah `elapsedMs` sejak TARA mulai menyiapkan jawaban. */
export function typingPollInterval(elapsedMs: number): number {
    return elapsedMs < POLL_TYPING_FAST_FOR_MS ? POLL_TYPING_FAST_MS : POLL_TYPING_SLOW_MS;
}

/**
 * Polling percakapan: jeda `idleMs`, atau jeda bertahap {@see typingPollInterval}
 * selama `typing`. Dijeda saat tab tersembunyi. Hitungan 15 dtk mulai ulang
 * setiap kali TARA mulai menyiapkan jawaban.
 */
export function useChatPolling(enabled: boolean, typing: boolean, idleMs: number, tick: () => void): void {
    const tickRef = useRef(tick);
    useEffect(() => {
        tickRef.current = tick;
    }, [tick]);

    useEffect(() => {
        if (!enabled) return;
        const since = Date.now();
        let timer: number | undefined;
        const schedule = () => {
            timer = window.setTimeout(
                () => {
                    if (document.visibilityState === 'visible') tickRef.current();
                    schedule();
                },
                typing ? typingPollInterval(Date.now() - since) : idleMs,
            );
        };
        schedule();
        return () => window.clearTimeout(timer);
    }, [enabled, typing, idleMs]);
}

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
    /** Asal pengaduan dari kartu Kenalan (31-10-2026). */
    provinsi?: string | null;
    lokasi?: string | null;
}

export interface Assistant {
    aktif: boolean;
    mode: 'ai' | 'petugas';
    jam_layanan: string;
    petugas_tersedia: boolean;
    referensi: string | null;
    butuh_kontak: boolean;
    /** TARA sedang menyiapkan jawaban di antrean `ai` (PRD-AI FR-AI-04). */
    mengetik?: boolean;
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
 * Daftar sumber di bawah jawaban asisten. Kutipan dari situs/berkas resmi
 * menampilkan potongan teks aslinya + tanggal diambil, agar warga bisa
 * mencocokkan jawaban dengan sumbernya.
 */
/** Petugas sedang aktif bila membalas dalam 30 menit terakhir (selaras dengan server). */
export function staffActive(messages: ChatMessage[]): boolean {
    const since = Date.now() - 30 * 60 * 1000;
    return messages.some((m) => m.sender_type === 'admin' && m.pada !== null && Date.parse(m.pada) >= since);
}

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

/** Tahap label tunggu: setelah 15 dtk tanpa balasan tampil "masih menyiapkan" (PRD-AI FR-AI-04). */
export const WAIT_STAGES: readonly { after: number; label: string }[] = [
    { after: 0, label: 'TARA sedang mengetik…' },
    { after: 3000, label: 'TARA sedang mencari di sumber resmi…' },
    { after: 15000, label: 'TARA masih menyiapkan jawaban, mohon tunggu sebentar…' },
];

/** Label untuk lama menunggu `elapsedMs`. */
export function waitLabelFor(elapsedMs: number): string {
    return [...WAIT_STAGES].reverse().find((s) => elapsedMs >= s.after)?.label ?? WAIT_STAGES[0].label;
}

/**
 * Label tunggu bertahap: jawaban AI butuh beberapa detik, jadi warga diberi
 * tahu apa yang sedang terjadi alih-alih titik-titik saja.
 */
export function useWaitLabel(active: boolean): string {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!active) return;
        const timers = WAIT_STAGES.slice(1).map((s) => setTimeout(() => setElapsed(s.after), s.after));
        return () => {
            timers.forEach(clearTimeout);
            setElapsed(0);
        };
    }, [active]);

    return waitLabelFor(elapsed);
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
        <div className="mt-2 flex flex-col gap-1.5 border-t border-dashed border-[var(--tcd-border,oklch(0.928_0.006_264.531))] pt-2 whitespace-normal">
            <span className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold tracking-wide text-[var(--tcd-text-3,oklch(0.551_0.027_264.364))] uppercase">
                    Sumber resmi ({sorted.length})
                </span>
                {hasQuotes && (
                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        aria-expanded={open}
                        className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-[var(--tcd-text-2,oklch(0.446_0.03_256.802))] hover:bg-[var(--tcd-muted,oklch(0.985_0.002_247.839))]"
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
                                    <blockquote className="line-clamp-3 border-l-2 border-[var(--tcd-border-strong,oklch(0.872_0.01_258.338))] pl-2 text-[11px] leading-snug text-[var(--tcd-text-2,oklch(0.446_0.03_256.802))] italic">
                                        “{s.kutipan}”
                                    </blockquote>
                                )}
                                {s.label && <span className="pl-2 text-[10px] text-[var(--tcd-text-3,oklch(0.551_0.027_264.364))]">{s.label}</span>}
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
                <div className="mt-2 overflow-hidden rounded-md border border-[var(--tcd-border,oklch(0.928_0.006_264.531))] whitespace-normal">
                    <div className="flex items-center justify-between gap-2 border-b border-[var(--tcd-border,oklch(0.967_0.003_264.542))] px-2.5 py-1.5">
                        <span className="text-primary flex items-center gap-1 font-bold">
                            <Ticket className="h-3.5 w-3.5" aria-hidden="true" /> {t.nomor}
                        </span>
                        <span className="rounded-full bg-[var(--tcd-info-soft,oklch(0.932_0.032_255.585))] px-2 py-0.5 text-[10px] font-bold text-[var(--tcd-info,oklch(0.424_0.199_265.638))] uppercase">
                            {t.status_label}
                        </span>
                    </div>
                    <dl className="grid grid-cols-[70px_1fr] gap-x-2 gap-y-1 px-2.5 py-2 text-[11px]">
                        <dt className="text-[var(--tcd-text-3,oklch(0.551_0.027_264.364))]">Kategori</dt>
                        <dd className="font-semibold">{t.kategori ?? '—'}</dd>
                        <dt className="text-[var(--tcd-text-3,oklch(0.551_0.027_264.364))]">Kawasan</dt>
                        <dd className="font-semibold">{t.kawasan ?? '—'}</dd>
                        <dt className="text-[var(--tcd-text-3,oklch(0.551_0.027_264.364))]">Batas waktu</dt>
                        <dd className="font-semibold">
                            {t.tenggat ? new Date(t.tenggat).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </dd>
                    </dl>
                    <Link
                        href={t.url}
                        className="text-primary block border-t border-[var(--tcd-border,oklch(0.967_0.003_264.542))] px-2.5 py-1.5 font-semibold hover:underline"
                    >
                        Lihat riwayat lengkap
                    </Link>
                </div>
            )}

            {message.portal && <PortalCard portal={message.portal} referral={message.rujukan ?? null} />}

            {message.beda_sumber && (
                <div className="mt-2 flex items-start gap-1.5 rounded-md border border-[var(--tcd-warning-border,oklch(0.924_0.12_95.746))] bg-[var(--tcd-warning-soft,oklch(0.987_0.022_95.277))] px-2.5 py-2 text-[11px] leading-snug whitespace-normal text-[var(--tcd-warning,oklch(0.414_0.112_45.904))]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                        <strong>Sumber resmi menyebut ketentuan berbeda.</strong> Semua versi ditampilkan beserta sumbernya. Pastikan ketentuan yang
                        berlaku ke petugas atau dinas transmigrasi kabupaten/kota.
                    </span>
                </div>
            )}
            {message.kebijakan && (
                <div className="mt-2 flex items-start gap-1.5 rounded-md border border-[var(--tcd-info-border,oklch(0.882_0.059_254.128))] bg-[var(--tcd-info-soft,oklch(0.97_0.014_254.604))] px-2.5 py-2 text-[11px] leading-snug whitespace-normal text-[var(--tcd-info,oklch(0.379_0.146_265.522))]">
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
                <div className="mt-2 flex items-center gap-2 text-[11px] whitespace-normal text-[var(--tcd-text-3,oklch(0.551_0.027_264.364))]">
                    {message.nilai ? (
                        <span>Terima kasih atas penilaian Anda.</span>
                    ) : (
                        <>
                            Membantu?
                            <button
                                type="button"
                                onClick={() => onRate(true)}
                                className="rounded-full border border-[var(--tcd-border-strong,oklch(0.872_0.01_258.338))] px-2 py-0.5 hover:bg-[var(--tcd-muted,oklch(0.985_0.002_247.839))]"
                            >
                                Ya
                            </button>
                            <button
                                type="button"
                                onClick={() => onRate(false)}
                                className="rounded-full border border-[var(--tcd-border-strong,oklch(0.872_0.01_258.338))] px-2 py-0.5 hover:bg-[var(--tcd-muted,oklch(0.985_0.002_247.839))]"
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
                    className="border-primary text-primary mt-2 flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-normal hover:bg-[var(--tcd-muted,oklch(0.985_0.002_247.839))]"
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
                amber
                    ? 'border-[var(--tcd-warning-border,oklch(0.924_0.12_95.746))] bg-[var(--tcd-warning-soft,oklch(0.987_0.022_95.277))] text-[var(--tcd-warning,oklch(0.414_0.112_45.904))]'
                    : 'border-[var(--tcd-success-border,oklch(0.905_0.093_164.15))] bg-[var(--tcd-success-soft,oklch(0.979_0.021_166.113))] text-[var(--tcd-success,oklch(0.378_0.077_168.94))]',
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
                <div className="text-left text-[var(--tcd-text,oklch(0.278_0.033_256.848))]">
                    <PortalCard portal={message.portal} referral={message.rujukan ?? null} />
                </div>
            )}
        </div>
    );
}

/**
 * Kartu portal tujuan. Dengan rujukan, tombol utama membuka halaman
 * pengantar Contact Center (langkah, ringkasan, tempat bukti) — bukan portal langsung.
 */
export function PortalCard({ portal, referral }: { portal: PortalCardInfo; referral: ReferralInfo | null }) {
    return (
        <div className="mt-2 overflow-hidden rounded-md border border-[var(--tcd-border,oklch(0.928_0.006_264.531))] bg-[var(--tcd-surface,#fff)] whitespace-normal">
            <div className="px-2.5 py-2">
                <span className="text-primary flex items-center gap-1 text-[12px] font-bold">
                    <Globe className="h-3.5 w-3.5" aria-hidden="true" /> {portal.nama}
                </span>
                <p className="mt-0.5 text-[11px] text-[var(--tcd-text-2,oklch(0.446_0.03_256.802))]">{portal.kegunaan}</p>
                <p className="mt-0.5 font-mono text-[10px] text-[var(--tcd-text-3,oklch(0.707_0.022_261.325))]">{portal.domain}</p>
                {referral && (
                    <p className="mt-1 text-[11px] text-[var(--tcd-text-2,oklch(0.446_0.03_256.802))]">
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
                    className="text-primary flex items-center justify-center gap-1 border-t border-[var(--tcd-border,oklch(0.967_0.003_264.542))] px-2.5 py-1.5 text-[12px] font-semibold hover:underline"
                >
                    {portal.tombol} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    <span className="sr-only">(membuka tab baru)</span>
                </a>
            ) : (
                <p className="border-t border-[var(--tcd-border,oklch(0.967_0.003_264.542))] px-2.5 py-1.5 text-center text-[11px] text-[var(--tcd-warning,oklch(0.555_0.163_48.998))]">
                    Portal sedang tidak dapat diakses.
                </p>
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
        <form
            onSubmit={submit}
            className="space-y-2 border-t border-[var(--tcd-warning-border,oklch(0.924_0.12_95.746))] bg-[var(--tcd-warning-soft,oklch(0.987_0.022_95.277))] p-3"
        >
            <label htmlFor="sigap-chat-contact" className="block text-xs font-semibold text-[var(--tcd-warning,oklch(0.414_0.112_45.904))]">
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
                    className="min-w-0 flex-1 rounded-lg border bg-[var(--tcd-surface,#fff)] px-3 py-2 text-xs focus:outline-none"
                />
                <button type="submit" disabled={busy} className="bg-primary rounded-lg px-3 text-xs font-bold text-white disabled:opacity-60">
                    {busy ? 'Menyimpan…' : 'Simpan'}
                </button>
            </div>
            {error && (
                <p role="alert" className="text-xs text-[var(--tcd-danger,oklch(0.586_0.253_17.585))]">
                    {error}
                </p>
            )}
            <p className="text-[11px] text-[var(--tcd-warning,oklch(0.414_0.112_45.904))]">
                Kontak hanya dipakai petugas untuk menindaklanjuti percakapan ini.
            </p>
        </form>
    );
}
