import { echo, echoIsConfigured } from '@laravel/echo-react';
import { router } from '@inertiajs/react';
import { Bell, CheckCheck, Ticket } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Lonceng notifikasi panel admin (PRD D5).
 *
 * Berlangganan kanal privat `admin.notifications` (Reverb). Setiap tiket baru
 * atau perubahan status menambah entri di daftar notifikasi secara real-time.
 */

interface TicketNotification {
    event: 'created' | 'status' | string;
    nomor: string;
    judul: string;
    status: string | null;
    impact: string | null;
    is_internal: boolean;
    created_at: string | null;
}

export default function NotificationBell() {
    const [items, setItems] = useState<TicketNotification[]>([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!echoIsConfigured()) return;

        let cleanup: (() => void) | undefined;

        try {
            const channel = echo().private('admin.notifications');
            channel.listen('.ticket.changed', (payload: TicketNotification) => {
                setItems((prev) => [payload, ...prev].slice(0, 20));
            });
            cleanup = () => echo().leave('admin.notifications');
        } catch {
            cleanup = undefined;
        }

        return () => cleanup?.();
    }, []);

    const unread = items.length;

    const viewTicket = (nomor: string) => {
        setOpen(false);
        router.visit(`/admin/tiket/${nomor}`);
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="relative text-gray-400 hover:text-primary dark:text-gray-300"
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
                    <div className="absolute right-0 z-50 mt-3 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-dark-card">
                        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                            <span className="text-sm font-bold text-gray-800 dark:text-white">Notifikasi Tiket</span>
                            {unread > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setItems([])}
                                    className="flex items-center gap-1 text-xs font-semibold text-brand-light hover:underline"
                                >
                                    <CheckCheck className="h-3.5 w-3.5" /> Tandai dibaca
                                </button>
                            )}
                        </div>

                        <div className="max-h-80 overflow-y-auto">
                            {items.length === 0 ? (
                                <p className="p-6 text-center text-xs text-gray-400">Belum ada notifikasi baru.</p>
                            ) : (
                                items.map((n, i) => (
                                    <button
                                        key={`${n.nomor}-${i}`}
                                        type="button"
                                        onClick={() => viewTicket(n.nomor)}
                                        className={cn(
                                            'flex w-full items-start gap-3 border-b border-gray-50 p-3 text-left transition hover:bg-gray-50 dark:border-gray-700/50 dark:hover:bg-gray-800',
                                        )}
                                    >
                                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary dark:bg-primary-light/20 dark:text-brand-light">
                                            <Ticket className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-xs font-bold text-gray-800 dark:text-white">
                                                {n.event === 'created' ? 'Tiket baru' : 'Status berubah'} · #{n.nomor}
                                            </p>
                                            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{n.judul}</p>
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