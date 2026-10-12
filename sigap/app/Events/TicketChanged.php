<?php

namespace App\Events;

use App\Models\Ticket;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Notifikasi panel admin saat tiket baru dibuat atau statusnya berubah
 * (PRD D5).
 *
 * A-06: disiarkan lewat queue (ShouldBroadcast) SETELAH transaksi commit, ke
 * kanal privat per pengguna `user.{id}` milik admin yang berwenang atas tiket
 * (super admin + admin kawasan tiket) — bukan lagi kanal bersama
 * `admin.notifications` yang membocorkan tiket lintas kawasan.
 */
class TicketChanged implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param  array<int, int>  $recipientIds  id admin penerima
     */
    public function __construct(
        public Ticket $ticket,
        public string $event = 'updated',
        public array $recipientIds = [],
    ) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return array_map(
            fn (int $id) => new PrivateChannel('user.'.$id),
            array_values(array_unique($this->recipientIds)),
        );
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
