import { Link } from '@inertiajs/react';
import { Headset, Menu, MessageCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

/** Header beranda baru & halaman Chat TARA (desain pen.dev). */

const NAV = [
    { label: 'Beranda', href: '/beranda-baru' },
    { label: 'Lacak Tiket', href: '/lacak' },
    { label: 'Katalog Pengaduan', href: '/katalog' },
    { label: 'Peta Kawasan', href: '/peta' },
    { label: 'Panduan', href: '/panduan' },
];

export default function TransiHeader({
    loggedIn,
    isAdmin,
    onChat,
    active = 'beranda',
    className,
}: {
    loggedIn: boolean;
    isAdmin: boolean;
    onChat: () => void;
    active?: 'beranda' | 'chat';
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const account = loggedIn
        ? { label: isAdmin ? 'Panel Admin' : 'Portal Saya', href: isAdmin ? '/admin' : '/portal-warga' }
        : { label: 'Masuk', href: '/masuk' };

    return (
        <header
            className={cn(
                'sticky top-0 z-50 border-b bg-white/90 backdrop-blur-md transition-[box-shadow,border-color] duration-300',
                className,
                scrolled ? 'border-transparent shadow-[0_6px_24px_rgba(2,43,74,0.08)]' : 'border-[#e8edf2]',
            )}
        >
            <div className="mx-auto flex h-16 max-w-[1312px] items-center justify-between gap-4 px-4 sm:px-6 lg:h-[76px] lg:px-16">
                <Link href="/beranda-baru" className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--t-navy)] text-white">
                        <Headset className="h-[22px] w-[22px]" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                        <span className="font-heading block text-xl leading-tight font-bold text-[var(--t-navy)]">SIGAP</span>
                        <span className="block truncate text-xs text-[#5b6b7a]">
                            <span className="hidden sm:inline">Contact Center Kementerian Transmigrasi</span>
                            <span className="sm:hidden">Contact Center Transmigrasi</span>
                        </span>
                    </span>
                </Link>

                <nav aria-label="Navigasi utama" className="hidden items-center gap-8 lg:flex">
                    {NAV.map((n) => (
                        <Link
                            key={n.href}
                            href={n.href}
                            className={cn(
                                'relative text-[15px] transition-colors after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-[var(--t-gold)] after:transition-transform after:duration-300 hover:text-[var(--t-navy)] hover:after:scale-x-100',
                                n.href === '/beranda-baru' && active === 'beranda' ? 'font-semibold text-[var(--t-navy)]' : 'text-[#4a5565]',
                            )}
                        >
                            {n.label}
                        </Link>
                    ))}
                </nav>

                <div className="flex shrink-0 items-center gap-3">
                    <button
                        type="button"
                        onClick={onChat}
                        className="transi-lift hidden h-10 items-center gap-2 rounded-full border-[1.5px] border-[var(--t-navy)] px-4 text-[15px] font-semibold text-[var(--t-navy)] hover:bg-[var(--t-navy)] hover:text-white lg:flex"
                    >
                        <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" /> Chat TARA
                    </button>
                    <Link
                        href={account.href}
                        className="transi-lift flex h-10 items-center rounded-full bg-[var(--t-navy)] px-[18px] text-[15px] font-semibold text-white hover:bg-[#00508a]"
                    >
                        {account.label}
                    </Link>
                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        aria-expanded={open}
                        aria-controls="menu-ponsel"
                        aria-label={open ? 'Tutup menu' : 'Buka menu'}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d5dee6] text-[var(--t-navy)] transition-colors hover:bg-[#f2f5f8] lg:hidden"
                    >
                        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            <div
                id="menu-ponsel"
                className={cn('transi-accordion border-t border-[#e8edf2] lg:hidden', !open && 'border-transparent')}
                data-open={open}
                inert={!open}
            >
                <div>
                    <nav aria-label="Menu ponsel" className="flex flex-col gap-1 px-4 py-4 sm:px-6">
                        {NAV.map((n) => (
                            <Link key={n.href} href={n.href} className="rounded-lg px-3 py-3 text-base text-[#22313f] hover:bg-[#f2f5f8]">
                                {n.label}
                            </Link>
                        ))}
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                onChat();
                            }}
                            className="mt-2 flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--t-gold)] font-semibold text-[var(--t-deep)]"
                        >
                            <MessageCircle className="h-5 w-5" aria-hidden="true" /> Chat dengan TARA
                        </button>
                    </nav>
                </div>
            </div>
        </header>
    );
}
