<?php

namespace App\Services;

use App\Events\ChatMessageSent;
use App\Models\ChatConversation;
use App\Models\ChatMessage;

/**
 * Logika bisnis live chat (PRD D5 — Reverb). Dipakai bersama oleh jalur Web
 * (Inertia) dan API sehingga pesan tersimpan & tersiar dengan aturan yang sama.
 */
class ChatService
{
    /** Simpan pesan dan siarkan ke channel privat percakapan. */
    public function send(
        ChatConversation $conversation,
        string $body,
        string $senderType,
        ?int $senderId = null,
    ): ChatMessage {
        $message = ChatMessage::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $senderId,
            'sender_type' => $senderType,
            'body' => $body,
        ]);

        $updates = ['last_message_at' => now()];

        if ($senderType === 'admin') {
            $updates['unread_user'] = $conversation->unread_user + 1;
        } else {
            $updates['unread_admin'] = $conversation->unread_admin + 1;
        }

        $conversation->update($updates);

        // Best-effort: pesan sudah tersimpan meski Reverb sedang mati (PRD D5).
        try {
            ChatMessageSent::dispatch($message);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Broadcast chat gagal: '.$e->getMessage());
        }

        return $message;
    }

    /** Ambil (atau buat) percakapan milik pengguna / tamu. */
    public function forParticipant(?int $userId, ?string $guestToken = null): ChatConversation
    {
        if ($userId !== null) {
            return ChatConversation::query()->firstOrCreate(
                ['user_id' => $userId],
                ['subject' => 'Live Chat', 'last_message_at' => now()],
            );
        }

        return ChatConversation::query()->firstOrCreate(
            ['guest_token' => $guestToken],
            ['subject' => 'Live Chat (Tamu)', 'last_message_at' => now()],
        );
    }

    /** @return array<int, array<string, mixed>> */
    public function messages(ChatConversation $conversation): array
    {
        return $conversation->messages()->with('sender')->get()->map(fn (ChatMessage $m) => [
            'id' => $m->id,
            'body' => $m->body,
            'sender_type' => $m->sender_type,
            'penulis' => $m->sender_type === 'admin' ? ($m->sender?->name ?? 'Admin SIGAP') : 'Anda',
            'pada' => $m->created_at?->toIso8601String(),
        ])->all();
    }
}