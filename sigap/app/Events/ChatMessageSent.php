<?php

namespace App\Events;

use App\Models\ChatMessage;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Pesan chat baru (PRD D5 — Reverb).
 *
 * Kelas ini disiarkan oleh Reverb melalui channel privat `chat.{id}` baik ke
 * warga pemilik percakapan maupun ke panel admin. `ShouldBroadcastNow`
 * dipakai agar pesan langsung terkirim tanpa menunggu queue worker pada fase
 * ini (mudah ditukar menjadi ShouldBroadcast + worker saat produksi).
 */
class ChatMessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public ChatMessage $message) {}

    /** @return array<int, PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('chat.'.$this->message->conversation_id)];
    }

    public function broadcastAs(): string
    {
        return 'chat.message';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->message->id,
            'conversation_id' => $this->message->conversation_id,
            'body' => $this->message->body,
            'sender_type' => $this->message->sender_type,
            'sender_id' => $this->message->sender_id,
            'created_at' => $this->message->created_at?->toIso8601String(),
        ];
    }
}