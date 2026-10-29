import { Head, Link, usePage } from '@inertiajs/react';
import { ChevronRight, MessageCircle } from 'lucide-react';
import { type ReactNode } from 'react';

import TransiHeader, { type TaraNav } from '@/components/sigap/transi-header';
import { goToChat } from '@/lib/chat-transition';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';

/**
 * Bingkai halaman publik bergaya TARA (desain pen.dev "Publik / … — TARA"):
 * header, pita krem berisi judul + pose TARA, footer navy, dan tombol TARA
 * melayang. Dipakai beranda, lacak, katalog, peta, dan panduan.
 */

export const TARA_IMG = '/images/tara';

export type TaraPose = 'menyapa' | 'mendengarkan' | 'menunjuk' | 'menjelaskan' | 'tablet' | 'jempol' | 'terima-kasih' | 'menyambut';

/** Rasio lebar:tinggi tiap pose (tinggi berkas 900 px). */
const POSE_WIDTH: Record<TaraPose, number> = {
    menyapa: 278,
    mendengarkan: 253,
    menunjuk: 458,
    menjelaskan: 255,
    tablet: 273,
    jempol: 267,
    'terima-kasih': 228,
    menyambut: 396,
};

export function TaraPoseImage({ pose, className, alt = '', eager = false }: { pose: TaraPose; className?: string; alt?: string; eager?: boolean }) {
    return (
        <img
            src={`${TARA_IMG}/${pose}.webp`}
            alt={alt}
            width={POSE_WIDTH[pose]}
            height={900}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            className={cn('object-contain', className)}
        />
    );
}

export function TaraAvatar({ className }: { className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={cn('block shrink-0 rounded-full border-2 border-[var(--t-gold)] bg-[var(--t-cream)] bg-cover bg-center', className)}
            style={{ backgroundImage: `url(${TARA_IMG}/avatar.webp)` }}
        />
    );
}

export function TaraEyebrow({ children, tone = 'teal', className }: { children: ReactNode; tone?: 'teal' | 'gold' | 'bronze'; className?: string }) {
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

/** Tombol TARA melayang: membuka halaman chat layar penuh. */
export function TaraLauncher() {
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
                aria-label="Chat dengan TARA"
                className="transi-launcher__face h-16 w-16 rounded-full border-[3px] border-[#c29642] bg-[#f8f3ef] bg-cover bg-center shadow-[0_12px_28px_rgba(0,18,36,0.35)] sm:h-[72px] sm:w-[72px]"
                style={{ backgroundImage: `url(${TARA_IMG}/avatar.webp)` }}
            />
        </div>
    );
}

export function TaraFooter() {
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
                                        Chat TARA
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
                        <span>Maskot TARA</span>
                    </span>
                </div>
            </div>
        </footer>
    );
}

/** Kartu ajakan "tanya TARA" (dipakai di akhir halaman katalog, lacak, dll.). */
export function AskTaraCard({ title, desc, label = 'Tanya TARA', dark = false }: { title: string; desc?: string; label?: string; dark?: boolean }) {
    return (
        <div
            className={cn(
                'flex flex-col gap-4 rounded-[20px] p-5 sm:flex-row sm:items-center sm:gap-5 sm:px-7',
                dark ? 'bg-[var(--t-deep)] text-white' : 'border border-[#ece6dc] bg-white',
            )}
        >
            <TaraAvatar className="h-14 w-14" />
            <div className="min-w-0 flex-1">
                <p className={cn('font-heading text-lg font-bold', dark ? 'text-white' : 'text-[var(--t-deep)]')}>{title}</p>
                {desc && <p className={cn('text-[15px]', dark ? 'text-[#bcd0e0]' : 'text-[#4a5868]')}>{desc}</p>}
            </div>
            <button
                type="button"
                onClick={(e) => goToChat({ source: e.currentTarget })}
                className="transi-lift flex h-12 w-fit items-center gap-2 rounded-full bg-[var(--t-gold)] px-6 font-semibold text-[var(--t-deep)] hover:bg-[#d0a552]"
            >
                <MessageCircle className="h-5 w-5" aria-hidden="true" /> {label}
            </button>
        </div>
    );
}

export default function TaraPage({
    title,
    description,
    active,
    eyebrow,
    heading,
    subtitle,
    pose,
    poseAlt = '',
    heroChildren,
    heroAside,
    breadcrumb,
    children,
}: {
    title: string;
    description?: string;
    active?: TaraNav;
    eyebrow: string;
    heading: ReactNode;
    subtitle?: ReactNode;
    pose?: TaraPose;
    poseAlt?: string;
    /** Isi tambahan di bawah judul (mis. kolom pencarian tiket). */
    heroChildren?: ReactNode;
    /** Pengganti pose di sisi kanan hero (mis. pemilih wilayah di peta). */
    heroAside?: ReactNode;
    /** Jejak halaman di atas eyebrow; item terakhir = halaman ini. */
    breadcrumb?: { label: string; href?: string }[];
    children: ReactNode;
}) {
    const { auth } = usePage<SharedData>().props;

    return (
        <>
            <Head title={`${title} — SIGAP`}>
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    rel="stylesheet"
                    href="https://fonts.bunny.net/css?family=space-grotesk:500,600,700|jost:400,500,600|jetbrains-mono:500,600"
                    head-key="transi-fonts"
                />
                {description && <meta name="description" content={description} />}
            </Head>

            <div className="transi-page min-h-screen bg-white text-[#0f2233] antialiased">
                <a
                    href="#konten"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[110] focus:rounded-lg focus:bg-[var(--t-navy)] focus:px-4 focus:py-2 focus:text-white"
                >
                    Langsung ke konten utama
                </a>
                <TransiHeader loggedIn={Boolean(auth?.user)} isAdmin={Boolean(auth?.user?.is_admin)} onChat={() => goToChat()} active={active} />

                <section className="bg-[#f7f3ee]">
                    <div className="relative mx-auto flex max-w-[1312px] items-end gap-8 px-4 sm:px-6 lg:px-16">
                        <div className={cn('min-w-0 flex-1 py-12 lg:py-16', heroAside && 'lg:flex lg:items-end lg:justify-between lg:gap-10')}>
                            <div className="min-w-0">
                                {breadcrumb && (
                                    <nav aria-label="Jejak halaman" className="mb-5">
                                        <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#6b5d4a]">
                                            {breadcrumb.map((b, i) => (
                                                <li key={b.label} className="flex items-center gap-1.5">
                                                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-[#a8987f]" aria-hidden="true" />}
                                                    {b.href ? (
                                                        <Link href={b.href} className="hover:text-[var(--t-deep)] hover:underline">
                                                            {b.label}
                                                        </Link>
                                                    ) : (
                                                        <span aria-current="page" className="font-semibold text-[var(--t-deep)]">
                                                            {b.label}
                                                        </span>
                                                    )}
                                                </li>
                                            ))}
                                        </ol>
                                    </nav>
                                )}
                                <TaraEyebrow tone="bronze">{eyebrow}</TaraEyebrow>
                                <h1 className="font-heading mt-3 text-[34px] leading-[1.08] font-bold text-[var(--t-deep)] sm:text-[44px] lg:text-[52px]">
                                    {heading}
                                </h1>
                                {subtitle && (
                                    <div className="mt-4 max-w-[640px] text-base leading-relaxed text-[#4b3f30] sm:text-[17px]">{subtitle}</div>
                                )}
                                {heroChildren && <div className="mt-7">{heroChildren}</div>}
                            </div>
                            {heroAside && <div className="mt-6 shrink-0 lg:mt-0">{heroAside}</div>}
                        </div>
                        {pose && !heroAside && (
                            <TaraPoseImage
                                pose={pose}
                                alt={poseAlt}
                                eager
                                className="transi-rise hidden h-[330px] w-auto shrink-0 self-end md:block lg:h-[380px]"
                            />
                        )}
                    </div>
                </section>

                <main id="konten">{children}</main>
                <TaraFooter />
                <TaraLauncher />
            </div>
        </>
    );
}
