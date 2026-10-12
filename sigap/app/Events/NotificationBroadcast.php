<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Notifikasi in-app privat untuk satu pengguna (`user.{id}`) — D10.
 * Terpisah dari `TicketChanged` (lonceng admin) dan `ChatMessageSent`.
 */
class NotificationBroadcast implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public int $userId,
        public array $payload,
    ) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.'.$this->userId)];
    }

    public function broadcastAs(): string
    {
        return 'notification.incoming';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'event' => $this->payload['event'] ?? 'notifikasi',
            'title' => $this->payload['title'] ?? 'SIGAP — Notifikasi',
            'body' => $this->payload['body'] ?? '',
            'meta' => $this->payload['meta'] ?? [],
            'cta_url' => $this->payload['cta_url'] ?? null,
        ];
    }
}