import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    ArrowUp,
    ArrowUpRight,
    AtSign,
    BellRing,
    BookCheck,
    BookOpen,
    Briefcase,
    ChartColumn,
    ClipboardList,
    FilePenLine,
    FileText,
    Hash,
    Headset,
    KeyRound,
    Landmark,
    Map as MapIcon,
    MapPinned,
    Megaphone,
    MessageCircle,
    Minus,
    Phone,
    Plus,
    Search,
    ShieldAlert,
    ShieldCheck,
    Ticket,
    TicketCheck,
    Timer,
    UserPlus,
    UserRoundCheck,
    type LucideIcon,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';

import TransiHeader from '@/components/sigap/transi-header';
import { goToChat } from '@/lib/chat-transition';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';

/**
 * Beranda baru (/beranda-baru) — contact center yang semuanya dimulai dari
 * chat, dengan maskot TRANSI. Desain: pen.dev "Publik / Beranda — Contact
 * Center TRANSI" (desktop) dan varian Mobile 320–430.
 *
 * Semua tombol chat membawa ke halaman /chat (lib/chat-transition): kotak
 * tanya atau kartu hero membesar menjadi panel percakapan.
 */

const IMG = '/images/transi';

const SAMPLE_QUESTIONS: { icon: LucideIcon; text: string }[] = [
    { icon: MapPinned, text: 'Sertifikat lahan saya belum keluar' },
    { icon: Ticket, text: 'Cek tiket TKT-261012-7KQ4MZ' },
    { icon: ClipboardList, text: 'Cara daftar transmigrasi' },
    { icon: KeyRound, text: 'Saya lupa kata sandi' },
];

const STEPS: { icon: LucideIcon; title: string; desc: string; pillIcon: LucideIcon; pill: string; mono?: boolean; strong?: boolean }[] = [
    {
        icon: MessageCircle,
        title: 'Tanya TRANSI, kapan saja',
        desc: 'Asisten menjawab 24 jam hanya dari artikel resmi Kementerian, lengkap dengan sumbernya. Data pribadi yang Anda ketik otomatis disamarkan.',
        pillIcon: BookOpen,
        pill: 'Sumber: Panduan Layanan SIGAP',
    },
    {
        icon: Headset,
        title: 'Diteruskan ke petugas bila perlu',
        desc: 'Untuk aduan atau hak pribadi, TRANSI meneruskan ke petugas dengan ringkasan, jadi Anda tidak perlu mengulang cerita. Di luar jam kerja, tinggalkan nomor WhatsApp.',
        pillIcon: Hash,
        pill: 'REF-261025-NMAJ',
        mono: true,
    },
    {
        icon: TicketCheck,
        title: 'Tiket dan rujukan terbit dari chat',
        desc: 'Petugas menerbitkan tiket dan nomornya langsung muncul di chat. Bila urusannya di portal lain, Anda dirujuk lengkap dengan pendamping sampai berhasil.',
        pillIcon: Ticket,
        pill: 'TKT-261025-7KQ4MZ',
        mono: true,
    },
    {
        icon: UserPlus,
        title: 'Akun dibantu petugas, tanpa email',
        desc: 'Cukup sebutkan NIK dan nama. Anda menerima tombol untuk membuat kata sandi di chat. Lupa kata sandi? Pulihkan lewat chat juga.',
        pillIcon: KeyRound,
        pill: 'Buat kata sandi',
        strong: true,
    },
];

const TRUST: { icon: LucideIcon; title: string; desc: string }[] = [
    {
        icon: BookCheck,
        title: 'Tidak mengarang jawaban',
        desc: 'TRANSI hanya menjawab dari Basis Pengetahuan resmi. Bila tidak tahu, ia memanggil petugas.',
    },
    { icon: ShieldCheck, title: 'Data pribadi disamarkan', desc: 'NIK dan nomor HP yang Anda ketik disamarkan sebelum diproses asisten.' },
    { icon: Timer, title: 'Dipantau sampai selesai', desc: 'Setiap tiket punya target waktu selesai, diakhiri survei kepuasan dari Anda.' },
    { icon: BellRing, title: 'Kabar langsung ke Anda', desc: 'Nomor tiket, perubahan status, dan tanggapan petugas dikirim ke chat dan email.' },
];

const OTHER_PATHS: { icon: LucideIcon; title: string; desc: string; href: string }[] = [
    { icon: FilePenLine, title: 'Isi formulir pengaduan', desc: 'Untuk laporan panjang dengan lampiran dan titik lokasi.', href: '/pengaduan/baru' },
    { icon: MapIcon, title: 'Peta aduan kawasan', desc: 'Lihat sebaran aduan di setiap kawasan transmigrasi.', href: '/peta' },
    { icon: ChartColumn, title: 'Data SIGAP', desc: 'Statistik penanganan dan kepuasan layanan.', href: '/tentang' },
    { icon: Phone, title: 'Kontak kantor', desc: 'Alamat dan telepon kantor pusat serta kawasan.', href: '/tentang-kami' },
];

/** Kanal resmi lain (alamat diperiksa langsung di situs resmi, 25 Okt 2026). */
const CHANNELS: { icon: LucideIcon; label: string; href: string }[] = [
    { icon: AtSign, label: '@kementrans.ri', href: 'https://www.instagram.com/kementrans.ri/' },
    { icon: Landmark, label: 'PPID Kementrans', href: 'https://ppid.transmigrasi.go.id/' },
    { icon: Megaphone, label: 'SP4N-LAPOR!', href: 'https://sp4n.lapor.go.id/instansi/kementerian-transmigrasi' },
    { icon: ShieldAlert, label: 'Inspektorat Jenderal', href: 'https://ppid.transmigrasi.go.id/standar-layanan/pengaduan-penyalahgunaan-wewenang' },
    { icon: Briefcase, label: 'Pengaduan internal pegawai', href: '/pengaduan/internal' },
];

const FAQS = [
    {
        q: 'Apakah saya harus punya akun untuk bertanya?',
        a: 'Tidak. Cukup isi nama lalu mulai chat. Akun baru diperlukan untuk memantau semua laporan Anda di Portal Warga, dan petugas dapat membuatkannya lewat chat.',
    },
    {
        q: 'Saya tidak punya email. Bisakah tetap punya akun?',
        a: 'Bisa. Tulis kebutuhan Anda di chat. Petugas mencocokkan NIK dan nama Anda, lalu mengirim tombol untuk membuat kata sandi langsung di chat. Setelah itu Anda masuk dengan NIK dan kata sandi.',
    },
    {
        q: 'Bagaimana kalau TRANSI tidak tahu jawabannya?',
        a: 'TRANSI hanya menjawab dari artikel resmi. Bila jawabannya tidak ada, pertanyaan Anda diteruskan ke petugas beserta ringkasannya. Di luar jam layanan, Anda bisa meninggalkan nomor WhatsApp untuk dihubungi.',
    },
    {
        q: 'Saya lupa kata sandi, apa yang harus dilakukan?',
        a: 'Bila akun Anda punya email aktif, pakai menu Lupa kata sandi di halaman Masuk. Bila tidak, minta bantuan lewat chat: petugas mencocokkan NIK dan nomor HP yang terdaftar, lalu mengirim tombol untuk membuat kata sandi baru.',
    },
    {
        q: 'Bagaimana jika status tiket saya sudah Selesai?',
        a: 'Status Selesai berarti laporan Anda sudah ditangani. Anda akan diminta mengisi survei kepuasan. Bila masalahnya ternyata belum beres, sampaikan lewat chat dengan menyebut nomor tiketnya.',
    },
    {
        q: 'Bisakah dokumen yang sudah diunggah dihapus?',
        a: 'Demi akuntabilitas, dokumen yang sudah dikirim tidak bisa dihapus sendiri. Hubungi petugas lewat chat dan sebutkan nomor tiket Anda.',
    },
];

/* ------------------------------------------------------------------ hooks */

/**
 * Tandai elemen [data-reveal] dengan .is-in saat masuk layar. Kelas
 * .transi-js dipasang sebelum browser menggambar, jadi tidak ada kedipan;
 * tanpa JS konten tetap terlihat.
 */
function useReveal(root: React.RefObject<HTMLElement | null>) {
    useLayoutEffect(() => {
        const el = root.current;
        if (!el) return;
        const items = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'));
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (reduce || typeof IntersectionObserver === 'undefined') {
            items.forEach((i) => i.classList.add('is-in'));
            return;
        }

        el.classList.add('transi-js');
        const io = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-in');
                        io.unobserve(entry.target);
                    }
                }
            },
            { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
        );
        for (const item of items) {
            // Yang sudah terlihat saat dibuka langsung tampil (tanpa menunggu observer).
            if (item.getBoundingClientRect().top < window.innerHeight * 0.92) item.classList.add('is-in');
            else io.observe(item);
        }
        return () => io.disconnect();
    }, [root]);
}

/** Teks contoh yang diketik bergantian di kolom tanya (hanya saat kolom kosong). */
function useTypewriter(phrases: string[], active: boolean): string {
    const [text, setText] = useState('');

    useEffect(() => {
        if (!active || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setText('');
            return;
        }
        let phrase = 0;
        let pos = 0;
        let deleting = false;
        let timer = 0;
        const tick = () => {
            const full = phrases[phrase];
            pos += deleting ? -1 : 1;
            setText(full.slice(0, pos));
            let wait = deleting ? 28 : 55;
            if (!deleting && pos === full.length) {
                deleting = true;
                wait = 1800;
            } else if (deleting && pos === 0) {
                deleting = false;
                phrase = (phrase + 1) % phrases.length;
                wait = 400;
            }
            timer = window.setTimeout(tick, wait);
        };
        timer = window.setTimeout(tick, 900);
        return () => window.clearTimeout(timer);
    }, [phrases, active]);

    return text;
}

const delay = (s: number) => ({ '--d': `${s}s` }) as CSSProperties;

const HERO_CARD_ID = 'transi-kartu-hero';

/** Elemen sumber transisi hanya dipakai bila sedang terlihat di layar. */
function visible(id: string): HTMLElement | null {
    const el = document.getElementById(id);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight ? el : null;
}

/** Tombol TRANSI melayang: membuka halaman chat layar penuh. */
function TransiLauncher() {
    return (
        <div className="transi-launcher fixed right-4 bottom-4 z-[100] flex items-center gap-3 sm:right-6 sm:bottom-6">
            <button
                type="button"
                onClick={(e) => goToChat({ source: e.currentTarget.parentElement })}
                className="transi-launcher__bubble hidden rounded-2xl rounded-br-sm bg-white px-4 py-2.5 text-sm font-semibold text-[#022b4a] shadow-[0_10px_24px_rgba(0,18,36,0.18)] sm:block"
            >
                Ada yang bisa dibantu?
            </button>
            <button
                type="button"
                onClick={(e) => goToChat({ source: e.currentTarget })}
                aria-label="Chat dengan TRANSI"
                className="transi-launcher__face h-16 w-16 rounded-full border-[3px] border-[#c29642] bg-[#f8f3ef] bg-cover bg-center shadow-[0_12px_28px_rgba(0,18,36,0.35)] sm:h-[72px] sm:w-[72px]"
                style={{ backgroundImage: `url(${IMG}/avatar.webp)` }}
            />
        </div>
    );
}

/* ------------------------------------------------------------------- page */

export default function BerandaTransi() {
    const { auth, assistant } = usePage<SharedData>().props;
    const aiEnabled = Boolean(assistant?.enabled);
    const pageRef = useRef<HTMLDivElement>(null);
    useReveal(pageRef);

    return (
        <>
            <Head title="Contact Center TRANSI — SIGAP">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    rel="stylesheet"
                    href="https://fonts.bunny.net/css?family=space-grotesk:500,600,700|jost:400,500,600|jetbrains-mono:500,600"
                    head-key="transi-fonts"
                />
                <meta
                    name="description"
                    content="Contact Center Kementerian Transmigrasi. Tanya, lapor, cek status tiket, sampai dibuatkan akun, cukup mulai dari chat dengan TRANSI."
                />
            </Head>

            <div ref={pageRef} className="transi-page min-h-screen bg-white text-[#0f2233] antialiased">
                <a
                    href="#konten"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[110] focus:rounded-lg focus:bg-[var(--t-navy)] focus:px-4 focus:py-2 focus:text-white"
                >
                    Langsung ke konten utama
                </a>
                <TransiHeader loggedIn={Boolean(auth?.user)} isAdmin={Boolean(auth?.user?.is_admin)} onChat={() => goToChat()} />
                <main id="konten">
                    <Hero aiEnabled={aiEnabled} />
                    <JustType />
                    <Journey />
                    <Trust />
                    <TrackAndPaths />
                    <Faq />
                    <ClosingCta />
                </main>
                <SiteFooter />
                <TransiLauncher />
            </div>
        </>
    );
}

/* ------------------------------------------------------------------- hero */

function Hero({ aiEnabled }: { aiEnabled: boolean }) {
    return (
        <section className="relative overflow-hidden bg-[var(--t-deep)] text-white">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{ background: 'radial-gradient(70% 90% at 78% 45%, rgba(11,90,140,0.8) 0%, rgba(2,43,74,0) 70%)' }}
            />
            <div className="relative mx-auto grid max-w-[1312px] gap-6 px-4 pt-8 sm:px-6 sm:pt-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:px-16 lg:pt-[72px] lg:pb-10">
                <div className="flex flex-col gap-6 pb-2 lg:gap-7 lg:pt-6 lg:pb-16">
                    <span
                        className="transi-rise inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3.5 py-1.5 text-[13px] text-[#e6eef5] sm:text-sm"
                        style={delay(0.05)}
                    >
                        <span className="transi-live-dot h-2 w-2 rounded-full bg-[#4ade80]" aria-hidden="true" />
                        {aiEnabled ? (
                            <>
                                <span className="hidden sm:inline">Contact Center Kementerian Transmigrasi · Online 24 jam</span>
                                <span className="sm:hidden">Online 24 jam · Kementerian Transmigrasi</span>
                            </>
                        ) : (
                            'Contact Center Kementerian Transmigrasi'
                        )}
                    </span>
                    <h1
                        className="transi-rise font-heading text-[40px] leading-[1.06] font-bold tracking-[-0.02em] text-balance sm:text-5xl lg:text-[60px] lg:leading-[1.08]"
                        style={delay(0.15)}
                    >
                        Semua urusan transmigrasi, cukup mulai dari chat.
                    </h1>
                    <p className="transi-rise max-w-[58ch] text-[17px] leading-[1.55] text-[#c9d6e2] sm:text-[19px]" style={delay(0.28)}>
                        Tanya, lapor, cek status tiket, sampai dibuatkan akun. TRANSI dan petugas kami membantu dalam satu percakapan: tanpa formulir
                        panjang, tanpa harus punya email.
                    </p>
                    <div className="transi-rise flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3.5" style={delay(0.4)}>
                        <button
                            type="button"
                            onClick={() => goToChat({ source: visible(HERO_CARD_ID) })}
                            className="transi-lift font-heading flex h-14 items-center justify-center gap-2.5 rounded-full bg-[var(--t-gold)] px-[26px] text-[17px] font-bold text-[var(--t-deep)] shadow-[0_10px_28px_rgba(194,150,66,0.35)] hover:bg-[#d0a552] hover:shadow-[0_14px_34px_rgba(194,150,66,0.45)]"
                        >
                            <MessageCircle className="h-5 w-5" aria-hidden="true" /> Mulai chat dengan TRANSI
                        </button>
                        <Link
                            href="/lacak"
                            className="transi-lift flex h-14 items-center justify-center gap-2 rounded-full border-[1.5px] border-white/30 px-[22px] text-base font-medium text-white hover:border-white/60 hover:bg-white/[0.06]"
                        >
                            <Search className="h-[18px] w-[18px]" aria-hidden="true" /> Lacak tiket
                        </Link>
                    </div>
                    <ul
                        className="transi-rise flex flex-col gap-3 pt-1 text-sm text-[#c9d6e2] sm:flex-row sm:flex-wrap sm:gap-6 sm:pt-2"
                        style={delay(0.52)}
                    >
                        {[
                            [BookCheck, 'Jawaban dari sumber resmi'],
                            [UserRoundCheck, 'Petugas Sen–Jum 08.00–16.00 WIB'],
                            [ShieldCheck, 'Data pribadi dilindungi'],
                        ].map(([Icon, text]) => {
                            const I = Icon as LucideIcon;
                            return (
                                <li key={text as string} className="flex items-center gap-2">
                                    <I className="h-[18px] w-[18px] text-[var(--t-gold)]" aria-hidden="true" />
                                    {text as string}
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <HeroVisual />
            </div>
        </section>
    );
}

/** TRANSI menyapa + kartu chat yang memutar alur nyata secara berurutan. */
function HeroVisual() {
    return (
        <div className="relative mx-auto w-full max-w-[460px] pb-10 lg:mx-0 lg:aspect-square lg:max-w-[648px] lg:self-end lg:pb-0">
            {/* Maskot & lingkar cahaya */}
            <div className="relative mx-auto aspect-square w-[78%] max-w-[360px] lg:absolute lg:top-[4%] lg:left-[34%] lg:w-[66%] lg:max-w-none">
                <div aria-hidden="true" className="transi-halo absolute inset-[-2%] rounded-full border-2 border-[#c29642]/25" />
                <div aria-hidden="true" className="absolute inset-[9%] rounded-full bg-white/[0.05]" />
                <img
                    src={`${IMG}/08-selamat-datang.webp`}
                    alt="TRANSI, maskot contact center SIGAP, menyambut dengan kedua tangan terbuka"
                    width={760}
                    height={760}
                    fetchPriority="high"
                    className="transi-float transi-rise relative h-full w-full object-contain drop-shadow-[0_24px_40px_rgba(0,10,25,0.35)]"
                    style={delay(0.3)}
                />
            </div>

            {/* Kartu chat */}
            <div
                id={HERO_CARD_ID}
                className="vt-chat-target transi-pop relative z-10 -mt-[18%] w-full overflow-hidden rounded-[18px] bg-white text-left shadow-[0_24px_48px_rgba(0,18,36,0.45)] sm:mx-auto sm:max-w-[380px] lg:absolute lg:top-[39%] lg:left-0 lg:mt-0 lg:w-[340px]"
                style={delay(0.55)}
            >
                <div className="flex items-center gap-2.5 bg-[var(--t-navy)] px-3.5 py-3">
                    <span
                        className="h-[34px] w-[34px] shrink-0 rounded-full bg-[var(--t-cream)] bg-cover bg-center"
                        style={{ backgroundImage: `url(${IMG}/avatar.webp)` }}
                        aria-hidden="true"
                    />
                    <span className="min-w-0">
                        <span className="font-heading block text-sm font-bold text-white">TRANSI</span>
                        <span className="block truncate text-[11px] text-[#bcd0e0]">Asisten SIGAP · menjawab dari sumber resmi</span>
                    </span>
                </div>
                <div className="flex flex-col gap-2.5 bg-[#f6f8fa] p-3.5 text-[13px] leading-[1.45]" aria-hidden="true">
                    <p
                        className="transi-pop w-fit max-w-[85%] rounded-[14px] rounded-bl-[4px] border border-[#e6ebf0] bg-white px-3 py-2 text-[#1f2d3a]"
                        style={delay(0.9)}
                    >
                        Halo, saya TRANSI 👋 Ceritakan saja kebutuhan Anda.
                    </p>
                    <p
                        className="transi-pop ml-auto w-fit max-w-[80%] rounded-[14px] rounded-br-[4px] bg-[var(--t-navy)] px-3 py-2 text-white"
                        style={delay(1.6)}
                    >
                        Sertifikat lahan saya di SP2 belum keluar.
                    </p>
                    <div className="transi-typing flex w-fit gap-1 rounded-[14px] border border-[#e6ebf0] bg-white px-3 py-2.5" style={delay(2.2)}>
                        <span className="h-1.5 w-1.5 rounded-full bg-[#8a96a3]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-[#8a96a3]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-[#8a96a3]" />
                    </div>
                    <div
                        className="transi-pop flex w-fit max-w-[90%] flex-col gap-2 rounded-[14px] rounded-bl-[4px] border border-[#e6ebf0] bg-white px-3 py-2 text-[#1f2d3a]"
                        style={delay(3.3)}
                    >
                        <span>Saya teruskan ke petugas, ya. Nomor referensi Anda REF-261025-NMAJ.</span>
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#0d7a5f]">
                            <UserRoundCheck className="h-[13px] w-[13px]" /> Rina (petugas) bergabung
                        </span>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1.5 bg-[#f6f8fa] px-3.5 pt-1 pb-3.5">
                    {['Lapor masalah', 'Cek tiket', 'Buat akun'].map((c, i) => (
                        <button
                            key={c}
                            type="button"
                            onClick={() =>
                                goToChat({
                                    question:
                                        c === 'Cek tiket'
                                            ? 'Saya mau cek status tiket'
                                            : c === 'Buat akun'
                                              ? 'Saya mau dibuatkan akun'
                                              : 'Saya mau melapor masalah',
                                    source: document.getElementById(HERO_CARD_ID),
                                })
                            }
                            className="transi-pop transi-lift rounded-full border border-[#c8d4df] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--t-navy)] hover:border-[var(--t-navy)]"
                            style={delay(4 + i * 0.12)}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            {/* Lencana tiket */}
            <div
                className="transi-pop absolute right-0 bottom-[7%] z-20 hidden items-center gap-2.5 rounded-[14px] bg-white px-3.5 py-2.5 shadow-[0_14px_30px_rgba(0,18,36,0.4)] lg:flex"
                style={delay(4.6)}
                aria-hidden="true"
            >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f6ef]">
                    <TicketCheck className="h-4 w-4 text-[#0d7a5f]" />
                </span>
                <span>
                    <span className="block text-[13px] font-semibold text-[#1f2d3a]">Tiket terbit dari chat</span>
                    <span className="block font-mono text-xs text-[#5b6b7a]">TKT-261025-7KQ4MZ</span>
                </span>
            </div>
        </div>
    );
}

/* -------------------------------------------------------------- just type */

function JustType() {
    const [value, setValue] = useState('');
    const [focused, setFocused] = useState(false);
    const typed = useTypewriter(
        SAMPLE_QUESTIONS.map((s) => s.text),
        !focused && value === '',
    );

    const formRef = useRef<HTMLFormElement>(null);
    const submit = (e: FormEvent) => {
        e.preventDefault();
        goToChat({ question: value, source: formRef.current });
    };

    return (
        <section className="bg-[var(--t-cream)] py-12 sm:py-[72px]">
            <div className="mx-auto flex max-w-[1312px] flex-col gap-6 px-4 sm:items-center sm:gap-7 sm:px-6 lg:px-16">
                <p data-reveal className="text-xs font-semibold tracking-[0.12em] text-[#9a7330] uppercase sm:text-[13px]">
                    Tidak perlu tahu harus ke menu mana
                </p>
                <h2
                    data-reveal
                    style={delay(0.08)}
                    className="font-heading text-[28px] leading-[1.15] font-bold tracking-[-0.015em] text-balance text-[var(--t-deep)] sm:text-center sm:text-[40px]"
                >
                    Cukup ketik seperti bicara dengan petugas.
                </h2>
                <form
                    ref={formRef}
                    data-reveal="zoom"
                    style={delay(0.16)}
                    onSubmit={submit}
                    className="flex h-16 w-full max-w-[860px] items-center gap-3 rounded-full border border-[#e3d9cf] bg-white pr-2 pl-2 shadow-[0_14px_36px_rgba(59,42,18,0.08)] transition-shadow focus-within:border-[var(--t-gold)] focus-within:shadow-[0_16px_40px_rgba(194,150,66,0.22)] sm:h-[72px] sm:gap-3.5 sm:pr-2.5 sm:pl-3.5"
                >
                    <span
                        className="h-11 w-11 shrink-0 rounded-full bg-[var(--t-cream)] bg-cover bg-center sm:h-12 sm:w-12"
                        style={{ backgroundImage: `url(${IMG}/avatar.webp)` }}
                        aria-hidden="true"
                    />
                    <label htmlFor="tanya-transi" className="sr-only">
                        Tulis pertanyaan atau keluhan Anda
                    </label>
                    <div className="relative min-w-0 flex-1">
                        <input
                            id="tanya-transi"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            autoComplete="off"
                            maxLength={500}
                            placeholder={focused ? 'Tulis pertanyaan atau keluhan Anda…' : ''}
                            className="w-full bg-transparent text-base text-[#1f2d3a] outline-none placeholder:text-[#8a96a3] sm:text-lg"
                        />
                        {!focused && value === '' && (
                            <span
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 flex items-center truncate text-base text-[#8a96a3] sm:text-lg"
                            >
                                {typed || (
                                    <>
                                        <span className="hidden sm:inline">Tulis pertanyaan atau keluhan Anda…</span>
                                        <span className="sm:hidden">Tulis pertanyaan Anda…</span>
                                    </>
                                )}
                                {typed && <span className="transi-caret ml-0.5 inline-block h-5 w-[2px] bg-[var(--t-gold)]" />}
                            </span>
                        )}
                    </div>
                    <button
                        type="submit"
                        aria-label="Tanya TRANSI"
                        className="transi-lift font-heading flex h-12 w-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--t-gold)] text-base font-bold text-[var(--t-deep)] hover:bg-[#d0a552] sm:h-[52px] sm:w-auto sm:px-[22px]"
                    >
                        <span className="hidden sm:inline">Tanya TRANSI</span>
                        <ArrowUpRight className="hidden h-[18px] w-[18px] sm:block" aria-hidden="true" />
                        <ArrowUp className="h-5 w-5 sm:hidden" aria-hidden="true" />
                    </button>
                </form>
                <div data-reveal style={delay(0.24)} className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-2.5">
                    <span className="text-sm font-medium text-[#6b5a45] sm:text-[15px]">
                        <span className="sm:hidden">Coba tanyakan:</span>
                        <span className="hidden sm:inline">Coba:</span>
                    </span>
                    <div className="transi-chips -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 sm:pb-0">
                        {SAMPLE_QUESTIONS.map(({ icon: Icon, text }) => (
                            <button
                                key={text}
                                type="button"
                                onClick={() => goToChat({ question: text, source: formRef.current })}
                                className="transi-lift flex shrink-0 items-center gap-2 rounded-full border border-[#e3d9cf] bg-white px-3.5 py-2.5 text-sm text-[#2a3a48] hover:border-[var(--t-gold)] hover:shadow-[0_8px_18px_rgba(59,42,18,0.08)]"
                            >
                                <Icon className="h-[15px] w-[15px] text-[var(--t-navy)]" aria-hidden="true" />
                                {text}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ---------------------------------------------------------------- journey */

function Eyebrow({ children, tone = 'teal', className }: { children: ReactNode; tone?: 'teal' | 'gold' | 'bronze'; className?: string }) {
    return (
        <p
            className={cn(
                'text-xs font-semibold tracking-[0.12em] uppercase sm:text-[13px]',
                tone === 'teal' && 'text-[#0d6b8a]',
                tone === 'gold' && 'text-[var(--t-gold)]',
                tone === 'bronze' && 'text-[#9a7330]',
                className,
            )}
        >
            {children}
        </p>
    );
}

function Journey() {
    return (
        <section className="bg-white py-14 sm:py-24">
            <div className="mx-auto grid max-w-[1312px] gap-10 px-4 sm:px-6 lg:grid-cols-[440px_minmax(0,1fr)] lg:gap-[72px] lg:px-16">
                <div className="flex flex-col gap-5">
                    <div data-reveal>
                        <Eyebrow>Satu percakapan</Eyebrow>
                    </div>
                    <h2
                        data-reveal
                        style={delay(0.08)}
                        className="font-heading text-[30px] leading-[1.15] font-bold tracking-[-0.015em] text-balance text-[var(--t-deep)] sm:text-[40px]"
                    >
                        Dari bertanya sampai tuntas, Anda tidak perlu pindah tempat.
                    </h2>
                    <p data-reveal style={delay(0.16)} className="text-base leading-[1.6] text-[#4a5a68] sm:text-[17px]">
                        TRANSI menjawab lebih dulu. Bila urusan Anda butuh tindakan, petugas masuk ke percakapan yang sama, menerbitkan tiket, merujuk
                        ke portal yang tepat, bahkan membuatkan akun Anda.
                    </p>
                    <img
                        data-reveal="left"
                        style={delay(0.2)}
                        src={`${IMG}/01-menunjuk-kanan.webp`}
                        alt=""
                        width={560}
                        height={560}
                        loading="lazy"
                        decoding="async"
                        className="hidden h-[340px] w-[340px] object-contain lg:block"
                    />
                </div>

                <ol className="flex flex-col">
                    {STEPS.map((s, i) => {
                        const last = i === STEPS.length - 1;
                        return (
                            <li key={s.title} data-reveal style={delay(0.06 * i)} className="flex gap-4 sm:gap-6">
                                <div className="flex w-12 shrink-0 flex-col items-center sm:w-14">
                                    <span
                                        className={cn(
                                            'flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-[var(--t-navy)] sm:h-14 sm:w-14',
                                            i === 0 ? 'bg-[var(--t-navy)] text-white' : 'bg-white text-[var(--t-navy)]',
                                        )}
                                    >
                                        <s.icon className="h-[22px] w-[22px] sm:h-6 sm:w-6" aria-hidden="true" />
                                    </span>
                                    {!last && <span className="transi-rail-line w-0.5 flex-1 bg-[#d5dee6]" aria-hidden="true" />}
                                </div>
                                <div className={cn('flex min-w-0 flex-1 flex-col gap-2.5 pt-1.5', !last && 'pb-10')}>
                                    <span className="text-xs font-semibold tracking-[0.1em] text-[#9a7330]">LANGKAH {i + 1}</span>
                                    <h3 className="font-heading text-xl leading-[1.25] font-bold text-[var(--t-deep)] sm:text-[22px]">{s.title}</h3>
                                    <p className="text-[15px] leading-[1.6] text-[#4a5a68] sm:text-base">{s.desc}</p>
                                    <span
                                        className={cn(
                                            'flex w-fit items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-semibold',
                                            s.strong ? 'bg-[var(--t-navy)] text-white' : 'bg-[#f2f5f8] text-[var(--t-navy)]',
                                            s.mono && 'font-mono',
                                        )}
                                    >
                                        <s.pillIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                        {s.pill}
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ trust */

function Trust() {
    return (
        <section
            className="relative overflow-hidden py-14 text-white sm:py-24"
            style={{ background: 'radial-gradient(60% 90% at 85% 50%, rgba(11,90,140,0.6) 0%, rgba(2,43,74,0) 70%), var(--t-deep)' }}
        >
            <div className="mx-auto grid max-w-[1312px] items-center gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-14 lg:px-16">
                <div className="order-2 flex flex-col gap-8 lg:order-1 lg:gap-10">
                    <div className="flex max-w-[620px] flex-col gap-4">
                        <div data-reveal>
                            <Eyebrow tone="gold">Cepat, tapi tetap bertanggung jawab</Eyebrow>
                        </div>
                        <h2
                            data-reveal
                            style={delay(0.08)}
                            className="font-heading text-[30px] leading-[1.15] font-bold tracking-[-0.015em] text-balance sm:text-[40px]"
                        >
                            TRANSI menjawab cepat. Petugas memastikan tuntas.
                        </h2>
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-8">
                        {TRUST.map((t, i) => (
                            <div
                                key={t.title}
                                data-reveal
                                style={delay(0.1 + i * 0.08)}
                                className="flex flex-col gap-3 border-t border-white/15 pt-5"
                            >
                                <t.icon className="h-[26px] w-[26px] text-[var(--t-gold)]" aria-hidden="true" />
                                <h3 className="font-heading text-lg leading-[1.3] font-semibold sm:text-xl">{t.title}</h3>
                                <p className="text-[15px] leading-[1.6] text-[#b8c8d6] sm:text-base">{t.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div data-reveal="zoom" className="order-1 flex items-end gap-2 lg:order-2 lg:flex-col lg:items-center lg:gap-0">
                    <p className="order-2 mb-16 max-w-[220px] rounded-[18px] rounded-bl-[4px] bg-white px-4 py-3 text-sm leading-[1.45] font-medium text-[var(--t-deep)] sm:text-base lg:order-1 lg:mb-0 lg:max-w-[300px] lg:rounded-bl-[18px]">
                        Kalau saya belum tahu jawabannya, saya panggilkan petugas, ya!
                    </p>
                    <img
                        src={`${IMG}/03-jempol-sukses.webp`}
                        alt="TRANSI mengacungkan jempol"
                        width={560}
                        height={560}
                        loading="lazy"
                        decoding="async"
                        className="transi-float order-1 h-[150px] w-[150px] object-contain sm:h-[200px] sm:w-[200px] lg:order-2 lg:h-[400px] lg:w-[400px]"
                    />
                </div>
            </div>
        </section>
    );
}

/* --------------------------------------------------------- track & paths */

function TrackAndPaths() {
    const [ticket, setTicket] = useState('');
    const submit = (e: FormEvent) => {
        e.preventDefault();
        const t = ticket.trim().toUpperCase();
        router.get('/lacak', t ? { ticket: t } : {});
    };

    return (
        <section className="bg-white py-12 sm:py-24">
            <div className="mx-auto flex max-w-[1312px] flex-col gap-10 px-4 sm:gap-14 sm:px-6 lg:px-16">
                <div className="grid gap-10 lg:grid-cols-[640px_minmax(0,1fr)]">
                    <form data-reveal onSubmit={submit} className="flex flex-col gap-[18px] rounded-[20px] bg-[var(--t-cream)] p-6 sm:p-9">
                        <Eyebrow tone="bronze">Sudah punya nomor tiket?</Eyebrow>
                        <h2 className="font-heading text-[26px] leading-[1.2] font-bold text-[var(--t-deep)] sm:text-[30px]">
                            Lacak perkembangan laporan Anda
                        </h2>
                        <div className="flex flex-col gap-3 sm:h-[60px] sm:flex-row sm:items-center sm:gap-3 sm:rounded-full sm:border sm:border-[#e3d9cf] sm:bg-white sm:pr-2 sm:pl-[18px]">
                            <label htmlFor="nomor-tiket" className="sr-only">
                                Nomor tiket
                            </label>
                            <div className="flex h-14 flex-1 items-center gap-3 rounded-full border border-[#e3d9cf] bg-white px-[18px] sm:h-auto sm:border-0 sm:bg-transparent sm:px-0">
                                <Ticket className="h-5 w-5 shrink-0 text-[#8a96a3]" aria-hidden="true" />
                                <input
                                    id="nomor-tiket"
                                    value={ticket}
                                    onChange={(e) => setTicket(e.target.value)}
                                    placeholder="TKT-261012-7KQ4MZ"
                                    autoComplete="off"
                                    className="w-full min-w-0 bg-transparent font-mono text-base text-[#1f2d3a] uppercase outline-none placeholder:text-[#8a96a3] placeholder:normal-case sm:text-[17px]"
                                />
                            </div>
                            <button
                                type="submit"
                                className="transi-lift font-heading flex h-12 items-center justify-center rounded-full bg-[var(--t-navy)] px-[22px] text-base font-bold text-white hover:bg-[#00508a] sm:h-[46px]"
                            >
                                Lacak
                            </button>
                        </div>
                        <p className="text-[15px] leading-[1.55] text-[#6b5a45]">
                            Lupa nomornya? Tanyakan saja ke TRANSI. Bila Anda masuk dengan akun, semua tiket tampil di Portal Warga.
                        </p>
                    </form>

                    <div className="flex flex-col gap-1.5">
                        <div data-reveal>
                            <Eyebrow>Lebih suka jalur lain?</Eyebrow>
                        </div>
                        {OTHER_PATHS.map((p, i) => (
                            <Link
                                key={p.title}
                                href={p.href}
                                data-reveal
                                style={delay(0.06 * (i + 1))}
                                className="group flex items-center gap-4 border-b border-[#e8edf2] px-1 py-4"
                            >
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef3f7] transition-colors group-hover:bg-[var(--t-navy)]">
                                    <p.icon className="h-5 w-5 text-[var(--t-navy)] transition-colors group-hover:text-white" aria-hidden="true" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="font-heading block text-[17px] font-semibold text-[var(--t-deep)]">{p.title}</span>
                                    <span className="block text-sm text-[#5b6b7a]">{p.desc}</span>
                                </span>
                                <ArrowRight
                                    className="h-[18px] w-[18px] shrink-0 text-[#8a96a3] transition-transform duration-300 group-hover:translate-x-1 group-hover:text-[var(--t-navy)]"
                                    aria-hidden="true"
                                />
                            </Link>
                        ))}
                    </div>
                </div>

                <div
                    data-reveal
                    className="flex flex-col gap-5 rounded-[20px] border border-[#e8edf2] p-6 sm:p-8 lg:flex-row lg:items-center lg:gap-6"
                >
                    <div className="flex items-center gap-3">
                        <span className="font-heading text-5xl leading-none font-bold text-[var(--t-gold)]">5</span>
                        <span className="text-[15px] leading-[1.3] font-semibold text-[var(--t-deep)]">
                            kanal pengaduan
                            <br />
                            resmi lainnya
                        </span>
                    </div>
                    <span className="hidden h-12 w-px bg-[#e8edf2] lg:block" aria-hidden="true" />
                    <ul className="flex flex-1 flex-wrap gap-2.5 lg:justify-between">
                        {CHANNELS.map((c) => (
                            <li key={c.label}>
                                <a
                                    href={c.href}
                                    {...(c.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                                    className="transi-lift flex items-center gap-2 rounded-[10px] bg-[#f6f8fa] px-3.5 py-2.5 text-sm font-medium text-[#2a3a48] hover:bg-[#eef3f7] hover:text-[var(--t-navy)]"
                                >
                                    <c.icon className="h-4 w-4 text-[var(--t-navy)]" aria-hidden="true" />
                                    {c.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------------- faq */

function Faq() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const askButton = (className: string) => (
        <button
            type="button"
            onClick={(e) => goToChat({ source: e.currentTarget })}
            className={cn(
                'transi-lift font-heading flex h-[52px] items-center justify-center gap-2.5 rounded-full bg-[var(--t-gold)] px-[22px] text-base font-bold text-[var(--t-deep)] hover:bg-[#d0a552]',
                className,
            )}
        >
            <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" /> Tanya TRANSI
        </button>
    );

    return (
        <section className="bg-[var(--t-cream)] py-14 sm:py-24">
            <div className="mx-auto grid max-w-[1312px] gap-8 px-4 sm:px-6 lg:grid-cols-[420px_minmax(0,1fr)] lg:gap-16 lg:px-16">
                <div className="flex flex-col gap-[18px]">
                    <img
                        data-reveal="zoom"
                        src={`${IMG}/06-berpikir.webp`}
                        alt=""
                        width={400}
                        height={400}
                        loading="lazy"
                        decoding="async"
                        className="hidden h-60 w-60 object-contain lg:block"
                    />
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col gap-3">
                            <div data-reveal>
                                <Eyebrow tone="bronze">Pertanyaan umum</Eyebrow>
                            </div>
                            <h2
                                data-reveal
                                style={delay(0.08)}
                                className="font-heading text-[30px] leading-[1.15] font-bold tracking-[-0.015em] text-balance text-[var(--t-deep)] sm:text-4xl"
                            >
                                Yang sering ditanyakan warga
                            </h2>
                        </div>
                        <img
                            data-reveal="zoom"
                            src={`${IMG}/06-berpikir.webp`}
                            alt=""
                            width={400}
                            height={400}
                            loading="lazy"
                            decoding="async"
                            className="h-24 w-24 shrink-0 object-contain lg:hidden"
                        />
                    </div>
                    <p data-reveal style={delay(0.12)} className="text-base leading-[1.6] text-[#5b4a36]">
                        Tidak menemukan jawabannya? TRANSI siap menjawab pertanyaan lain, dan memanggil petugas bila perlu.
                    </p>
                    <div data-reveal style={delay(0.16)} className="hidden lg:block">
                        {askButton('w-fit')}
                    </div>
                </div>

                <div className="flex flex-col gap-3 lg:pt-6">
                    {FAQS.map((f, i) => {
                        const open = openIndex === i;
                        return (
                            <div
                                key={f.q}
                                data-reveal
                                style={delay(0.05 * i)}
                                className={cn(
                                    'rounded-[14px] border bg-white transition-[border-color,box-shadow] duration-300',
                                    open ? 'border-[#c29642]/60 shadow-[0_10px_24px_rgba(59,42,18,0.06)]' : 'border-[#ece3d9] hover:border-[#dccfbf]',
                                )}
                            >
                                <h3>
                                    <button
                                        type="button"
                                        id={`faq-tombol-${i}`}
                                        aria-expanded={open}
                                        aria-controls={`faq-isi-${i}`}
                                        onClick={() => setOpenIndex(open ? null : i)}
                                        className="font-heading flex w-full items-center gap-4 px-5 py-[18px] text-left text-base leading-[1.3] font-semibold text-[var(--t-deep)] sm:px-6 sm:py-5 sm:text-lg"
                                    >
                                        <span className="flex-1">{f.q}</span>
                                        <span
                                            className={cn(
                                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-[transform,background-color] duration-300',
                                                open ? 'rotate-180 bg-[#f7efe2] text-[var(--t-gold)]' : 'text-[var(--t-navy)]',
                                            )}
                                            aria-hidden="true"
                                        >
                                            {open ? <Minus className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                                        </span>
                                    </button>
                                </h3>
                                <div
                                    id={`faq-isi-${i}`}
                                    role="region"
                                    aria-labelledby={`faq-tombol-${i}`}
                                    className="transi-accordion"
                                    data-open={open}
                                >
                                    <div>
                                        <p className="px-5 pb-5 text-[15px] leading-[1.6] text-[#4a5a68] sm:px-6 sm:text-base">{f.a}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div data-reveal className="flex items-center gap-3.5 px-1 pt-4">
                        <FileText className="h-5 w-5 shrink-0 text-[var(--t-navy)]" aria-hidden="true" />
                        <span className="flex-1 text-[15px] text-[#4a5a68]">Maklumat Pelayanan dan Penilaian SIGAP</span>
                        <Link
                            href="/pedoman-layanan"
                            className="text-[15px] font-semibold text-[var(--t-navy)] underline underline-offset-4 hover:text-[#00508a]"
                        >
                            Baca
                        </Link>
                    </div>
                    <div className="pt-4 lg:hidden">{askButton('w-full')}</div>
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------ closing cta */

function ClosingCta() {
    return (
        <section className="bg-white px-4 py-12 sm:px-6 sm:py-[72px] lg:px-16">
            <div
                data-reveal="zoom"
                className="relative mx-auto flex max-w-[1312px] flex-col items-center gap-6 overflow-hidden rounded-[24px] px-6 pt-8 pb-8 text-center text-white sm:rounded-[28px] lg:h-[300px] lg:flex-row lg:gap-8 lg:py-0 lg:pr-16 lg:pl-6 lg:text-left"
                style={{ background: 'radial-gradient(60% 140% at 20% 60%, rgba(194,150,66,0.25) 0%, rgba(0,61,104,0) 70%), var(--t-navy)' }}
            >
                <img
                    src={`${IMG}/00-menyapa.webp`}
                    alt="TRANSI melambaikan tangan"
                    width={520}
                    height={520}
                    loading="lazy"
                    decoding="async"
                    className="transi-float h-44 w-44 shrink-0 object-contain sm:h-56 sm:w-56 lg:h-[300px] lg:w-[300px]"
                />
                <div className="flex flex-1 flex-col gap-3.5">
                    <h2 className="font-heading text-[26px] leading-[1.15] font-bold tracking-[-0.015em] text-balance sm:text-[38px]">
                        Halo, saya TRANSI. Ada yang bisa saya bantu hari ini?
                    </h2>
                    <p className="text-[15px] leading-[1.6] text-[#c9d6e2] sm:text-[17px]">
                        Petugas siap Senin–Jumat, 08.00–16.00 WIB. Di luar jam itu, pesan Anda tetap dicatat dan petugas menghubungi Anda pada hari
                        kerja berikutnya.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={(e) => goToChat({ source: e.currentTarget })}
                    className="transi-lift font-heading flex h-14 w-full shrink-0 items-center justify-center gap-2.5 rounded-full bg-[var(--t-gold)] px-7 text-[17px] font-bold text-[var(--t-deep)] shadow-[0_10px_28px_rgba(0,0,0,0.25)] hover:bg-[#d0a552] sm:w-auto lg:h-[60px]"
                >
                    <MessageCircle className="h-5 w-5" aria-hidden="true" /> Mulai chat sekarang
                </button>
            </div>
        </section>
    );
}

/* ----------------------------------------------------------------- footer */

function SiteFooter() {
    const cols: [string, [string, string][]][] = [
        [
            'Layanan',
            [
                ['Lacak Tiket', '/lacak'],
                ['Katalog Pengaduan', '/katalog'],
                ['Portal Warga', '/portal-warga'],
            ],
        ],
        [
            'Informasi',
            [
                ['Panduan Layanan', '/panduan'],
                ['Pedoman Layanan', '/pedoman-layanan'],
                ['Syarat dan Ketentuan', '/syarat-ketentuan'],
                ['Kebijakan Privasi', '/kebijakan-privasi'],
                ['Tentang Kami', '/tentang-kami'],
            ],
        ],
    ];

    return (
        <footer className="bg-[#011e33] text-[#9fb2c3]">
            <div className="mx-auto flex max-w-[1312px] flex-col gap-10 px-4 pt-12 pb-8 sm:px-6 lg:px-16 lg:pt-16">
                <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
                    <div className="flex flex-col gap-3 lg:w-[420px]">
                        <span className="font-heading text-[22px] font-bold text-white">SIGAP</span>
                        <p className="text-[15px] leading-[1.55]">Suara Masyarakat, Inisiatif Gerak Aksi, Penyelesaian Tuntas.</p>
                        <p className="text-sm text-[var(--t-gold)] italic">“Komitmen Melayani, Menuntaskan Tanpa Henti”</p>
                    </div>
                    <div className="grid flex-1 grid-cols-2 gap-6 lg:gap-16">
                        {cols.map(([title, links]) => (
                            <div key={title} className="flex flex-col gap-3">
                                <span className="text-[13px] font-semibold tracking-[0.1em] text-[#d6e0ea] uppercase">
                                    {title === 'Informasi' ? (
                                        <>
                                            Informasi<span className="hidden lg:inline"> &amp; Kebijakan</span>
                                        </>
                                    ) : (
                                        title
                                    )}
                                </span>
                                {title === 'Layanan' && (
                                    <button
                                        type="button"
                                        onClick={(e) => goToChat({ source: e.currentTarget })}
                                        className="w-fit text-left text-[15px] transition-colors hover:text-white"
                                    >
                                        Chat TRANSI
                                    </button>
                                )}
                                {links.map(([label, href]) => (
                                    <Link key={href} href={href} className="w-fit text-[15px] transition-colors hover:text-white">
                                        {label}
                                    </Link>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col gap-2 border-t border-white/10 pt-6 text-[13px] text-[#6f8496] sm:flex-row sm:items-center sm:justify-between">
                    <span>© 2026 Kementerian Transmigrasi Republik Indonesia. Seluruh hak cipta dilindungi.</span>
                    <span className="flex items-center gap-4">
                        <Link href="/" className="transition-colors hover:text-white">
                            Kembali ke tampilan lama
                        </Link>
                        <span aria-hidden="true">·</span>
                        <span>Maskot TRANSI</span>
                    </span>
                </div>
            </div>
        </footer>
    );
}
