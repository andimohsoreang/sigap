import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useEffect, useRef, useState } from 'react';

const POLL_MS = 30000;

export const CHAT_UNREAD_EVENT = 'sigap:chat-unread';

export interface ChatUnreadPayload {
    conversation_id: number;
    total: number;
}

/**
 * Jumlah pesan live chat yang belum dibaca petugas (badge merah "Pesan Masuk").
 *
 * - Nilai awal dari shared prop `chat_unread` (ikut diperbarui tiap navigasi Inertia).
 * - Realtime: kanal privat `admin.chat`, event `.chat.unread` → { total }.
 * - Cadangan: polling GET /admin/chat/belum-dibaca tiap 30 detik bila Reverb tidak aktif.
 */
export function useChatUnread(): number {
    const { auth, chat_unread } = usePage<SharedData>().props;
    const isAdmin = Boolean(auth?.user?.is_admin);
    const [count, setCount] = useState<number>(chat_unread ?? 0);
    const lastTotal = useRef<number>(chat_unread ?? 0);

    useEffect(() => {
        setCount(chat_unread ?? 0);
        lastTotal.current = chat_unread ?? 0;
    }, [chat_unread]);

    useEffect(() => {
        if (!isAdmin) return;

        let live = false;
        let cleanup: (() => void) | undefined;
        try {
            if (echoIsConfigured()) {
                echo()
                    .private('admin.chat')
                    .listen('.chat.unread', (p: ChatUnreadPayload) => {
                        lastTotal.current = Math.max(0, Number(p.total) || 0);
                        setCount(lastTotal.current);
                        // Halaman Pesan Masuk mendengarkan event ini untuk menyegarkan daftar
                        // (satu langganan kanal saja, dikelola layout).
                        window.dispatchEvent(new CustomEvent<ChatUnreadPayload>(CHAT_UNREAD_EVENT, { detail: p }));
                    });
                cleanup = () => echo().leave('admin.chat');
                live = true;
            }
        } catch {
            live = false;
        }

        // Polling tetap jalan (lebih jarang) sebagai jaring pengaman bila WS putus diam-diam.
        const timer = window.setInterval(
            async () => {
                if (document.visibilityState !== 'visible') return;
                try {
                    const res = await fetch('/admin/chat/belum-dibaca', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
                    if (!res.ok) return;
                    const total = ((await res.json()) as { total: number }).total ?? 0;
                    // Tanpa WebSocket: beri tahu halaman Pesan Masuk bila ada perubahan.
                    if (lastTotal.current !== total) {
                        window.dispatchEvent(new CustomEvent<ChatUnreadPayload>(CHAT_UNREAD_EVENT, { detail: { conversation_id: 0, total } }));
                    }
                    lastTotal.current = total;
                    setCount(total);
                } catch {
                    /* abaikan */
                }
            },
            live ? POLL_MS * 2 : POLL_MS,
        );

        return () => {
            cleanup?.();
            window.clearInterval(timer);
        };
    }, [isAdmin]);

    return count;
}
