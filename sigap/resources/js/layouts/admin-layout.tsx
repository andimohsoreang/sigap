import NotificationBell from '@/components/sigap/notification-bell';
import { useChatUnread } from '@/hooks/use-chat-unread';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    BookOpen,
    ChevronDown,
    ChevronsLeft,
    ChevronsRight,
    FilePen,
    Gauge,
    Headset,
    Inbox,
    LayoutDashboard,
    Library,
    LogOut,
    MapPin,
    Menu,
    MessageCircle,
    Radio,
    ScrollText,
    Settings,
    Ticket,
    UserRound,
    Users,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

interface AdminLayoutProps {
    children: ReactNode;
    title: string;
    subtitle?: string;
    actions?: ReactNode;
    /** Lencana kecil di samping judul banner (mis. "Asisten AI aktif"). */
    badge?: string;
}

interface NavEntry {
    label: string;
    href: string;
    icon: LucideIcon;
    match: string;
    superAdminOnly?: boolean;
}

/** Menu harian petugas. */
const PRIMARY: NavEntry[] = [
    { label: 'Matriks Rekapan', href: '/admin/matriks', icon: LayoutDashboard, match: '/admin/matriks' },
    { label: 'Kotak Masuk', href: '/admin/chat', icon: Inbox, match: '/admin/chat' },
    { label: 'Manajemen Tiket', href: '/admin/tiket', icon: Ticket, match: '/admin/tiket' },
    { label: 'Basis Pengetahuan', href: '/admin/pengetahuan', icon: Library, match: '/admin/pengetahuan' },
];

/** Menu yang lebih jarang dipakai, dikelompokkan agar sidebar tetap ringkas. */
const MANAGE: NavEntry[] = [
    { label: 'Input Manual', href: '/admin/input-manual', icon: FilePen, match: '/admin/input-manual' },
    { label: 'Tiket Internal', href: '/admin/tiket-internal', icon: Gauge, match: '/admin/tiket-internal', superAdminOnly: true },
    { label: 'Data Kawasan', href: '/admin/kawasan', icon: MapPin, match: '/admin/kawasan' },
    { label: 'Manajemen Kanal', href: '/admin/kanal', icon: Radio, match: '/admin/kanal' },
    { label: 'Daftar Admin', href: '/admin/petugas', icon: Users, match: '/admin/petugas', superAdminOnly: true },
    { label: 'Log Aktivitas', href: '/admin/log-aktivitas', icon: ScrollText, match: '/admin/log-aktivitas', superAdminOnly: true },
    { label: 'Pengaturan', href: '/admin/pengaturan', icon: Settings, match: '/admin/pengaturan' },
    { label: 'Panduan Layanan', href: '/panduan', icon: BookOpen, match: '/panduan' },
];

const COLLAPSE_KEY = 'sigap-admin-sidebar';

export default function AdminLayout({ children, title, subtitle, actions, badge }: AdminLayoutProps) {
    const { auth, flash, chat_waiting: waiting } = usePage<SharedData>().props;
    const url = usePage().url;
    const chatUnread = useChatUnread();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    const isSuper = Boolean(auth?.user?.is_admin && auth?.user?.role === 'super_admin');
    const isActive = (match: string) => url === match || url.startsWith(match + '/') || url.startsWith(match + '?');
    const manage = MANAGE.filter((n) => !n.superAdminOnly || isSuper);
    const [manageOpen, setManageOpen] = useState(() => manage.some((n) => isActive(n.match)));
    const pageIcon = [...PRIMARY, ...MANAGE].find((n) => isActive(n.match))?.icon ?? LayoutDashboard;

    useEffect(() => {
        try {
            setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
        } catch {
            /* penyimpanan lokal tidak tersedia */
        }
    }, []);

    const toggleCollapsed = () => {
        setCollapsed((v) => {
            try {
                window.localStorage.setItem(COLLAPSE_KEY, v ? '0' : '1');
            } catch {
                /* abaikan */
            }
            return !v;
        });
    };

    const sidebar = (compact: boolean, onNavigate?: () => void) => (
        <div className="flex h-full flex-col bg-white">
            <div className={cn('flex items-center gap-3 px-5 pt-6 pb-5', compact && 'justify-center px-3')}>
                <Link href="/admin" className="flex min-w-0 items-center gap-3" onClick={onNavigate}>
                    <span className="bg-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white">
                        <Headset className="h-5 w-5" aria-hidden="true" />
                    </span>
                    {!compact && <span className="text-primary text-2xl font-bold tracking-tight">SIGAP</span>}
                </Link>
                {!compact && (
                    <button
                        type="button"
                        onClick={toggleCollapsed}
                        className="ml-auto hidden h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 md:flex"
                        aria-label="Ciutkan menu"
                    >
                        <ChevronsLeft className="h-5 w-5" />
                    </button>
                )}
            </div>

            <nav className={cn('flex-1 overflow-y-auto pb-4', compact ? 'px-3' : 'px-4')} aria-label="Menu admin">
                <ul className="space-y-1">
                    {PRIMARY.map((item) => (
                        <li key={item.href}>
                            <NavLink
                                item={item}
                                active={isActive(item.match)}
                                compact={compact}
                                onNavigate={onNavigate}
                                count={item.href === '/admin/chat' ? chatUnread : 0}
                            />
                        </li>
                    ))}
                    <li>
                        <button
                            type="button"
                            onClick={() => (compact ? toggleCollapsed() : setManageOpen((v) => !v))}
                            aria-expanded={manageOpen}
                            className={cn(
                                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium text-gray-700 hover:bg-gray-100',
                                compact && 'justify-center px-0',
                            )}
                            title={compact ? 'Kelola' : undefined}
                        >
                            <Settings className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
                            {!compact && (
                                <>
                                    <span className="flex-1 text-left">Kelola</span>
                                    <ChevronDown className={cn('h-4 w-4 text-gray-500 transition-transform', manageOpen && 'rotate-180')} />
                                </>
                            )}
                        </button>
                        {manageOpen && !compact && (
                            <ul className="mt-1 ml-5 space-y-0.5 border-l border-gray-200 pl-3">
                                {manage.map((item) => (
                                    <li key={item.href}>
                                        <NavLink item={item} active={isActive(item.match)} compact={false} onNavigate={onNavigate} small />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                </ul>

                {!compact && (
                    <div className="mt-8">
                        <p className="px-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">Menunggu petugas</p>
                        {waiting && waiting.length > 0 ? (
                            <ul className="mt-2 space-y-0.5">
                                {waiting.map((w) => (
                                    <li key={w.id}>
                                        <Link
                                            href={`/admin/chat?tab=menunggu&conversation=${w.id}`}
                                            onClick={onNavigate}
                                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] text-gray-700 hover:bg-gray-100"
                                        >
                                            <MessageCircle className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
                                            <span className="min-w-0 flex-1 truncate">
                                                {w.nama}
                                                {w.cuplikan ? <span className="text-gray-500"> · {w.cuplikan}</span> : null}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-2 px-3 text-sm text-gray-500">Tidak ada antrean.</p>
                        )}
                    </div>
                )}
            </nav>

            <div className={cn('space-y-1 border-t border-gray-200 py-4', compact ? 'px-3' : 'px-4')}>
                <div
                    className={cn('flex items-center gap-3 rounded-lg px-3 py-2', compact && 'justify-center px-0')}
                    title={compact ? auth?.user?.name : undefined}
                >
                    <UserRound className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
                    {!compact && (
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-medium text-gray-800">{auth?.user?.name}</span>
                            <span className="block text-xs text-gray-500">{isSuper ? 'Super Admin' : 'Admin Kawasan'}</span>
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => router.post('/keluar')}
                    className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium text-gray-700 hover:bg-red-50 hover:text-red-700',
                        compact && 'justify-center px-0',
                    )}
                    title={compact ? 'Keluar' : undefined}
                >
                    <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {!compact && 'Keluar'}
                </button>
                {compact && (
                    <button
                        type="button"
                        onClick={toggleCollapsed}
                        className="hidden w-full items-center justify-center rounded-lg py-2.5 text-gray-600 hover:bg-gray-100 md:flex"
                        aria-label="Lebarkan menu"
                    >
                        <ChevronsRight className="h-5 w-5" />
                    </button>
                )}
            </div>
        </div>
    );

    const PageIcon = pageIcon;

    return (
        <div className="absol-admin min-h-screen bg-[#f5f7f8]">
            <Head title={`${title} — Admin SIGAP`}>
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link rel="stylesheet" href="https://fonts.bunny.net/css?family=jetbrains-mono:400,500" head-key="admin-fonts" />
            </Head>

            {/* Bilah atas khusus layar kecil */}
            <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4 md:hidden">
                <button type="button" onClick={() => setMobileOpen(true)} className="-ml-1 p-1 text-gray-700" aria-label="Buka menu">
                    <Menu className="h-6 w-6" />
                </button>
                <span className="text-primary text-lg font-bold">SIGAP</span>
                <div className="ml-auto">
                    <NotificationBell />
                </div>
            </header>

            <div className="flex">
                <aside
                    className={cn(
                        'sticky top-0 hidden h-screen shrink-0 border-r border-gray-200 transition-[width] duration-200 md:block',
                        collapsed ? 'w-[76px]' : 'w-72',
                    )}
                >
                    {sidebar(collapsed)}
                </aside>

                {mobileOpen && (
                    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu admin">
                        <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
                        <div className="absolute inset-y-0 left-0 w-[85%] max-w-xs shadow-xl">
                            <button
                                type="button"
                                onClick={() => setMobileOpen(false)}
                                className="absolute top-5 right-3 z-10 rounded-lg p-1.5 text-gray-600 hover:bg-gray-100"
                                aria-label="Tutup menu"
                            >
                                <X className="h-5 w-5" />
                            </button>
                            {sidebar(false, () => setMobileOpen(false))}
                        </div>
                    </div>
                )}

                <main className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">
                    {/* Banner judul halaman */}
                    <div className="bg-primary mb-5 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl px-4 py-4 text-white md:px-5">
                        <span className="text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white">
                            <PageIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-lg font-semibold md:text-xl">{title}</h1>
                                {badge && <span className="text-primary rounded-md bg-white px-2 py-0.5 text-xs font-medium">{badge}</span>}
                            </div>
                            {subtitle && <p className="mt-0.5 text-sm text-white/80">{subtitle}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                            {actions && (
                                <div className="[&_a]:text-primary [&_button]:text-primary flex flex-wrap items-center gap-2 [&_a]:border-transparent [&_a]:bg-white [&_a:hover]:bg-white/90 [&_button]:border-transparent [&_button]:bg-white [&_button:hover]:bg-white/90">
                                    {actions}
                                </div>
                            )}
                            <div className="hidden md:block">
                                <NotificationBell buttonClassName="relative flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20" />
                            </div>
                        </div>
                    </div>

                    {(flash?.success || flash?.error) && (
                        <div
                            role={flash.error ? 'alert' : 'status'}
                            className={cn(
                                'mb-5 rounded-xl border px-4 py-3 text-sm',
                                flash.success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800',
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

function NavLink({
    item,
    active,
    compact,
    onNavigate,
    count = 0,
    small = false,
}: {
    item: NavEntry;
    active: boolean;
    compact: boolean;
    onNavigate?: () => void;
    count?: number;
    small?: boolean;
}) {
    const Icon = item.icon;
    return (
        <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            title={compact ? item.label : undefined}
            className={cn(
                'relative flex items-center gap-3 rounded-lg px-3 font-medium transition-colors',
                small ? 'py-2 text-sm' : 'py-2.5 text-[15px]',
                active ? 'bg-brand-soft text-primary font-semibold' : 'text-gray-700 hover:bg-gray-100',
                compact && 'justify-center px-0',
            )}
        >
            <Icon className={cn('shrink-0', small ? 'h-4 w-4' : 'h-5 w-5', active ? 'text-primary' : 'text-gray-500')} aria-hidden="true" />
            {!compact && <span className="flex-1 truncate">{item.label}</span>}
            {count > 0 && (
                <span
                    className={cn(
                        'flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] leading-none font-semibold text-white',
                        compact && 'absolute -top-1 -right-1',
                    )}
                    aria-label={`${count} pesan belum dibaca`}
                >
                    {count > 99 ? '99+' : count}
                </span>
            )}
        </Link>
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
    const iconTones: Record<string, string> = {
        brand: 'text-primary',
        red: 'text-red-600',
        green: 'text-emerald-600',
        orange: 'text-amber-600',
        indigo: 'text-indigo-600',
    };
    return (
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
            {Icon && (
                <span
                    className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white', iconTones[tone])}
                >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
            )}
            <div className="min-w-0">
                <p className="text-sm text-gray-600">{label}</p>
                <div className="text-xl font-semibold text-gray-900 tabular-nums">{value}</div>
                {hint && <p className="text-xs text-gray-500">{hint}</p>}
            </div>
        </div>
    );
}

export function StatusBadge({ value, label }: { value?: string | null; label?: string | null }) {
    const styles: Record<string, string> = {
        baru: 'bg-amber-50 text-amber-800 ring-amber-200',
        verifikasi: 'bg-sky-50 text-sky-800 ring-sky-200',
        diproses: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
        selesai: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
        ditolak: 'bg-rose-50 text-rose-800 ring-rose-200',
    };
    return (
        <span
            className={cn(
                'inline-block rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
                styles[value ?? ''] ?? 'bg-gray-50 text-gray-700 ring-gray-200',
            )}
        >
            {label ?? value ?? '—'}
        </span>
    );
}

export function ImpactBadge({ value, label }: { value?: string | null; label?: string | null }) {
    const styles: Record<string, string> = {
        rendah: 'bg-gray-50 text-gray-700 ring-gray-200',
        sedang: 'bg-yellow-50 text-yellow-800 ring-yellow-200',
        tinggi: 'bg-orange-50 text-orange-800 ring-orange-200',
        kritis: 'bg-red-50 text-red-800 ring-red-200',
    };
    return (
        <span
            className={cn(
                'inline-block rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
                styles[value ?? ''] ?? 'bg-gray-50 text-gray-700 ring-gray-200',
            )}
        >
            {label ?? value ?? '—'}
        </span>
    );
}
