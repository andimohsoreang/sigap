import { cn } from '@/lib/utils';
import type { SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { Bell, CheckCheck, Ticket } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Lonceng notifikasi panel admin (PRD D5/D10).
 *
 * Berlangganan kanal privat per pengguna `user.{id}` (Reverb) dan mendengarkan
 * dua event:
 *  - `.ticket.changed`         → tiket baru / perubahan status (TicketChanged)
 *  - `.notification.incoming`  → notifikasi in-app umum (NotificationBroadcast)
 */

/** Payload TicketChanged::broadcastWith(). */
interface TicketChangedPayload {
    event: 'created' | 'status' | string;
    nomor: string;
    judul: string;
    status: string | null;
    impact: string | null;
    is_internal: boolean;
    created_at: string | null;
}

/** Payload NotificationBroadcast::broadcastWith(). */
interface IncomingNotificationPayload {
    event: string;
    title: string;
    body: string;
    meta: Record<string, unknown> | unknown[];
    cta_url: string | null;
}

interface BellItem {
    key: string;
    title: string;
    subtitle: string;
    url: string | null;
}

/** Hanya izinkan tautan relatif same-origin untuk navigasi. */
function safeInternalUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        const parsed = new URL(url, window.location.origin);
        if (parsed.origin !== window.location.origin) return null;
        return parsed.pathname + parsed.search + parsed.hash;
    } catch {
        return null;
    }
}

export default function NotificationBell() {
    const { auth } = usePage<SharedData>().props;
    const userId = auth?.user?.id ?? null;
    const [items, setItems] = useState<BellItem[]>([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!userId || !echoIsConfigured()) return;

        const channelName = `user.${userId}`;
        const push = (item: BellItem) => setItems((prev) => [item, ...prev].slice(0, 20));
        let cleanup: (() => void) | undefined;

        try {
            const channel = echo().private(channelName);
            channel.listen('.ticket.changed', (p: TicketChangedPayload) => {
                push({
                    key: `t-${p.nomor}-${Date.now()}`,
                    title: `${p.event === 'created' ? 'Tiket baru' : 'Status berubah'} · #${p.nomor}`,
                    subtitle: p.judul,
                    url: `/admin/tiket/${encodeURIComponent(p.nomor)}`,
                });
            });
            channel.listen('.notification.incoming', (p: IncomingNotificationPayload) => {
                push({
                    key: `n-${p.event}-${Date.now()}`,
                    title: p.title,
                    subtitle: p.body,
                    url: safeInternalUrl(p.cta_url),
                });
            });
            cleanup = () => echo().leave(channelName);
        } catch {
            cleanup = undefined;
        }

        return () => cleanup?.();
    }, [userId]);

    const unread = items.length;

    const openItem = (item: BellItem) => {
        setOpen(false);
        if (item.url) router.visit(item.url);
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="hover:text-primary relative text-gray-400 dark:text-gray-300"
                aria-label={`Notifikasi${unread ? ` (${unread} baru)` : ''}`}
                aria-expanded={open}
            >
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
                    <div className="dark:bg-dark-card absolute right-0 z-50 mt-3 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700">
                        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                            <span className="text-sm font-bold text-gray-800 dark:text-white">Notifikasi</span>
                            {unread > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setItems([])}
                                    className="text-brand-light flex items-center gap-1 text-xs font-semibold hover:underline"
                                >
                                    <CheckCheck className="h-3.5 w-3.5" /> Tandai dibaca
                                </button>
                            )}
                        </div>

                        <div className="max-h-80 overflow-y-auto">
                            {items.length === 0 ? (
                                <p className="p-6 text-center text-xs text-gray-400">Belum ada notifikasi baru.</p>
                            ) : (
                                items.map((n) => (
                                    <button
                                        key={n.key}
                                        type="button"
                                        onClick={() => openItem(n)}
                                        className={cn(
                                            'flex w-full items-start gap-3 border-b border-gray-50 p-3 text-left transition hover:bg-gray-50 dark:border-gray-700/50 dark:hover:bg-gray-800',
                                        )}
                                    >
                                        <div className="bg-brand-soft text-primary dark:bg-primary-light/20 dark:text-brand-light mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                                            <Ticket className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-xs font-bold text-gray-800 dark:text-white">{n.title}</p>
                                            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{n.subtitle}</p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
