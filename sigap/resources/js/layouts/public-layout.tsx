import LiveChatWidget from '@/components/sigap/live-chat-widget';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { Accessibility, AlertCircle, Bell, CheckCircle2, ChevronDown, LogIn, LogOut, Menu, X, Zap } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

interface PublicLayoutProps {
    children: ReactNode;
    title?: string;
}

const NAV = [
    { label: 'Beranda', route: 'home', href: '/', page: 'home' },
    { label: 'Data', route: 'tentang', href: '/tentang', page: 'tentang' },
    { label: 'Katalog Pengaduan', route: 'katalog', href: '/katalog', page: 'katalog' },
    { label: 'Peta Wilayah', route: 'peta', href: '/peta', page: 'peta' },
    { label: 'Panduan', route: 'panduan', href: '/panduan', page: 'panduan' },
];

const FONT_STEPS = ['text-[15px]', 'text-base', 'text-[17px]', 'text-lg'];

export default function PublicLayout({ children, title }: PublicLayoutProps) {
    const { auth, app, flash } = usePage<SharedData>().props;
    const [mobileOpen, setMobileOpen] = useState(false);
    const [a11yOpen, setA11yOpen] = useState(false);
    const [fontStep, setFontStep] = useState(1);
    const [flashOpen, setFlashOpen] = useState(true);

    useEffect(() => {
        setFlashOpen(true);
    }, [flash?.success, flash?.error, flash?.status]);

    useEffect(() => {
        const saved = Number(localStorage.getItem('sigap-font-step'));
        if (!Number.isNaN(saved) && saved >= 0 && saved < FONT_STEPS.length) {
            setFontStep(saved);
        }
    }, []);

    const changeFont = (step: number) => {
        const next = Math.min(Math.max(step, 0), FONT_STEPS.length - 1);
        setFontStep(next);
        localStorage.setItem('sigap-font-step', String(next));
    };

    return (
        <div className={cn('bg-surface-light flex min-h-screen flex-col transition-colors', FONT_STEPS[fontStep])}>
            <a
                href="#main-content"
                className="focus:bg-primary sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded focus:px-4 focus:py-2 focus:text-white"
            >
                Langsung ke konten utama
            </a>

            {/* HEADER */}
            <header className="fixed top-0 z-50 w-full border-b border-gray-100 bg-white shadow-sm transition-colors">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-20 justify-between">
                        <Link href="/" className="flex cursor-pointer items-center gap-3">
                            <div className="bg-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white">
                                <Zap className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col justify-center">
                                <h1 className="text-primary text-xl leading-tight font-bold">{app?.brand ?? 'SIGAP'}</h1>
                                <p
                                    className="hidden max-w-[200px] truncate text-[10px] font-medium text-gray-500 md:block lg:max-w-xs"
                                    title={app?.tagline}
                                >
                                    {app?.tagline}
                                </p>
                            </div>
                        </Link>

                        {/* Desktop nav */}
                        <div className="relative hidden h-full items-center space-x-6 lg:flex">
                            {NAV.map((item) =>
                                item.page === 'tentang' ? (
                                    <div key={item.route} className="group relative flex h-full items-center">
                                        <button className="hover:text-primary flex h-full items-center gap-2 font-semibold text-gray-600 transition">
                                            {item.label}
                                            <ChevronDown className="h-3 w-3" />
                                        </button>
                                        <div className="invisible absolute top-full left-0 z-50 flex w-56 -translate-y-2 flex-col rounded-lg border border-gray-100 bg-white py-2 opacity-0 shadow-xl transition-all duration-300 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                                            {[
                                                ['Data Harian', 'sec-harian'],
                                                ['Data Bulanan', 'sec-bulanan'],
                                                ['Dasar Hukum', 'sec-dasar-hukum'],
                                                ['Agen SIGAP', 'sec-petugas'],
                                            ].map(([label, sec]) => (
                                                <Link
                                                    key={sec}
                                                    href={`/tentang#${sec}`}
                                                    className="text-primary px-5 py-3 text-left text-[15px] font-medium transition-colors hover:bg-gray-50"
                                                >
                                                    {label}
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <Link
                                        key={item.route}
                                        href={item.href}
                                        className="nav-link hover:text-primary flex h-full items-center font-semibold text-gray-600 transition"
                                    >
                                        {item.label}
                                    </Link>
                                ),
                            )}

                            <div className="flex h-full items-center gap-4 pl-2">
                                <button type="button" className="hover:text-primary relative text-gray-400 transition" aria-label="Notifikasi">
                                    <Bell className="h-5 w-5" />
                                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-white bg-red-500" />
                                </button>

                                {auth?.user ? (
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={auth.user.is_admin ? '/admin' : '/portal-warga'}
                                            className="bg-primary hover:bg-brand-light flex items-center rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition"
                                        >
                                            {auth.user.name}
                                        </Link>
                                        <Link
                                            href="/keluar"
                                            method="post"
                                            as="button"
                                            className="flex items-center rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                                        >
                                            <LogOut className="h-4 w-4" />
                                        </Link>
                                    </div>
                                ) : (
                                    <Link
                                        href="/masuk"
                                        className="bg-primary hover:bg-brand-light flex items-center rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition"
                                    >
                                        <LogIn className="mr-2 h-4 w-4" /> Masuk
                                    </Link>
                                )}
                            </div>
                        </div>

                        {/* Mobile buttons */}
                        <div className="flex items-center gap-4 lg:hidden">
                            <button onClick={() => setMobileOpen((v) => !v)} className="text-gray-600" aria-label="Buka menu navigasi">
                                {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-7 w-7" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile menu */}
                {mobileOpen && (
                    <div className="absolute top-20 left-0 z-40 flex w-full flex-col border-b border-gray-100 bg-white shadow-lg lg:hidden">
                        {NAV.filter((i) => i.page !== 'tentang').map((item) => (
                            <Link
                                key={item.route}
                                href={item.href}
                                onClick={() => setMobileOpen(false)}
                                className="hover:text-brand-light border-b border-gray-50 px-6 py-4 text-left font-semibold text-gray-700"
                            >
                                {item.label}
                            </Link>
                        ))}
                        <div className="bg-gray-50 px-6 py-4">
                            {auth?.user ? (
                                <Link
                                    href={auth.user.is_admin ? '/admin' : '/portal-warga'}
                                    className="bg-primary flex w-full items-center justify-center gap-2 rounded-md px-5 py-3 font-bold text-white"
                                >
                                    {auth.user.name}
                                </Link>
                            ) : (
                                <Link
                                    href="/masuk"
                                    className="bg-primary flex w-full items-center justify-center gap-2 rounded-md px-5 py-3 font-bold text-white"
                                >
                                    <LogIn className="h-4 w-4" /> Masuk
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </header>

            {/* AKSESIBILITAS */}
            <div
                className="bg-brand-light hover:bg-primary fixed top-1/4 left-0 z-[60] cursor-pointer rounded-r-xl p-3 text-white shadow-lg transition"
                role="button"
                tabIndex={0}
                aria-label="Buka menu aksesibilitas"
                onClick={() => setA11yOpen((v) => !v)}
            >
                <Accessibility className="h-5 w-5" />
            </div>
            {a11yOpen && (
                <div className="fixed top-1/4 left-0 z-[60] mt-12 w-64 rounded-r-xl border border-gray-200 bg-white p-4 shadow-2xl">
                    <h4 className="mb-4 border-b border-gray-100 pb-2 text-sm font-bold text-gray-800">Aksesibilitas</h4>
                    <p className="mb-2 text-xs font-bold text-gray-500 uppercase">Ukuran Teks</p>
                    <div className="flex justify-between gap-2">
                        {['A -', 'A', 'A +'].map((label, idx) => (
                            <Button
                                key={label}
                                variant={fontStep === idx ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1"
                                onClick={() => changeFont(idx)}
                            >
                                {label}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            {/* KONTEN */}
            <main id="main-content" tabIndex={-1} className="flex-grow pt-20 transition-colors">
                {(flash?.success || flash?.error) && flashOpen && (
                    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
                        <div
                            className={cn(
                                'flex items-start gap-3 rounded-lg border p-4 text-sm',
                                flash.success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800',
                            )}
                        >
                            {flash.success ? (
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                            ) : (
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            )}
                            <span className="flex-grow">{flash.success ?? flash.error}</span>
                            <button onClick={() => setFlashOpen(false)} aria-label="Tutup notifikasi">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
                <div key={title} className="sigap-page-enter">
                    {children}
                </div>
            </main>

            {/* FOOTER */}
            <footer className="border-brand-light mt-auto w-full border-t-4 bg-gray-900 pt-10 pb-6 text-white">
                <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 text-center sm:px-6 md:grid-cols-2 md:text-left lg:px-8">
                    <div>
                        <h3 className="mb-1 text-xl font-bold">{app?.brand ?? 'SIGAP'}</h3>
                        <p className="mb-1 text-sm text-gray-400">{app?.tagline}.</p>
                        <p className="text-secondary mt-2 text-xs font-bold italic">"Komitmen Melayani, Menuntaskan Tanpa Henti"</p>
                    </div>
                    <div>
                        <h4 className="mb-4 text-sm font-bold tracking-wide text-gray-300 uppercase">Informasi &amp; Kebijakan</h4>
                        <ul className="space-y-2 text-sm text-gray-400">
                            {[
                                ['Panduan Layanan', '/panduan'],
                                ['Pedoman Layanan', '/pedoman-layanan'],
                                ['Syarat dan Ketentuan', '/syarat-ketentuan'],
                                ['Kebijakan Privasi', '/kebijakan-privasi'],
                                ['Tentang Kami', '/tentang-kami'],
                            ].map(([label, href]) => (
                                <li key={href}>
                                    <Link href={href} className="hover:text-brand-light transition">
                                        {label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <div className="mx-auto mt-8 max-w-7xl border-t border-gray-800 px-4 pt-6 text-center text-xs text-gray-500 sm:px-6 lg:px-8">
                    &copy; 2026 {app?.ministry ?? 'Kementerian Transmigrasi Republik Indonesia'}. Seluruh hak cipta dilindungi.
                </div>
            </footer>

            {/* Live Chat (PRD D5) */}
            <LiveChatWidget />
        </div>
    );
}
