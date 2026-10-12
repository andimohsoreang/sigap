<?php

namespace App\Events;

use App\Models\ChatConversation;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Total pesan chat yang belum dibaca petugas berubah (pesan masuk / dibaca).
 * Disiarkan ke kanal privat `admin.chat` (hanya admin) untuk badge merah
 * "Pesan Masuk" di sidebar & daftar percakapan yang realtime.
 */
class ChatUnreadChanged implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(public int $conversationId) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('admin.chat')];
    }

    public function broadcastAs(): string
    {
        return 'chat.unread';
    }

    /** @return array<string, int> */
    public function broadcastWith(): array
    {
        // Dihitung saat disiarkan (bukan saat dibuat) agar selalu nilai terbaru.
        return [
            'conversation_id' => $this->conversationId,
            'total' => ChatConversation::unreadForAdmins(),
        ];
    }
}
