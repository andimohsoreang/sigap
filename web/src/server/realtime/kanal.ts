import 'server-only';

// Registry kanal & event realtime, persis Laravel (laravel-baseline):
// - kanal & aturan izin: sigap/routes/channels.php;
// - event: sigap/app/Events/*.php (broadcastOn → kanal, broadcastAs → nama event, broadcastWith → data);
// - pendengar browser (Echo): `.chat.message` di pages/public/chat.tsx:224 & pages/admin/chat.tsx:253,
//   `.chat.unread` di hooks/use-chat-unread.ts:41, `.ticket.changed` & `.notification.incoming` di
//   components/sigap/notification-bell.tsx:70. Echo menambah awalan `private-` pada nama kanal privat.

/** Nama kanal di protokol Pusher (dengan awalan `private-`, seperti PrivateChannel Laravel). */
export const KANAL = {
    /** channels.php:21 `chat.{conversationId}` */
    chat: (conversationId: number) => `private-chat.${conversationId}`,
    /** channels.php:34 `admin.chat` */
    adminChat: () => 'private-admin.chat',
    /** channels.php:39 `user.{id}` */
    user: (id: number) => `private-user.${id}`,
} as const;

/** ChatService::present (sigap/app/Modules/ContactCenter/ChatService.php:359). Bentuk penuh dipastikan slice chat. */
export interface PesanChat {
    id: number;
    conversation_id: number;
    body: string | null;
    sender_type: string;
    mine: boolean;
    penulis: string;
    pada: string | null;
    [kunci: string]: unknown;
}

export interface PayloadEvent {
    /** ChatMessageSent → private-chat.{conversation_id} */
    'chat.message': PesanChat;
    /** ChatUnreadChanged → private-admin.chat. `total` dihitung saat disiarkan (ChatConversation::unreadForAdmins, outbox.ts). */
    'chat.unread': { conversation_id: number; total: number };
    /** TicketChanged → private-user.{id} tiap admin penerima */
    'ticket.changed': {
        event: string;
        nomor: string;
        judul: string;
        status: string | null;
        impact: string | null;
        is_internal: boolean;
        created_at: string | null;
    };
    /** NotificationBroadcast → private-user.{userId} */
    'notification.incoming': { event: string; title: string; body: string; meta: unknown; cta_url: string | null };
}

export type NamaEvent = keyof PayloadEvent;

export type Siaran<E extends NamaEvent = NamaEvent> = { [K in E]: { event: K; kanal: string[]; data: PayloadEvent[K] } }[E];

/**
 * Data yang ditulis ke outbox. Event yang broadcastWith-nya menghitung nilai saat disiarkan (setelah commit, di
 * queue Laravel) hanya membawa kuncinya; sisanya dilengkapi dispatcher tepat sebelum terbit (lihat outbox.ts).
 */
export interface DataTertunda {
    'chat.unread': { conversation_id: number };
}

export type SiaranOutbox =
    | Siaran<Exclude<NamaEvent, keyof DataTertunda>>
    | { [K in keyof DataTertunda]: { event: K; kanal: string[]; data: DataTertunda[K] } }[keyof DataTertunda];

/** Padanan konstruktor event Laravel (broadcastOn + broadcastAs + broadcastWith). */
export const siaran = {
    chatMessageSent: (pesan: PesanChat): Siaran<'chat.message'> => ({
        event: 'chat.message',
        kanal: [KANAL.chat(pesan.conversation_id)],
        data: pesan,
    }),
    /** `total` (ChatConversation::unreadForAdmins) dihitung dispatcher saat disiarkan, seperti Laravel. */
    chatUnreadChanged: (conversationId: number): Extract<SiaranOutbox, { event: 'chat.unread' }> => ({
        event: 'chat.unread',
        kanal: [KANAL.adminChat()],
        data: { conversation_id: conversationId },
    }),
    ticketChanged: (data: PayloadEvent['ticket.changed'], recipientIds: number[]): Siaran<'ticket.changed'> => ({
        event: 'ticket.changed',
        // array_values(array_unique(...)): urutan kemunculan pertama.
        kanal: [...new Set(recipientIds)].map(KANAL.user),
        data,
    }),
    notificationBroadcast: (
        userId: number,
        p: { event?: string; title?: string; body?: string; meta?: unknown; cta_url?: string | null },
    ): Siaran<'notification.incoming'> => ({
        event: 'notification.incoming',
        kanal: [KANAL.user(userId)],
        // NotificationBroadcast::broadcastWith: `??` PHP (null juga diganti nilai bawaan).
        data: {
            event: p.event ?? 'notifikasi',
            title: p.title ?? 'Contact Center — Notifikasi',
            body: p.body ?? '',
            meta: p.meta ?? [],
            cta_url: p.cta_url ?? null,
        },
    }),
};

/** Pengguna yang meminta izin kanal; `admin` = UserRole::isAdmin() (admin_kawasan, super_admin). */
export interface PenggunaKanal {
    id: number;
    admin: boolean;
}

/**
 * Aturan izin kanal privat (channels.php). TODO(paket F): pengguna dari sesi cc_session + endpoint
 * /broadcasting/auth (tanda tangan: tandaTanganKanal di ./penerbit). Tamu (null) selalu ditolak, seperti Laravel.
 * `pemilikChat` = ChatConversation where id & user_id exists (query DB, disuntik pemanggil).
 */
export async function bolehKanal(
    kanal: string,
    pengguna: PenggunaKanal | null,
    pemilikChat: (conversationId: number, userId: number) => Promise<boolean>,
): Promise<boolean> {
    if (!pengguna) return false;
    // Parameter kanal Laravel bertipe int: hanya angka yang diterima (lebih ketat dari cast (int) PHP, tanpa beda hasil
    // untuk kanal yang benar-benar disiarkan).
    const chat = /^private-chat\.(\d+)$/.exec(kanal);
    if (chat) return pengguna.admin || pemilikChat(Number(chat[1]), pengguna.id);
    if (kanal === KANAL.adminChat()) return pengguna.admin;
    const user = /^private-user\.(\d+)$/.exec(kanal);
    if (user) return Number(user[1]) === pengguna.id;
    return false;
}
