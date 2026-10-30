<?php

namespace App\Modules\Assistant;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\KnowledgeArticle;
use App\Models\User;
use App\Services\Ai\AiException;
use App\Services\Ai\ServiceHours;
use App\Services\Knowledge\KnowledgeRetriever;
use App\Services\PortalDirectory;

/**
 * Asisten AI contact center (TARA) — pintu masuk modul Assistant.
 *
 * Satu pintu, dua jalan:
 * - Bisa dijawab dari Basis Pengetahuan (artikel terbit) atau Sumber Resmi
 *   (kutipan situs & berkas resmi Kementerian) → AI menjawab dengan sumber.
 * - Aduan, hak pribadi, diminta warga, sumber tidak ada, atau AI gagal →
 *   percakapan diteruskan ke petugas beserta ringkasan.
 *
 * Aturan tetap: AI tidak menerbitkan tiket, tidak memutuskan hak warga, dan
 * hanya menerima teks yang data pribadinya sudah disamarkan. Alurnya:
 * {@see Consultation} → {@see ResponsePolicy} → {@see ReplyComposer}.
 */
final class Assistant
{
    /** Petugas dianggap sedang menangani percakapan bila membalas dalam rentang ini. */
    private const STAFF_ACTIVE_MINUTES = 30;

    public function __construct(
        private readonly Consultation $consultation,
        private readonly ResponsePolicy $policy,
        private readonly ReplyComposer $composer,
        private readonly Handoff $handoff,
        private readonly KnowledgeRetriever $retriever,
        private readonly PortalDirectory $portals,
        private readonly TicketLookup $tickets,
        private readonly ServiceHours $hours,
    ) {}

    public static function enabled(): bool
    {
        return (bool) config('services.ai.enabled');
    }

    /**
     * Apakah {@see respond()} untuk pesan ini akan memanggil model? Bila tidak
     * (AI mati, nomor tiket, petugas sedang aktif, balasan pendek saat menunggu
     * petugas), jawaban dibuat sinkron; bila ya, boleh lewat antrean `ai`
     * (PRD-AI FR-AI-04). Kondisinya sama persis dengan cabang awal respond().
     */
    public function needsModel(ChatConversation $conversation, ChatMessage $incoming): bool
    {
        if (! self::enabled()) {
            return false;
        }

        $text = trim($incoming->body);
        if ($this->tickets->numberIn($text) !== null) {
            return false;
        }

        if (! $conversation->isWithAssistant()) {
            return ! $conversation->isClosed()
                && ! $this->staffActive($conversation)
                && count($this->retriever->terms($text)) >= 2;
        }

        return true;
    }

    /**
     * Tanggapi pesan warga/tamu yang baru tersimpan.
     *
     * @return list<ChatMessage> pesan asisten/sistem yang dibuat (kosong bila
     *                           percakapan sudah ditangani petugas)
     */
    public function respond(ChatConversation $conversation, ChatMessage $incoming, ?User $viewer = null): array
    {
        if (! self::enabled()) {
            return [];
        }

        if (! $conversation->isWithAssistant()) {
            return $this->answerWhileWaiting($conversation, $incoming, $viewer);
        }

        $text = trim($incoming->body);
        if ($ticketNo = $this->tickets->numberIn($text)) {
            return [$this->tickets->reply($conversation, $ticketNo, $viewer)];
        }

        $query = $this->searchText($conversation, $text, $incoming->id);
        $articles = $this->retriever->sources($query);

        try {
            $result = $this->consultation->consult($text, $this->consultation->history($conversation, $incoming->id), $articles, $conversation->id);
        } catch (AiException) {
            return $this->handoff->to($conversation, 'ai_gagal', null, AssistantText::get('ai_gagal'));
        }

        $portal = $this->portals->find($result['portal']);
        $decision = $this->policy->decide($result, ResponsePolicy::cited($result, $articles), $portal, count($this->retriever->terms($query)));

        return $this->composer->compose($decision, $conversation, $text, $result, $articles, $portal);
    }

    /**
     * Selama petugas tidak sedang aktif membalas (belum membalas, atau balasan
     * terakhirnya sudah lama, mis. di luar jam layanan), pertanyaan yang ada di
     * sumber resmi tetap dijawab TARA; penelaahan kasusnya sudah di antrean
     * petugas. Pesan lain diberi tanda terima agar warga tidak merasa diabaikan.
     *
     * @return list<ChatMessage>
     */
    private function answerWhileWaiting(ChatConversation $conversation, ChatMessage $incoming, ?User $viewer): array
    {
        if ($conversation->isClosed() || $this->staffActive($conversation)) {
            return [];
        }

        $text = trim($incoming->body);
        if ($ticketNo = $this->tickets->numberIn($text)) {
            return [$this->tickets->reply($conversation, $ticketNo, $viewer)];
        }

        // Balasan pendek ("baik", "terima kasih", nomor HP) ditujukan ke petugas.
        if (count($this->retriever->terms($text)) >= 2) {
            $articles = $this->retriever->sources($text);
            try {
                $result = $this->consultation->consult($text, $this->consultation->history($conversation, $incoming->id), $articles, $conversation->id);
                $decision = $this->policy->decideWhileWaiting($result, ResponsePolicy::cited($result, $articles));
                if ($decision->type !== Decision::RECEIPT) {
                    return $this->composer->compose($decision, $conversation, $text, $result, $articles, null);
                }
            } catch (AiException) {
                // Tetap beri tanda terima di bawah.
            }
        }

        return $this->waitingNotice($conversation, $incoming->id);
    }

    /** @return list<ChatMessage> */
    public function handoff(ChatConversation $conversation, string $reason, ?string $summary = null, ?string $notice = null): array
    {
        return $this->handoff->to($conversation, $reason, $summary, $notice);
    }

    /** Percakapan yang sudah ditutup dibuka lagi saat warga menulis pesan baru. */
    public function reopenIfClosed(ChatConversation $conversation): void
    {
        if (! $conversation->isClosed()) {
            return;
        }

        $conversation->forceFill([
            'handled_by' => self::enabled() ? ChatConversation::HANDLED_AI : ChatConversation::HANDLED_STAFF,
            'outcome' => null,
            'closed_at' => null,
            'closed_by' => null,
            'handoff_at' => null,
            'handoff_reason' => null,
            'ai_summary' => null,
            'reference' => null,
            'assigned_to' => null,
            'ticket_id' => null,
        ])->save();
    }

    public function recordFeedback(ChatMessage $message, bool $helpful): void
    {
        if ($message->feedback !== null) {
            return;
        }

        $message->forceFill(['feedback' => $helpful ? 1 : -1])->save();

        // Hanya artikel yang punya statistik penilaian; kutipan tidak.
        $ids = collect($message->meta['sumber'] ?? [])->reject(fn ($s) => ($s['jenis'] ?? 'artikel') !== 'artikel')->pluck('id')->filter()->all();
        if ($ids !== []) {
            KnowledgeArticle::query()->whereKey($ids)->increment($helpful ? 'helpful_count' : 'unhelpful_count');
        }
    }

    /** Petugas membalas dalam {@see STAFF_ACTIVE_MINUTES} menit terakhir. */
    private function staffActive(ChatConversation $conversation): bool
    {
        return $conversation->messages()->getQuery()
            ->where('sender_type', 'admin')
            ->where('created_at', '>=', now()->subMinutes(self::STAFF_ACTIVE_MINUTES))
            ->exists();
    }

    /**
     * Tanda terima tidak diulang bila balasan terakhir dari sisi layanan sudah
     * berupa tanda terima yang sama.
     *
     * @return list<ChatMessage>
     */
    private function waitingNotice(ChatConversation $conversation, int $incomingId): array
    {
        $lastKind = $conversation->messages()->getQuery()
            ->whereIn('sender_type', ['ai', 'system'])
            ->where('id', '<', $incomingId)
            ->reorder('id', 'desc')
            ->first()?->meta['kind'] ?? null;

        if ($lastKind === 'menunggu_petugas') {
            return [];
        }

        $body = $this->hours->isOpen()
            ? AssistantText::get('menunggu_petugas')
            : AssistantText::get('menunggu_petugas_luar_jam', ['jam' => $this->hours->label()]);

        return [$this->composer->say($conversation, $body, ['kind' => 'menunggu_petugas'])];
    }

    /** Pertanyaan lanjutan pendek ("berapa lama?") dicari bersama pertanyaan sebelumnya. */
    private function searchText(ChatConversation $conversation, string $text, int $incomingId): string
    {
        if (count($this->retriever->terms($text)) >= 2) {
            return $text;
        }

        $previous = $conversation->messages()->getQuery()
            ->whereIn('sender_type', ['user', 'guest'])
            ->where('id', '<', $incomingId)
            ->reorder('id', 'desc')
            ->value('body');

        return trim(($previous ?? '').' '.$text);
    }
}
