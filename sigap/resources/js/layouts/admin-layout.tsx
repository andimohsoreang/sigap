import NotificationBell from '@/components/sigap/notification-bell';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useChatUnread } from '@/hooks/use-chat-unread';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    BookOpen,
    Building2,
    ChevronDown,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    FilePenLine,
    Globe,
    Headset,
    LayoutGrid,
    Library,
    LogOut,
    Map,
    Menu,
    MessageCircle,
    MessagesSquare,
    RadioTower,
    ScrollText,
    Settings,
    Ticket,
    Users,
    Waypoints,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

interface AdminLayoutProps {
    children: ReactNode;
    title: string;
    subtitle?: string;
    actions?: ReactNode;
    /** Lencana kecil di samping judul halaman (mis. "Asisten AI aktif"). */
    badge?: string;
}

interface NavEntry {
    label: string;
    href: string;
    icon: LucideIcon;
    match: string;
    superAdminOnly?: boolean;
}

/**
 * Menu panel admin (Admin v2). Urutan mengikuti desain; Rujukan, Basis
 * Pengetahuan, dan Katalog Portal disisipkan di dekat menu yang berkaitan.
 */
const NAV: NavEntry[] = [
    { label: 'Matriks Rekapan', href: '/admin/matriks', icon: LayoutGrid, match: '/admin/matriks' },
    { label: 'Manajemen Tiket', href: '/admin/tiket', icon: Ticket, match: '/admin/tiket' },
    { label: 'Tiket Internal', href: '/admin/tiket-internal', icon: Building2, match: '/admin/tiket-internal', superAdminOnly: true },
    { label: 'Input Manual', href: '/admin/input-manual', icon: FilePenLine, match: '/admin/input-manual' },
    { label: 'Pesan Masuk', href: '/admin/chat', icon: MessagesSquare, match: '/admin/chat' },
    { label: 'Rujukan', href: '/admin/rujukan', icon: Waypoints, match: '/admin/rujukan' },
    { label: 'Basis Pengetahuan', href: '/admin/pengetahuan', icon: Library, match: '/admin/pengetahuan' },
    { label: 'Daftar Admin', href: '/admin/petugas', icon: Users, match: '/admin/petugas', superAdminOnly: true },
    { label: 'Log Aktivitas', href: '/admin/log-aktivitas', icon: ScrollText, match: '/admin/log-aktivitas', superAdminOnly: true },
    { label: 'Data Kawasan', href: '/admin/kawasan', icon: Map, match: '/admin/kawasan' },
    { label: 'Manajemen Kanal', href: '/admin/kanal', icon: RadioTower, match: '/admin/kanal' },
    { label: 'Katalog Portal', href: '/admin/portal', icon: Globe, match: '/admin/portal' },
    { label: 'Pengaturan', href: '/admin/pengaturan', icon: Settings, match: '/admin/pengaturan' },
    { label: 'Panduan Layanan', href: '/panduan', icon: BookOpen, match: '/panduan' },
];

const COLLAPSE_KEY = 'sigap-admin-sidebar';

export default function AdminLayout({ children, title, subtitle, actions, badge }: AdminLayoutProps) {
    const { auth, flash, chat_waiting: waiting, rujukan_perlu: rujukanPerlu } = usePage<SharedData>().props;
    const url = usePage().url;
    const chatUnread = useChatUnread();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    const isSuper = Boolean(auth?.user?.is_admin && auth?.user?.role === 'super_admin');
    const isActive = (match: string) => url === match || url.startsWith(match + '/') || url.startsWith(match + '?');
    const nav = NAV.filter((n) => !n.superAdminOnly || isSuper);
    const current = NAV.find((n) => isActive(n.match));
    const userName = auth?.user?.name ?? 'Admin';
    const roleLabel = isSuper ? 'Super Admin' : 'Admin Kawasan';

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
        <div className="flex h-full flex-col bg-[var(--adm-primary-deep)] text-[#c9d6e2]">
            <div className={cn('flex items-center gap-3 px-5 pt-5 pb-4', compact && 'justify-center px-3')}>
                <Link href="/admin" className="flex min-w-0 items-center gap-3" onClick={onNavigate}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-[var(--adm-accent)] text-[var(--adm-primary-deep)]">
                        <Headset className="h-5 w-5" aria-hidden="true" />
                    </span>
                    {!compact && (
                        <span className="min-w-0">
                            <span className="block font-[family-name:var(--font-heading)] text-lg leading-tight font-bold text-white">SIGAP</span>
                            <span className="block truncate text-[11px] text-[#9fb2c3]">Panel Admin · Contact Center</span>
                        </span>
                    )}
                </Link>
            </div>

            <nav className={cn('flex-1 overflow-y-auto pb-4', compact ? 'px-2.5' : 'px-3.5')} aria-label="Menu admin">
                {!compact && (
                    <p className="px-2.5 pt-1 pb-2 text-[10.5px] font-semibold tracking-[0.12em] text-[#7f97ab] uppercase">Panel Kontrol SIGAP</p>
                )}
                <ul className="space-y-0.5">
                    {nav.map((item) => (
                        <li key={item.href}>
                            <NavLink
                                item={item}
                                active={isActive(item.match)}
                                compact={compact}
                                onNavigate={onNavigate}
                                count={item.href === '/admin/chat' ? chatUnread : item.href === '/admin/rujukan' ? (rujukanPerlu ?? 0) : 0}
                            />
                        </li>
                    ))}
                </ul>

                {!compact && (
                    <div className="mt-6">
                        <p className="px-2.5 pb-2 text-[10.5px] font-semibold tracking-[0.12em] text-[#7f97ab] uppercase">Menunggu petugas</p>
                        {waiting && waiting.length > 0 ? (
                            <ul className="space-y-0.5">
                                {waiting.map((w) => (
                                    <li key={w.id}>
                                        <Link
                                            href={`/admin/chat?tab=menunggu&conversation=${w.id}`}
                                            onClick={onNavigate}
                                            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[#c9d6e2] hover:bg-white/[0.06] hover:text-white"
                                        >
                                            <MessageCircle className="h-4 w-4 shrink-0 text-[var(--adm-accent)]" aria-hidden="true" />
                                            <span className="min-w-0 flex-1 truncate">
                                                {w.nama}
                                                {w.cuplikan ? <span className="text-[#9fb2c3]"> · {w.cuplikan}</span> : null}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="px-2.5 text-[13px] text-[#7f97ab]">Tidak ada antrean.</p>
                        )}
                    </div>
                )}
            </nav>

            <div className={cn('flex items-center gap-1 border-t border-white/10 py-3', compact ? 'flex-col px-2.5' : 'px-3.5')}>
                <button
                    type="button"
                    onClick={() => router.post('/keluar')}
                    className={cn(
                        'flex flex-1 items-center gap-3 rounded-lg px-2.5 py-2.5 text-[13.5px] font-medium text-[#f5a49c] hover:bg-white/[0.06]',
                        compact && 'w-full justify-center px-0',
                    )}
                    title={compact ? 'Keluar' : undefined}
                >
                    <LogOut className="h-[18px] w-[18px] shrink-0 text-[#f08a80]" aria-hidden="true" />
                    {!compact && 'Keluar'}
                </button>
                {!compact && (
                    <button
                        type="button"
                        onClick={toggleCollapsed}
                        className="hidden h-9 w-9 items-center justify-center rounded-lg text-[#9fb2c3] hover:bg-white/10 hover:text-white md:flex"
                        aria-label="Ciutkan menu"
                        title="Ciutkan menu"
                    >
                        <ChevronsLeft className="h-4 w-4" />
                    </button>
                )}
                {compact && (
                    <button
                        type="button"
                        onClick={toggleCollapsed}
                        className="hidden w-full items-center justify-center rounded-lg py-2.5 text-[#9fb2c3] hover:bg-white/10 hover:text-white md:flex"
                        aria-label="Lebarkan menu"
                    >
                        <ChevronsRight className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="absol-admin min-h-screen bg-[var(--adm-bg)]">
            <Head title={`${title} — Admin SIGAP`}>
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    rel="stylesheet"
                    href="https://fonts.bunny.net/css?family=inter:400,500,600,700|space-grotesk:500,600,700|jetbrains-mono:400,500,600"
                    head-key="admin-fonts"
                />
            </Head>

            <div className="flex">
                {/* Sidebar tetap (fixed) + ruang pengganti selebar sidebar, agar sidebar
                    selalu setinggi layar walau isi halaman lebih tinggi dari wadahnya. */}
                <div aria-hidden="true" className={cn('hidden shrink-0 transition-[width] duration-200 md:block', collapsed ? 'w-[76px]' : 'w-64')} />
                <aside className={cn('fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 md:block', collapsed ? 'w-[76px]' : 'w-64')}>
                    {sidebar(collapsed)}
                </aside>

                {mobileOpen && (
                    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu admin">
                        <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
                        <div className="absolute inset-y-0 left-0 w-[85%] max-w-xs shadow-xl">
                            <button
                                type="button"
                                onClick={() => setMobileOpen(false)}
                                className="absolute top-5 right-3 z-10 rounded-lg p-1.5 text-[#9fb2c3] hover:bg-white/10"
                                aria-label="Tutup menu"
                            >
                                <X className="h-5 w-5" />
                            </button>
                            {sidebar(false, () => setMobileOpen(false))}
                        </div>
                    </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col">
                    {/* Topbar: remah roti + notifikasi + akun */}
                    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-[var(--adm-border)] bg-white px-4 md:px-7">
                        <button
                            type="button"
                            onClick={() => setMobileOpen(true)}
                            className="-ml-1 rounded-lg p-1.5 text-[var(--adm-text-2)] hover:bg-[var(--adm-surface-2)] md:hidden"
                            aria-label="Buka menu"
                        >
                            <Menu className="h-6 w-6" />
                        </button>
                        <nav aria-label="Remah roti" className="flex min-w-0 items-center gap-2 text-[13.5px]">
                            <Link href="/admin" className="hidden text-[var(--adm-text-3)] hover:text-[var(--adm-text)] sm:inline">
                                Panel Admin
                            </Link>
                            <ChevronRight className="hidden h-4 w-4 shrink-0 text-[var(--adm-text-3)] sm:block" aria-hidden="true" />
                            <span className="truncate font-semibold text-[var(--adm-text)]" aria-current="page">
                                {current?.label ?? title}
                            </span>
                        </nav>

                        <div className="ml-auto flex items-center gap-2 md:gap-3">
                            <NotificationBell buttonClassName="relative flex h-9 w-9 items-center justify-center rounded-lg text-[var(--adm-text-3)] hover:bg-[var(--adm-surface-2)] hover:text-[var(--adm-text)]" />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className="flex items-center gap-2.5 rounded-lg py-1 pr-1 pl-1 hover:bg-[var(--adm-surface-2)] md:pr-2"
                                        aria-label="Menu akun"
                                    >
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--adm-primary)] text-sm font-semibold text-white">
                                            {userName.trim().charAt(0).toUpperCase()}
                                        </span>
                                        <span className="hidden text-left md:block">
                                            <span className="block text-[13.5px] leading-tight font-semibold text-[var(--adm-text)]">{userName}</span>
                                            <span className="block text-[10px] font-semibold tracking-[0.08em] text-[var(--adm-text-3)] uppercase">
                                                {roleLabel}
                                            </span>
                                        </span>
                                        <ChevronDown className="hidden h-4 w-4 text-[var(--adm-text-3)] md:block" aria-hidden="true" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                    <DropdownMenuLabel className="text-xs font-normal text-[var(--adm-text-3)]">
                                        Masuk sebagai <span className="font-semibold text-[var(--adm-text)]">{userName}</span>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                        <Link href="/admin/pengaturan">
                                            <Settings className="h-4 w-4" /> Pengaturan akun
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => router.post('/keluar')} className="text-[var(--adm-danger)]">
                                        <LogOut className="h-4 w-4" /> Keluar
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </header>

                    <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
                        {/* Judul halaman */}
                        <div className="mb-6 flex flex-wrap items-start gap-x-4 gap-y-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <h1 className="text-2xl font-bold text-[var(--adm-text)] md:text-[32px] md:leading-tight">{title}</h1>
                                    {badge && (
                                        <span className="rounded-full bg-[var(--adm-success-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--adm-success)]">
                                            {badge}
                                        </span>
                                    )}
                                </div>
                                {subtitle && <p className="mt-1 text-sm text-[var(--adm-text-2)]">{subtitle}</p>}
                            </div>
                            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
                        </div>

                        {(flash?.success || flash?.error) && (
                            <div
                                role={flash.error ? 'alert' : 'status'}
                                className={cn(
                                    'mb-5 rounded-xl border px-4 py-3 text-sm',
                                    flash.success
                                        ? 'border-[var(--adm-success)]/20 bg-[var(--adm-success-soft)] text-[var(--adm-success)]'
                                        : 'border-[var(--adm-danger)]/20 bg-[var(--adm-danger-soft)] text-[var(--adm-danger)]',
                                )}
                            >
                                {flash.success ?? flash.error}
                            </div>
                        )}
                        {children}
                    </main>
                </div>
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
}: {
    item: NavEntry;
    active: boolean;
    compact: boolean;
    onNavigate?: () => void;
    count?: number;
}) {
    const Icon = item.icon;
    return (
        <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            title={compact ? item.label : undefined}
            className={cn(
                'relative flex h-[38px] items-center gap-3 rounded-lg px-2.5 text-[13.5px] transition-colors',
                active ? 'bg-white/[0.09] font-semibold text-white' : 'font-medium text-[#c9d6e2] hover:bg-white/[0.06] hover:text-white',
                compact && 'justify-center px-0',
            )}
        >
            <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-[var(--adm-accent)]' : 'text-[#9fb2c3]')} aria-hidden="true" />
            {!compact && <span className="flex-1 truncate">{item.label}</span>}
            {count > 0 && (
                <span
                    className={cn(
                        'flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--adm-accent)] px-1.5 text-[11px] leading-none font-bold text-[var(--adm-primary-deep)]',
                        compact && 'absolute -top-1 -right-1',
                    )}
                    aria-label={`${count} perlu ditindaklanjuti`}
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
    unit,
    hint,
    tone = 'brand',
    icon: Icon,
}: {
    label: string;
    value: ReactNode;
    /** Satuan kecil di samping angka, mis. "tiket". */
    unit?: string;
    hint?: string;
    tone?: 'brand' | 'red' | 'green' | 'orange' | 'indigo';
    icon?: LucideIcon;
}) {
    // Kartu peringatan (merah) diberi bingkai & angka berwarna seperti kartu EWS di desain.
    const alert = tone === 'red';
    const iconTones: Record<string, string> = {
        brand: 'text-[var(--adm-text-2)]',
        red: 'text-[var(--adm-danger)]',
        green: 'text-[var(--adm-success)]',
        orange: 'text-[var(--adm-warning)]',
        indigo: 'text-[var(--adm-info)]',
    };
    return (
        <div className={cn('rounded-xl border bg-white p-5', alert ? 'border-[#f4c7c2]' : 'border-[var(--adm-border)]')}>
            <p className="flex items-center gap-2 text-[13px] text-[var(--adm-text-2)]">
                {Icon && <Icon className={cn('h-4 w-4 shrink-0', iconTones[tone])} aria-hidden="true" />}
                {label}
            </p>
            <div className="mt-2 flex items-baseline gap-1.5">
                <span
                    className={cn(
                        'font-[family-name:var(--font-heading)] text-[28px] leading-none font-bold tabular-nums md:text-[32px]',
                        alert ? 'text-[var(--adm-danger)]' : 'text-[var(--adm-text)]',
                    )}
                >
                    {value}
                </span>
                {unit && <span className="text-sm text-[var(--adm-text-2)]">{unit}</span>}
            </div>
            {hint && <p className="mt-2 text-xs text-[var(--adm-text-3)]">{hint}</p>}
        </div>
    );
}

/** Pil berwarna lembut dengan titik di depan (badge Admin v2). */
function Pill({ tone, children }: { tone: 'danger' | 'warning' | 'info' | 'success' | 'neutral' | 'primary'; children: ReactNode }) {
    const styles: Record<string, string> = {
        danger: 'bg-[var(--adm-danger-soft)] text-[var(--adm-danger)]',
        warning: 'bg-[var(--adm-warning-soft)] text-[var(--adm-warning)]',
        info: 'bg-[var(--adm-info-soft)] text-[var(--adm-info)]',
        success: 'bg-[var(--adm-success-soft)] text-[var(--adm-success)]',
        neutral: 'bg-[#eef1f4] text-[var(--adm-text-2)]',
        primary: 'bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]',
    };
    return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', styles[tone])}>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
            {children}
        </span>
    );
}

export function StatusBadge({ value, label }: { value?: string | null; label?: string | null }) {
    const tones: Record<string, 'danger' | 'warning' | 'info' | 'success' | 'neutral' | 'primary'> = {
        baru: 'info',
        verifikasi: 'primary',
        diproses: 'warning',
        selesai: 'success',
        ditolak: 'danger',
    };
    return <Pill tone={tones[value ?? ''] ?? 'neutral'}>{label ?? value ?? '—'}</Pill>;
}

export function ImpactBadge({ value, label }: { value?: string | null; label?: string | null }) {
    const tones: Record<string, 'danger' | 'warning' | 'info' | 'success' | 'neutral' | 'primary'> = {
        rendah: 'neutral',
        sedang: 'info',
        tinggi: 'warning',
        kritis: 'danger',
    };
    return <Pill tone={tones[value ?? ''] ?? 'neutral'}>{label ?? value ?? '—'}</Pill>;
}
