<?php

namespace App\Modules\Assistant;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Services\Ai\ServiceHours;
use App\Services\ChatService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Teruskan percakapan dari TARA ke petugas. Di luar jam layanan, warga diberi
 * nomor referensi dan diminta meninggalkan kontak.
 */
final class Handoff
{
    private const REFERENCE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

    public function __construct(
        private readonly ChatService $chat,
        private readonly ServiceHours $hours,
    ) {}

    /**
     * @param  string|null  $notice  pemberitahuan (teks jadi) sebelum pesan serah
     * @return list<ChatMessage>
     */
    public function to(ChatConversation $conversation, string $reason, ?string $summary = null, ?string $notice = null): array
    {
        if (! $conversation->isWithAssistant()) {
            return [];
        }

        $messages = [];
        if ($notice !== null) {
            $messages[] = $this->chat->send($conversation, $notice, 'system', null, ['kind' => 'info']);
        }

        $conversation->forceFill([
            'handled_by' => ChatConversation::HANDLED_STAFF,
            'handoff_at' => now(),
            'handoff_reason' => $reason,
            'ai_summary' => $summary ?? $this->fallbackSummary($conversation),
            'reference' => $conversation->reference ?? $this->newReference(),
        ])->save();

        $reference = $conversation->reference;

        $messages[] = $this->hours->isOpen()
            ? $this->chat->send($conversation, AssistantText::get('diteruskan'), 'system', null, [
                'kind' => 'diteruskan',
                'referensi' => $reference,
            ])
            : $this->chat->send($conversation, AssistantText::get('minta_kontak', ['jam' => $this->hours->label(), 'referensi' => $reference]), 'system', null, [
                'kind' => 'minta_kontak',
                'referensi' => $reference,
            ]);

        $this->chat->notifyStaff($conversation);

        return $messages;
    }

    private function fallbackSummary(ChatConversation $conversation): string
    {
        $last = $conversation->messages()->getQuery()
            ->whereIn('sender_type', ['user', 'guest'])
            ->reorder('id', 'desc')
            ->value('body');

        return 'Warga menulis: '.Str::limit((string) $last, 300);
    }

    private function newReference(): string
    {
        do {
            $suffix = '';
            for ($i = 0; $i < 4; $i++) {
                $suffix .= self::REFERENCE_ALPHABET[random_int(0, strlen(self::REFERENCE_ALPHABET) - 1)];
            }
            $reference = 'REF-'.Carbon::now('Asia/Jakarta')->format('ymd').'-'.$suffix;
        } while (ChatConversation::query()->where('reference', $reference)->exists());

        return $reference;
    }
}
