<?php

namespace App\Jobs;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\User;
use App\Modules\Assistant\Assistant;
use App\Modules\Assistant\AssistantText;
use App\Services\Ai\AssistantService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Cache;
use Throwable;

/**
 * Jawaban TARA untuk satu pesan warga, di antrean `ai` (PRD-AI FR-AI-04).
 *
 * - idempoten per pesan (kunci unik + penanda sudah dijawab);
 * - berurutan per percakapan (WithoutOverlapping);
 * - dilewati bila ada pesan warga yang lebih baru (job pesan itu menjawab
 *   dengan riwayat lengkap), bila petugas sudah mengambil percakapan, atau
 *   bila penanda menunggu sudah dibersihkan (mis. dinyatakan macet);
 * - gagal → percakapan diserahkan ke petugas dengan pesan `ai_gagal`.
 *
 * Balasan dikirim lewat ChatService::send() sehingga disiarkan Reverb;
 * tanpa Reverb, widget mendapatkannya lewat polling GET /chat/pesan.
 */
final class RespondToMessage implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    /** Pelepasan ulang oleh WithoutOverlapping dihitung percobaan; galat tetap sekali. */
    public int $tries = 20;

    public int $maxExceptions = 1;

    /**
     * Penyedia menggantung → worker menghentikan job pada batas ini dan, karena
     * failOnTimeout, memanggil failed() sehingga warga langsung diserahkan ke
     * petugas (tidak menunggu sigap:ai-macet). AI_TIMEOUT × 2 + jeda < nilai ini.
     */
    public int $timeout = 60;

    public bool $failOnTimeout = true;

    public int $uniqueFor = 600;

    public function __construct(
        public readonly int $conversationId,
        public readonly int $messageId,
    ) {
        $this->onQueue((string) config('services.ai.queue', 'ai'));
    }

    public function uniqueId(): string
    {
        return (string) $this->messageId;
    }

    /** @return list<object> */
    public function middleware(): array
    {
        return [(new WithoutOverlapping('percakapan:'.$this->conversationId))->releaseAfter(2)->expireAfter(90)];
    }

    public function handle(AssistantService $assistant): void
    {
        [$conversation, $message] = $this->load();
        if ($conversation === null || $message === null) {
            return;
        }
        if (! Cache::add('ai:dijawab:'.$this->messageId, true, now()->addDay())) {
            return;
        }

        try {
            if ($conversation->ai_pending_at === null || $this->hasNewerCitizenMessage($conversation) || $this->takenByStaff($conversation)) {
                return;
            }

            $viewer = $conversation->user_id !== null ? User::query()->find($conversation->user_id) : null;
            $assistant->respond($conversation, $message, $viewer);
        } finally {
            $this->clearPending($conversation->refresh());
        }
    }

    public function failed(?Throwable $e): void
    {
        [$conversation] = $this->load();
        if ($conversation === null) {
            return;
        }

        app(Assistant::class)->handoff($conversation, 'ai_gagal', null, AssistantText::get('ai_gagal'));
        $this->clearPending($conversation->refresh());
    }

    /** @return array{0: ChatConversation|null, 1: ChatMessage|null} */
    private function load(): array
    {
        $conversation = ChatConversation::query()->find($this->conversationId);
        $message = ChatMessage::query()->find($this->messageId);

        return $message !== null && $message->conversation_id === $this->conversationId ? [$conversation, $message] : [$conversation, null];
    }

    private function hasNewerCitizenMessage(ChatConversation $conversation): bool
    {
        return $conversation->messages()->getQuery()
            ->whereIn('sender_type', ['user', 'guest'])
            ->where('id', '>', $this->messageId)
            ->exists();
    }

    private function takenByStaff(ChatConversation $conversation): bool
    {
        return ! $conversation->isWithAssistant() && $conversation->assigned_to !== null;
    }

    /** Penanda dibersihkan hanya bila tidak ada pesan lebih baru yang masih menunggu. */
    private function clearPending(ChatConversation $conversation): void
    {
        if ($conversation->ai_pending_at !== null && ! $this->hasNewerCitizenMessage($conversation)) {
            $conversation->forceFill(['ai_pending_at' => null])->save();
        }
    }
}
