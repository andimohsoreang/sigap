import { Deferred, Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    ArrowUp,
    ArrowUpRight,
    BellRing,
    BookCheck,
    BookOpen,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    FileText,
    Hash,
    Headset,
    KeyRound,
    MapPinned,
    MessageCircle,
    Minus,
    Plus,
    Search,
    ShieldCheck,
    Ticket,
    TicketCheck,
    Timer,
    UserPlus,
    UserRoundCheck,
    type LucideIcon,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';

import KanalResmi, { type KanalPublik } from '@/components/sigap/kanal-resmi';
import { type Kantor } from '@/components/sigap/kantor-direktori';
import { TaraFooter, TaraLauncher } from '@/components/sigap/tara-shell';
import TransiHeader from '@/components/sigap/transi-header';
import { goToChat } from '@/lib/chat-transition';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';

/**
 * Beranda utama (/) — contact center yang semuanya dimulai dari
 * chat, dengan maskot TARA. Desain: pen.dev "Publik / Beranda — Contact
 * Center TARA" (desktop) dan varian Mobile 320–430.
 *
 * Semua tombol chat membawa ke halaman /chat (lib/chat-transition): kotak
 * tanya atau kartu hero membesar menjadi panel percakapan.
 */

const IMG = '/images/tara';

const SAMPLE_QUESTIONS: { icon: LucideIcon; text: string }[] = [
    { icon: MapPinned, text: 'Sertifikat lahan saya belum keluar' },
    { icon: Ticket, text: 'Cek tiket TKT-261012-7KQ4MZ' },
    { icon: ClipboardList, text: 'Cara daftar transmigrasi' },
    { icon: KeyRound, text: 'Saya lupa kata sandi' },
];

const STEPS: { icon: LucideIcon; title: string; desc: string; pillIcon: LucideIcon; pill: string; mono?: boolean; strong?: boolean }[] = [
    {
        icon: MessageCircle,
        title: 'Tanya TARA, kapan saja',
        desc: 'Asisten menjawab 24 jam hanya dari artikel resmi Kementerian, lengkap dengan sumbernya. Data pribadi yang Anda ketik otomatis disamarkan.',
        pillIcon: BookOpen,
        pill: 'Sumber: Panduan Layanan Contact Center',
    },
    {
        icon: Headset,
        title: 'Diteruskan ke petugas bila perlu',
        desc: 'Untuk aduan atau hak pribadi, TARA meneruskan ke petugas dengan ringkasan, jadi Anda tidak perlu mengulang cerita. Di luar jam kerja, tinggalkan nomor WhatsApp.',
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
        desc: 'TARA hanya menjawab dari Basis Pengetahuan resmi. Bila tidak tahu, ia memanggil petugas.',
    },
    { icon: ShieldCheck, title: 'Data pribadi disamarkan', desc: 'NIK dan nomor HP yang Anda ketik disamarkan sebelum diproses asisten.' },
    { icon: Timer, title: 'Dipantau sampai selesai', desc: 'Setiap tiket punya target waktu selesai, diakhiri survei kepuasan dari Anda.' },
    { icon: BellRing, title: 'Kabar langsung ke Anda', desc: 'Nomor tiket, perubahan status, dan tanggapan petugas dikirim ke chat dan email.' },
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
        q: 'Bagaimana kalau TARA tidak tahu jawabannya?',
        a: 'TARA hanya menjawab dari artikel resmi. Bila jawabannya tidak ada, pertanyaan Anda diteruskan ke petugas beserta ringkasannya. Di luar jam layanan, Anda bisa meninggalkan nomor WhatsApp untuk dihubungi.',
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

/* ------------------------------------------------------------------- page */

type BeritaResmi = { judul: string; ringkasan: string; lokasi: string | null; tanggal: string; gambar: string | null; url: string };

export default function BerandaTransi({ kanal, kantor, beritaSemua }: { kanal: KanalPublik; kantor: Kantor[]; beritaSemua: string }) {
    const { auth, assistant } = usePage<SharedData>().props;
    const aiEnabled = Boolean(assistant?.enabled);
    const pageRef = useRef<HTMLDivElement>(null);
    useReveal(pageRef);

    return (
        <>
            <Head title="Contact Center Kementerian Transmigrasi">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    rel="stylesheet"
                    href="https://fonts.bunny.net/css?family=space-grotesk:500,600,700|jost:400,500,600|jetbrains-mono:500,600"
                    head-key="transi-fonts"
                />
                <meta
                    name="description"
                    content="Contact Center Kementerian Transmigrasi. Tanya, lapor, cek status tiket, sampai dibuatkan akun, cukup mulai dari chat dengan TARA."
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
                    <Berita all={beritaSemua} />
                    <KanalResmi kanal={kanal} kantor={kantor} />
                    <Faq />
                </main>
                <TaraFooter />
                <TaraLauncher />
            </div>
        </>
    );
}

/* ------------------------------------------------------------------- hero */

function Hero({ aiEnabled }: { aiEnabled: boolean }) {
    return (
        <section className="relative overflow-hidden bg-[var(--t-deep)] text-white">
            <HeroMakarti />
            <div className="relative mx-auto max-w-[1312px] px-4 pt-8 pb-6 sm:px-6 sm:pt-12 lg:px-16 xl:flex xl:min-h-[822px] xl:items-center xl:py-24">
                <div className="flex max-w-[600px] flex-col gap-6 pb-2 lg:gap-7">
                    <span
                        className="transi-rise inline-flex min-h-[34px] w-fit items-center gap-2 rounded-full border border-white/[0.18] bg-white/[0.06] px-3.5 py-1.5 text-[13px] text-white sm:text-sm"
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
                        className="transi-rise font-heading max-w-[580px] text-[40px] leading-[1.06] font-bold tracking-[-0.02em] text-balance sm:text-5xl lg:text-[58px] lg:leading-[1.1] lg:tracking-[-1.74px]"
                        style={delay(0.15)}
                    >
                        Semua urusan transmigrasi, cukup mulai dari chat.
                    </h1>
                    <p className="transi-rise max-w-[540px] text-[17px] leading-[1.58] text-[#b8c8d6] sm:text-[19px]" style={delay(0.28)}>
                        Tanya, lapor, cek status tiket, sampai dibuatkan akun. TARA dan petugas kami membantu dalam satu percakapan: tanpa formulir
                        panjang, tanpa harus punya email.
                    </p>
                    <div className="transi-rise flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3.5" style={delay(0.4)}>
                        <button
                            type="button"
                            onClick={(e) => goToChat({ source: e.currentTarget })}
                            className="transi-lift font-heading flex h-14 items-center justify-center gap-2.5 rounded-full bg-[var(--t-gold)] px-[26px] text-[17px] font-bold text-[var(--t-deep)] shadow-[0_10px_30px_rgba(194,150,66,0.35)] hover:bg-[#d0a552] hover:shadow-[0_14px_34px_rgba(194,150,66,0.45)]"
                        >
                            <MessageCircle className="h-5 w-5" aria-hidden="true" /> Mulai chat dengan TARA
                        </button>
                        <Link
                            href="/lacak"
                            className="transi-lift flex h-14 items-center justify-center gap-2.5 rounded-full border border-white/30 px-6 text-[17px] font-semibold text-white hover:border-white/60 hover:bg-white/[0.06]"
                        >
                            <Search className="h-5 w-5" aria-hidden="true" /> Lacak tiket
                        </Link>
                    </div>
                    <ul className="transi-rise flex flex-col gap-2.5 pt-1 text-[15px] text-[#b8c8d6]" style={delay(0.52)}>
                        {[
                            [BookCheck, 'Jawaban dari sumber resmi'],
                            [UserRoundCheck, 'Petugas Sen–Jum 08.00–16.00 WIB'],
                            [ShieldCheck, 'Data pribadi dilindungi'],
                        ].map(([Icon, text]) => {
                            const I = Icon as LucideIcon;
                            return (
                                <li key={text as string} className="flex items-center gap-2">
                                    <I className="h-[17px] w-[17px] text-[var(--t-gold)]" aria-hidden="true" />
                                    {text as string}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
            <HeroMakarti mobile />
        </section>
    );
}

/**
 * Gedung Grand Makarti Kementerian Transmigrasi dengan TARA menyambut di
 * depannya (ukuran & posisi dari desain Wonder "SIGAP Beranda Hero Makarti").
 * Desktop (>=1280 px): latar penuh yang memudar ke navy di bawah teks. Layar
 * lebih kecil: gambar di bawah teks.
 */
function HeroMakarti({ mobile = false }: { mobile?: boolean }) {
    const gedung = (
        <img
            src="/images/brand/gedung-grand-makarti.webp"
            alt="Gedung Grand Makarti Kementerian Transmigrasi"
            width={1434}
            height={736}
            fetchPriority={mobile ? 'auto' : 'high'}
            loading={mobile ? 'lazy' : 'eager'}
            className={cn(
                'absolute max-w-none object-cover',
                // Desktop: gedung dikunci ke tepi kanan layar (selebar tinggi hero x rasio
                // gambar, minimal selebar layar) agar papan nama "GRAND MAKARTI" selalu
                // berada di kiri TARA, tidak tertutup tubuhnya. Layar sangat lebar memotong
                // atas-bawah: fokus 80% ke bawah agar papan nama tetap terlihat.
                mobile ? 'inset-0 h-full w-full object-center' : 'inset-y-0 right-0 h-full w-auto min-w-full object-[right_80%]',
            )}
        />
    );
    const tara = (
        <img
            src={`${IMG}/menyambut-hd.webp`}
            srcSet={`${IMG}/menyambut-md.webp 792w, ${IMG}/menyambut-hd.webp 1584w`}
            sizes={mobile ? '260px' : '423px'}
            alt=""
            aria-hidden="true"
            width={1584}
            height={3600}
            className={cn(
                'absolute max-w-none drop-shadow-[0_18px_30px_rgba(0,10,25,0.35)]',
                // Dari kepala sampai paha, di sisi kanan layar sejajar tepi kanan gedung;
                // tangan menyambut ke arah papan nama. Versi HD 1584x3600.
                mobile ? 'top-[8%] right-[2%] h-[150%] w-auto' : 'top-[120px] right-[2%] h-[960px] w-auto',
            )}
        />
    );

    return mobile ? (
        <div className="relative h-[320px] overflow-hidden sm:h-[440px] xl:hidden">
            {gedung}
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[var(--t-deep)] to-transparent" />
            {tara}
        </div>
    ) : (
        <div className="absolute inset-0 hidden overflow-hidden xl:block">
            {gedung}
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[rgba(2,43,74,0.35)] to-transparent" />
            <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                    background:
                        'linear-gradient(90deg, rgba(2,43,74,0.97) 0%, rgba(2,43,74,0.93) 34%, rgba(2,43,74,0.55) 46%, rgba(2,43,74,0.12) 60%, rgba(2,43,74,0) 74%)',
                }}
            />
            {tara}
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
                        aria-label="Tanya TARA"
                        className="transi-lift font-heading flex h-12 w-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--t-gold)] text-base font-bold text-[var(--t-deep)] hover:bg-[#d0a552] sm:h-[52px] sm:w-auto sm:px-[22px]"
                    >
                        <span className="hidden sm:inline">Tanya TARA</span>
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
                        TARA menjawab lebih dulu. Bila urusan Anda butuh tindakan, petugas masuk ke percakapan yang sama, menerbitkan tiket, merujuk
                        ke portal yang tepat, bahkan membuatkan akun Anda.
                    </p>
                    <img
                        data-reveal="left"
                        style={delay(0.2)}
                        src={`${IMG}/menunjuk.webp`}
                        alt=""
                        width={458}
                        height={900}
                        loading="lazy"
                        decoding="async"
                        className="hidden h-[420px] w-[300px] object-contain lg:block"
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
                            TARA menjawab cepat. Petugas memastikan tuntas.
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
                        src={`${IMG}/jempol.webp`}
                        alt="TARA mengacungkan jempol"
                        width={267}
                        height={900}
                        loading="lazy"
                        decoding="async"
                        className="transi-float order-1 h-[200px] w-[120px] object-contain sm:h-[260px] sm:w-[160px] lg:order-2 lg:h-[460px] lg:w-[300px]"
                    />
                </div>
            </div>
        </section>
    );
}

/* --------------------------------------------------------- track & paths */

/* ----------------------------------------------------------------- berita */

const tanggalBerita = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Berita resmi terbaru dari transmigrasi.go.id (dimuat tertunda). Kartu
 * bergulir mendatar; tombol panah menggeser satu kartu. Bila situs resmi
 * tidak dapat diakses dan belum ada salinan, bagian ini tidak tampil.
 */
function Berita({ all }: { all: string }) {
    return (
        <Deferred data="berita" fallback={<BeritaSection all={all} items={null} />}>
            <BeritaFromProps all={all} />
        </Deferred>
    );
}

function BeritaFromProps({ all }: { all: string }) {
    const { berita } = usePage<{ berita?: BeritaResmi[] }>().props;
    if (!berita || berita.length === 0) return null;
    return <BeritaSection all={all} items={berita} />;
}

function BeritaSection({ all, items }: { all: string; items: BeritaResmi[] | null }) {
    const track = useRef<HTMLUListElement>(null);
    const [edge, setEdge] = useState({ start: true, end: false });

    const update = () => {
        const el = track.current;
        if (!el) return;
        setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
    };
    useEffect(update, [items]);

    const geser = (dir: 1 | -1) => {
        const el = track.current;
        const card = el?.querySelector('li');
        if (el && card) el.scrollBy({ left: dir * (card.getBoundingClientRect().width + 24), behavior: 'smooth' });
    };

    return (
        <section aria-labelledby="berita-transmigrasi" className="overflow-x-clip bg-white py-14 sm:py-24">
            <div className="mx-auto flex max-w-[1312px] flex-col gap-8 px-4 sm:px-6 lg:px-16">
                <div className="flex items-end justify-between gap-8">
                    <div className="flex flex-col gap-3">
                        <Eyebrow tone="bronze">Berita</Eyebrow>
                        <h2
                            id="berita-transmigrasi"
                            className="font-heading text-[30px] leading-[1.2] font-bold tracking-[-0.015em] text-[var(--t-deep)] sm:text-[40px]"
                        >
                            Berita Transmigrasi
                        </h2>
                        <p className="max-w-[660px] text-base leading-[1.65] text-[#4a5a68] sm:text-[17px]">
                            Kabar resmi dari Kementerian Transmigrasi.
                        </p>
                    </div>
                    {items && (
                        <div className="hidden shrink-0 items-center gap-3 sm:flex">
                            <button
                                type="button"
                                onClick={() => geser(-1)}
                                disabled={edge.start}
                                aria-label="Berita sebelumnya"
                                className="flex h-12 w-12 items-center justify-center rounded-full border border-[#e8edf2] text-[#5b6b7a] transition-colors hover:border-[var(--t-navy)] hover:text-[var(--t-navy)] disabled:cursor-default disabled:opacity-40 disabled:hover:border-[#e8edf2] disabled:hover:text-[#5b6b7a]"
                            >
                                <ChevronLeft className="h-[22px] w-[22px]" aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                onClick={() => geser(1)}
                                disabled={edge.end}
                                aria-label="Berita berikutnya"
                                className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--t-navy)] text-white transition-colors hover:bg-[var(--t-deep)] disabled:cursor-default disabled:opacity-40"
                            >
                                <ChevronRight className="h-[22px] w-[22px]" aria-hidden="true" />
                            </button>
                        </div>
                    )}
                </div>

                <ul
                    ref={track}
                    onScroll={update}
                    aria-busy={items === null}
                    className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-6 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mr-[calc(50%-50vw)] lg:-ml-16 lg:scroll-px-16 lg:pr-16 lg:pl-16 [&::-webkit-scrollbar]:hidden"
                >
                    {items === null
                        ? [0, 1, 2, 3].map((i) => (
                              <li
                                  key={i}
                                  className="w-[300px] shrink-0 overflow-hidden rounded-[20px] border border-[#e8edf2] sm:w-[340px]"
                                  aria-hidden="true"
                              >
                                  <div className="h-[196px] animate-pulse bg-[#eef2f6]" />
                                  <div className="flex flex-col gap-3 p-6">
                                      <div className="h-5 w-4/5 animate-pulse rounded bg-[#eef2f6]" />
                                      <div className="h-4 w-full animate-pulse rounded bg-[#f2f5f8]" />
                                      <div className="h-4 w-2/3 animate-pulse rounded bg-[#f2f5f8]" />
                                  </div>
                              </li>
                          ))
                        : items.map((b) => (
                              <li key={b.url} className="w-[300px] shrink-0 snap-start sm:w-[340px]">
                                  <a
                                      href={b.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="group relative flex h-full flex-col overflow-hidden rounded-[20px] border border-[#e8edf2] bg-white shadow-[0_8px_24px_rgba(2,43,74,0.06)] transition-shadow hover:shadow-[0_14px_32px_rgba(2,43,74,0.12)]"
                                  >
                                      <span className="block h-[196px] overflow-hidden bg-[#eef2f6]">
                                          {b.gambar && (
                                              <img
                                                  src={b.gambar}
                                                  alt=""
                                                  loading="lazy"
                                                  decoding="async"
                                                  referrerPolicy="no-referrer"
                                                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                                              />
                                          )}
                                      </span>
                                      <span className="flex flex-1 flex-col gap-3 p-6">
                                          <span className="font-heading line-clamp-2 min-h-[52px] text-[19px] leading-[1.37] font-bold tracking-[-0.19px] text-[var(--t-deep)]">
                                              {b.judul}
                                          </span>
                                          <span className="line-clamp-3 text-[15px] leading-[1.6] text-[#4a5a68]">{b.ringkasan}</span>
                                          <span className="mt-auto flex items-center justify-between border-t border-[#e8edf2] pt-3">
                                              <span className="flex items-center gap-1.5 text-[13.5px] text-[#5b6b7a]">
                                                  <CalendarDays className="h-[15px] w-[15px]" aria-hidden="true" />
                                                  {tanggalBerita(b.tanggal)}
                                                  {b.lokasi && ` · ${b.lokasi}`}
                                              </span>
                                              <ArrowUpRight className="h-[18px] w-[18px] text-[var(--t-navy)]" aria-hidden="true" />
                                              <span className="sr-only">(membuka berita di situs Kementerian, tab baru)</span>
                                          </span>
                                      </span>
                                  </a>
                              </li>
                          ))}
                </ul>

                {items && (
                    <a
                        href={all}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-11 w-fit items-center gap-2 text-[15px] font-semibold text-[var(--t-navy)] hover:underline"
                    >
                        Lihat semua berita <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
                    </a>
                )}
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
            <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" /> Tanya TARA
        </button>
    );

    return (
        <section className="bg-[var(--t-cream)] py-14 sm:py-24">
            <div className="mx-auto grid max-w-[1312px] gap-8 px-4 sm:px-6 lg:grid-cols-[420px_minmax(0,1fr)] lg:gap-16 lg:px-16">
                <div className="flex flex-col gap-[18px]">
                    <img
                        data-reveal="zoom"
                        src={`${IMG}/mendengarkan.webp`}
                        alt=""
                        width={253}
                        height={900}
                        loading="lazy"
                        decoding="async"
                        className="hidden h-80 w-48 object-contain lg:block"
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
                            src={`${IMG}/mendengarkan.webp`}
                            alt=""
                            width={253}
                            height={900}
                            loading="lazy"
                            decoding="async"
                            className="h-32 w-16 shrink-0 object-contain lg:hidden"
                        />
                    </div>
                    <p data-reveal style={delay(0.12)} className="text-base leading-[1.6] text-[#5b4a36]">
                        Tidak menemukan jawabannya? TARA siap menjawab pertanyaan lain, dan memanggil petugas bila perlu.
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
                        <span className="flex-1 text-[15px] text-[#4a5a68]">Maklumat Pelayanan dan Penilaian Contact Center</span>
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
