<?php

namespace App\Services;

use App\Events\ChatMessageSent;
use App\Events\ChatUnreadChanged;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

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

        // D-09: penambahan penghitung belum-dibaca secara atomik di SQL
        // (UPDATE ... SET unread = unread + 1) agar pesan bersamaan tidak hilang.
        ChatConversation::query()
            ->whereKey($conversation->getKey())
            ->increment($senderType === 'admin' ? 'unread_user' : 'unread_admin', 1, [
                'last_message_at' => now(),
            ]);

        $conversation->refresh();

        // Best-effort: pesan sudah tersimpan meski Reverb sedang mati (PRD D5).
        $this->broadcast(new ChatMessageSent($message));
        if ($senderType !== 'admin') {
            $this->broadcast(new ChatUnreadChanged($conversation->id));
        }

        return $message;
    }

    /** Petugas membuka percakapan: nolkan penghitung & tandai pesan warga/tamu dibaca. */
    public function markReadByAdmin(ChatConversation $conversation): void
    {
        $changed = ChatConversation::query()
            ->whereKey($conversation->getKey())
            ->where('unread_admin', '>', 0)
            ->update(['unread_admin' => 0]);

        $conversation->messages()->getQuery()
            ->where('sender_type', '!=', 'admin')
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        if ($changed > 0) {
            $this->broadcast(new ChatUnreadChanged($conversation->id));
        }
    }

    /** Warga/tamu membuka widget: tandai balasan petugas sudah dibaca. */
    public function markReadByParticipant(ChatConversation $conversation): void
    {
        if ($conversation->unread_user > 0) {
            ChatConversation::query()->whereKey($conversation->getKey())->update(['unread_user' => 0]);
            $conversation->unread_user = 0;
        }

        $conversation->messages()->getQuery()
            ->where('sender_type', 'admin')
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
    }

    /** Ambil percakapan milik pengguna login (dibuat bila belum ada). */
    public function forUser(int $userId): ChatConversation
    {
        return ChatConversation::query()->firstOrCreate(
            ['user_id' => $userId],
            ['subject' => 'Live Chat', 'last_message_at' => now()],
        );
    }

    /** Percakapan tamu berdasarkan token sesi (null bila belum mulai). */
    public function forGuest(?string $guestToken): ?ChatConversation
    {
        if (! $guestToken) {
            return null;
        }

        return ChatConversation::query()->where('guest_token', $guestToken)->whereNull('user_id')->first();
    }

    /** Mulai/ubah identitas percakapan tamu. */
    public function startGuest(string $guestToken, string $name): ChatConversation
    {
        $conversation = ChatConversation::query()->firstOrNew(['guest_token' => $guestToken]);
        $conversation->fill([
            'guest_name' => $name,
            'subject' => 'Live Chat (Tamu)',
        ]);
        $conversation->last_message_at ??= now();
        $conversation->save();

        return $conversation;
    }

    /**
     * Tamu yang kemudian login: riwayat chat tamu digabung ke percakapan akunnya
     * sehingga tidak hilang dan petugas melihat satu utas atas nama warga.
     */
    public function adoptGuestConversation(?string $guestToken, int $userId): void
    {
        $guest = $this->forGuest($guestToken);
        if (! $guest) {
            return;
        }

        DB::transaction(function () use ($guest, $userId): void {
            $own = ChatConversation::query()->where('user_id', $userId)->lockForUpdate()->first();

            if (! $own) {
                $guest->forceFill(['user_id' => $userId, 'guest_token' => null, 'subject' => 'Live Chat'])->save();

                return;
            }

            $guest->messages()->getQuery()->update(['conversation_id' => $own->id]);
            ChatConversation::query()->whereKey($own->id)->update([
                'unread_admin' => DB::raw('unread_admin + '.(int) $guest->unread_admin),
                'unread_user' => DB::raw('unread_user + '.(int) $guest->unread_user),
                'last_message_at' => max($own->last_message_at, $guest->last_message_at) ?? now(),
            ]);
            $guest->delete();
        });
    }

    /**
     * Pesan untuk widget warga/tamu. `mine` = pesan milik penanya (tampil di kanan).
     *
     * @return array<int, array<string, mixed>>
     */
    public function messages(ChatConversation $conversation): array
    {
        return $conversation->messages()->with('sender')->get()
            ->map(fn (ChatMessage $m) => self::present($m))
            ->all();
    }

    /** Bentuk pesan yang sama untuk respons HTTP & payload broadcast. */
    public static function present(ChatMessage $m): array
    {
        $fromStaff = in_array($m->sender_type, ['admin', 'system'], true);

        return [
            'id' => $m->id,
            'conversation_id' => $m->conversation_id,
            'body' => $m->body,
            'sender_type' => $m->sender_type,
            'mine' => ! $fromStaff,
            'penulis' => $m->sender_type === 'admin' ? ($m->sender?->name ?? 'Petugas SIGAP') : 'Anda',
            'pada' => $m->created_at?->toIso8601String(),
        ];
    }

    private function broadcast(object $event): void
    {
        try {
            event($event);
        } catch (\Throwable $e) {
            Log::warning('Broadcast chat gagal: '.$e->getMessage());
        }
    }
}
