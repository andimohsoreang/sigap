<?php

namespace App\Events;

use App\Models\Ticket;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Notifikasi panel admin saat tiket baru dibuat atau statusnya berubah
 * (PRD D5). Disiarkan pada channel privat `admin.notifications`.
 */
class TicketChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Ticket $ticket,
        public string $event = 'updated',
    ) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('admin.notifications')];
    }

    public function broadcastAs(): string
    {
        return 'ticket.changed';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'event' => $this->event,
            'nomor' => $this->ticket->ticket_no,
            'judul' => $this->ticket->title,
            'status' => $this->ticket->status?->value,
            'impact' => $this->ticket->impact?->value,
            'is_internal' => (bool) $this->ticket->is_internal,
            'created_at' => $this->ticket->created_at?->toIso8601String(),
        ];
    }
}