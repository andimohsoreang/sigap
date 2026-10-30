<?php

namespace App\Services\Ai;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\KnowledgeArticle;
use App\Models\KnowledgePassage;
use App\Models\User;
use App\Modules\Assistant\Assistant;
use App\Modules\Assistant\Consultation;
use App\Modules\Assistant\ResponsePolicy;
use Illuminate\Support\Collection;

/**
 * Pintu sementara ke modul Assistant (PRD-AI Tahap 3). Seluruh logika ada di
 * `App\Modules\Assistant`; kelas ini hanya meneruskan agar pemanggil dan tes
 * lama tetap bekerja tanpa diubah. Dihapus setelah semua pemakainya pindah.
 *
 * @deprecated pakai {@see Assistant}, {@see Consultation}, {@see ResponsePolicy}
 */
class AssistantService
{
    public function __construct(
        private readonly Assistant $assistant,
        private readonly Consultation $consultation,
        private readonly ResponsePolicy $policy,
    ) {}

    public static function enabled(): bool
    {
        return Assistant::enabled();
    }

    public function needsModel(ChatConversation $conversation, ChatMessage $incoming): bool
    {
        return $this->assistant->needsModel($conversation, $incoming);
    }

    /** @return list<ChatMessage> */
    public function respond(ChatConversation $conversation, ChatMessage $incoming, ?User $viewer = null): array
    {
        return $this->assistant->respond($conversation, $incoming, $viewer);
    }

    /** @return list<ChatMessage> */
    public function handoff(ChatConversation $conversation, string $reason, ?string $summary = null, ?string $notice = null): array
    {
        return $this->assistant->handoff($conversation, $reason, $summary, $notice);
    }

    public function reopenIfClosed(ChatConversation $conversation): void
    {
        $this->assistant->reopenIfClosed($conversation);
    }

    public function recordFeedback(ChatMessage $message, bool $helpful): void
    {
        $this->assistant->recordFeedback($message, $helpful);
    }

    /**
     * @param  list<array{dari: string, isi: string}>  $history
     * @param  Collection<int, KnowledgeArticle|KnowledgePassage>  $articles
     * @return array<string, mixed>
     *
     * @throws AiException
     */
    public function consult(string $question, array $history, Collection $articles, ?int $conversationId = null): array
    {
        return $this->consultation->consult($question, $history, $articles, $conversationId);
    }

    /** @param  Collection<int, KnowledgeArticle|KnowledgePassage>  $sources */
    public static function basisDecides(Collection $sources): bool
    {
        return ResponsePolicy::basisDecides($sources);
    }

    /**
     * @param  array{sumber: list<int>, beda_sumber: bool, perlu_petugas: bool, alasan_petugas: string|null}  $result
     * @param  Collection<int, KnowledgeArticle|KnowledgePassage>  $articles
     */
    public function unresolvedConflict(array $result, Collection $articles): bool
    {
        return $this->policy->unresolvedConflict($result, ResponsePolicy::cited($result, $articles));
    }
}
