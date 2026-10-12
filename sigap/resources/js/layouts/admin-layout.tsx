import NotificationBell from '@/components/sigap/notification-bell';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    BookOpen,
    FilePen,
    Gauge,
    LayoutList,
    LogOut,
    MapPin,
    MessageSquare,
    Moon,
    Radio,
    ScrollText,
    Settings,
    ShieldCheck,
    Sun,
    Ticket,
    Users,
    type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

interface AdminLayoutProps {
    children: ReactNode;
    title: string;
    subtitle?: string;
    actions?: ReactNode;
}

interface NavEntry {
    label: string;
    href: string;
    icon: LucideIcon;
    match: string;
    superAdminOnly?: boolean;
}

const NAV: NavEntry[] = [
    { label: 'Matriks Rekapan', href: '/admin/matriks', icon: LayoutList, match: '/admin/matriks' },
    { label: 'Manajemen Tiket', href: '/admin/tiket', icon: Ticket, match: '/admin/tiket' },
    { label: 'Tiket Internal', href: '/admin/tiket-internal', icon: Gauge, match: '/admin/tiket-internal', superAdminOnly: true },
    { label: 'Input Manual', href: '/admin/input-manual', icon: FilePen, match: '/admin/input-manual' },
    { label: 'Pesan Masuk', href: '/admin/chat', icon: MessageSquare, match: '/admin/chat' },
    { label: 'Daftar Admin', href: '/admin/petugas', icon: Users, match: '/admin/petugas', superAdminOnly: true },
    { label: 'Log Aktivitas', href: '/admin/log-aktivitas', icon: ScrollText, match: '/admin/log-aktivitas', superAdminOnly: true },
    { label: 'Data Kawasan', href: '/admin/kawasan', icon: MapPin, match: '/admin/kawasan' },
    { label: 'Manajemen Kanal', href: '/admin/kanal', icon: Radio, match: '/admin/kanal' },
    { label: 'Pengaturan', href: '/admin/pengaturan', icon: Settings, match: '/admin/pengaturan' },
    { label: 'Panduan Layanan', href: '/panduan', icon: BookOpen, match: '/panduan' },
];

export default function AdminLayout({ children, title, subtitle, actions }: AdminLayoutProps) {
    const { auth, app, flash } = usePage<SharedData>().props;
    const { appearance, updateAppearance } = useAppearance();
    const [mobileOpen, setMobileOpen] = useState(false);

    const url = usePage().url;
    const isSuper = Boolean(auth?.user?.is_admin && auth?.user?.role === 'super_admin');
    const nav = NAV.filter((n) => !n.superAdminOnly || isSuper);

    const isActive = (match: string) => url === match || url.startsWith(match + '/');

    const toggleDark = () => updateAppearance(appearance === 'dark' ? 'light' : 'dark');

    const sidebar = (
        <div className="dark:bg-dark-card flex h-full flex-col bg-white transition-colors">
            <div className="flex items-center gap-3 border-b border-gray-100 p-6 dark:border-gray-700">
                <div className="bg-brand-light flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-sm">
                    <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="text-lg leading-tight font-bold text-gray-800 dark:text-white">{isSuper ? 'Super Admin' : 'Admin Kawasan'}</h2>
                    <p className="text-[10px] font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">Panel Kontrol SIGAP</p>
                </div>
            </div>

            <nav className="flex-grow space-y-1 overflow-y-auto p-4">
                {nav.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.match);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors',
                                active
                                    ? 'bg-brand-soft text-primary dark:text-brand-light font-bold shadow-sm dark:bg-gray-700'
                                    : 'font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700',
                            )}
                        >
                            <Icon className="h-5 w-5 shrink-0" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="border-t border-gray-100 p-4 dark:border-gray-700">
                <button
                    onClick={() => router.post('/keluar')}
                    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 font-bold text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                    <LogOut className="h-5 w-5" /> Keluar
                </button>
            </div>
        </div>
    );

    return (
        <div className="absol-admin dark:bg-dark-bg min-h-screen bg-gray-50 transition-colors">
            <Head title={`${title} — Admin SIGAP`}>
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    rel="stylesheet"
                    href="https://fonts.bunny.net/css?family=space-grotesk:500,700|jost:300,400,500,600,700"
                    head-key="absol-fonts"
                />
            </Head>

            {/* Topbar */}
            <header className="dark:bg-dark-card sticky top-0 z-40 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 md:px-6 dark:border-gray-800">
                <div className="flex items-center gap-3">
                    <button onClick={() => setMobileOpen((v) => !v)} className="text-gray-600 md:hidden dark:text-gray-300" aria-label="Buka menu">
                        <LayoutList className="h-6 w-6" />
                    </button>
                    <Link href="/" className="flex items-center gap-2">
                        <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-full font-bold text-white">S</div>
                        <span className="text-primary dark:text-brand-light font-bold">{app?.brand ?? 'SIGAP'}</span>
                    </Link>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={toggleDark}
                        className="hover:text-primary dark:text-secondary text-gray-400"
                        aria-label="Ganti mode gelap/terang"
                    >
                        {appearance === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </button>
                    <NotificationBell />
                    <div className="flex items-center gap-2">
                        <div className="hidden text-right sm:block">
                            <p className="text-sm font-semibold text-gray-800 dark:text-white">{auth?.user?.name}</p>
                            <p className="text-[10px] text-gray-400 uppercase">{isSuper ? 'Super Admin' : 'Admin'}</p>
                        </div>
                        <div className="bg-brand-light flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white">
                            {auth?.user?.name?.charAt(0)?.toUpperCase() ?? 'A'}
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex">
                {/* Desktop sidebar */}
                <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-gray-200 md:block dark:border-gray-800">
                    {sidebar}
                </aside>

                {/* Mobile sidebar */}
                {mobileOpen && (
                    <div className="fixed inset-0 z-50 md:hidden">
                        <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
                        <div className="absolute top-16 bottom-0 left-0 w-64 shadow-xl">{sidebar}</div>
                    </div>
                )}

                <main className="min-w-0 flex-grow p-4 md:p-8">
                    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <span className="text-brand-light mb-1.5 flex items-center gap-2 text-[11px] font-bold tracking-[3px] uppercase">
                                <span className="bg-brand-light h-[2px] w-6 rounded-full" />
                                Panel Admin
                            </span>
                            <h1 className="text-brand text-2xl font-extrabold tracking-tight dark:text-white">{title}</h1>
                            {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
                            <div className="bg-brand-light mt-3 h-[3px] w-16 rounded-full" />
                        </div>
                        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
                    </div>
                    {(flash?.success || flash?.error) && (
                        <div
                            role={flash.error ? 'alert' : 'status'}
                            className={cn(
                                'mb-6 rounded-lg border p-4 text-sm',
                                flash.success
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300'
                                    : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300',
                            )}
                        >
                            {flash.success ?? flash.error}
                        </div>
                    )}
                    {children}
                </main>
            </div>
        </div>
    );
}

export function AdminStat({
    label,
    value,
    hint,
    tone = 'brand',
    icon: Icon,
}: {
    label: string;
    value: ReactNode;
    hint?: string;
    tone?: 'brand' | 'red' | 'green' | 'orange' | 'indigo';
    icon?: LucideIcon;
}) {
    const tones: Record<string, string> = {
        brand: 'border-l-brand-light',
        red: 'border-l-red-500',
        green: 'border-l-green-500',
        orange: 'border-l-orange-500',
        indigo: 'border-l-indigo-500',
    };
    const iconTones: Record<string, string> = {
        brand: 'bg-brand-light/10 text-brand-light',
        red: 'bg-red-500/10 text-red-500',
        green: 'bg-green-500/10 text-green-500',
        orange: 'bg-orange-500/10 text-orange-500',
        indigo: 'bg-indigo-500/10 text-indigo-500',
    };
    return (
        <div
            className={cn(
                'dark:bg-dark-card flex items-center justify-between rounded-xl border border-l-4 border-gray-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-gray-700',
                tones[tone],
            )}
        >
            <div>
                <p className="text-brand-light mb-1 text-[11px] font-bold tracking-[2px] uppercase">{label}</p>
                <div className="font-heading text-brand text-xl font-extrabold dark:text-white">{value}</div>
                {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
            </div>
            {Icon && (
                <div
                    className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-300 hover:scale-105',
                        iconTones[tone],
                    )}
                >
                    <Icon className="h-5 w-5" />
                </div>
            )}
        </div>
    );
}

export function StatusBadge({ value, label }: { value?: string | null; label?: string | null }) {
    const styles: Record<string, string> = {
        baru: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        verifikasi: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
        diproses: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
        selesai: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
        ditolak: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    };
    return (
        <span
            className={cn(
                'inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase',
                styles[value ?? ''] ?? 'bg-gray-100 text-gray-600',
            )}
        >
            {label ?? value ?? '—'}
        </span>
    );
}

export function ImpactBadge({ value, label }: { value?: string | null; label?: string | null }) {
    const styles: Record<string, string> = {
        rendah: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
        sedang: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        tinggi: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        kritis: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return (
        <span className={cn('inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase', styles[value ?? ''] ?? 'bg-gray-100 text-gray-600')}>
            {label ?? value ?? '—'}
        </span>
    );
}
