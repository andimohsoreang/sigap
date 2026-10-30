<?php

namespace App\Modules\Assistant;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\KnowledgeArticle;
use App\Models\KnowledgePassage;
use App\Models\KnowledgeSource;
use App\Models\Portal;
use App\Services\Ai\PiiMasker;
use App\Services\ChatService;
use App\Services\ReferralService;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Mengubah {@see Decision} menjadi pesan TARA/sistem (PRD-AI FR-AI-05): teks
 * tetap dari lang/id/asisten.php, kartu sumber/portal/rujukan di meta.
 *
 * @phpstan-import-type Result from ResponsePolicy
 */
final class ReplyComposer
{
    public function __construct(
        private readonly ChatService $chat,
        private readonly PiiMasker $masker,
        private readonly ReferralService $referrals,
        private readonly Handoff $handoff,
    ) {}

    /**
     * @param  Result  $result
     * @param  Collection<int, KnowledgeArticle|KnowledgePassage>  $sources  sumber yang dikirim ke model
     * @return list<ChatMessage>
     */
    public function compose(Decision $decision, ChatConversation $conversation, string $question, array $result, Collection $sources, ?Portal $portal): array
    {
        $summary = $result['ringkasan'] !== '' ? $result['ringkasan'] : null;
        $first = $decision->answerFirst ? [$this->answer($conversation, $question, $result, $sources)] : [];

        return match ($decision->type) {
            Decision::HANDOFF => $this->handoff->to($conversation, (string) $decision->reason, $summary, $decision->notice === null ? null : AssistantText::get($decision->notice)),
            Decision::CONFLICT => [
                ...$first,
                $this->say($conversation, AssistantText::get('sumber_berbeda'), ['kind' => 'sumber_berbeda']),
                ...$this->handoff->to($conversation, 'sumber_berbeda', $summary),
            ],
            Decision::ASK_DETAILS => [$this->say($conversation, AssistantText::get('tanya_detail'), ['kind' => 'tanya_detail'])],
            Decision::REFER => [...$first, ...$this->refer($conversation, $portal, $summary ?? $this->masker->mask(Str::limit($question, 300)))],
            Decision::COMPLEX => [
                ...$first,
                $this->say($conversation, AssistantText::get('kompleks'), ['kind' => 'kompleks']),
                ...$this->handoff->to($conversation, 'kompleks', $summary),
            ],
            Decision::COMPLAINT => [
                ...$first,
                $this->say($conversation, AssistantText::get('aduan_diringkas')
                    .($summary ? "\n\n".AssistantText::get('aduan_ringkasan', ['ringkasan' => $summary]) : ''), ['kind' => 'ringkasan']),
                ...$this->handoff->to($conversation, 'aduan', $summary),
            ],
            // Ketentuan umumnya (bila ada sumbernya) tetap ditampilkan; kepastian
            // untuk kasus warga sendiri diserahkan ke petugas.
            Decision::PERSONAL => [
                ...$first,
                $this->say($conversation, AssistantText::get($decision->answerFirst ? 'pribadi_bersumber' : 'pribadi_tanpa_sumber'), ['kind' => 'pribadi']),
                ...$this->handoff->to($conversation, 'pribadi', $summary),
            ],
            Decision::UNCLEAR => [$this->say($conversation, AssistantText::get('tidak_jelas'), ['kind' => 'tidak_jelas'])],
            Decision::OUT_OF_SCOPE => [$this->say(
                $conversation,
                $result['jawaban'] !== '' ? $result['jawaban'] : AssistantText::get('di_luar_layanan'),
                ['kind' => 'lainnya'],
            )],
            default => [$this->answer($conversation, $question, $result, $sources, $portal)],
        };
    }

    /**
     * Jawaban bersumber. Tanpa sumber yang sah tidak ada jawaban: AI tidak
     * boleh menebak; yang tampil arahan tetap (kebijakan, portal, tidak tahu).
     *
     * @param  Result  $result
     * @param  Collection<int, KnowledgeArticle|KnowledgePassage>  $articles
     */
    public function answer(ChatConversation $conversation, string $question, array $result, Collection $articles, ?Portal $portal = null): ChatMessage
    {
        $sources = ResponsePolicy::cited($result, $articles);

        // Teks arahan tetap (bukan karangan AI); tetap dicatat sebagai
        // pertanyaan tak terjawab agar petugas dapat menyiapkan artikelnya.
        if (($sources->isEmpty() || $result['jawaban'] === '') && $result['kebijakan']) {
            return $this->say($conversation, AssistantText::get('kebijakan_tanpa_sumber'), [
                'kind' => 'tidak_tahu',
                'kebijakan' => true,
                'pertanyaan' => Str::limit($this->masker->mask($question), 200),
            ]);
        }

        if (($sources->isEmpty() || $result['jawaban'] === '') && $portal !== null) {
            // Katalog portal dikelola admin = sumber resmi untuk "layanan ini ada di mana".
            return $this->say($conversation, AssistantText::get('portal_tersedia', ['portal' => $portal->name, 'kegunaan' => (string) $portal->purpose]), [
                'kind' => 'jawaban',
                'portal' => $portal->card(),
            ]);
        }

        if ($sources->isEmpty() || $result['jawaban'] === '') {
            return $this->say(
                $conversation,
                AssistantText::get('tidak_tahu'),
                ['kind' => 'tidak_tahu', 'pertanyaan' => Str::limit($this->masker->mask($question), 200)],
            );
        }

        $articleIds = $sources->filter(fn ($s) => $s instanceof KnowledgeArticle)->pluck('id')->all();
        if ($articleIds !== []) {
            KnowledgeArticle::query()->whereKey($articleIds)->increment('used_count');
        }
        $sourceIds = $sources->filter(fn ($s) => $s instanceof KnowledgePassage)->pluck('knowledge_source_id')->unique()->all();
        if ($sourceIds !== []) {
            KnowledgeSource::query()->whereKey($sourceIds)->increment('used_count');
        }

        return $this->say($conversation, $result['jawaban'], [
            'kind' => 'jawaban',
            // Ditandai hanya bila memang ada lebih dari satu sumber yang dikutip.
            'beda_sumber' => $result['beda_sumber'] && $sources->count() > 1,
            // Pertanyaan kebijakan: widget menampilkan arahan ke PPID.
            'kebijakan' => $result['kebijakan'],
            'sumber' => $sources->map(fn (KnowledgeArticle|KnowledgePassage $s, int $no) => $s instanceof KnowledgePassage
                ? [
                    'no' => $no,
                    'jenis' => 'kutipan',
                    'kutipan_id' => $s->id,
                    'judul' => $s->displayTitle(),
                    'label' => $s->label(),
                    'url' => $s->link(),
                    'kutipan' => Str::limit(preg_replace('/\s+/u', ' ', $s->body), 280),
                    'diambil' => $s->source?->fetched_at?->toIso8601String(),
                ]
                : [
                    'no' => $no,
                    'jenis' => 'artikel',
                    'id' => $s->id,
                    'judul' => $s->title,
                    'label' => $s->sourceLabel(),
                    'url' => $s->source_url,
                ])->values()->all(),
            'portal' => $portal?->card(),
        ]);
    }

    /**
     * Rujuk ke portal dengan pengantar. Bila portal sedang tidak dapat
     * diakses, warga tidak disuruh ke sana: diteruskan ke petugas.
     *
     * @return list<ChatMessage>
     */
    private function refer(ChatConversation $conversation, Portal $portal, string $summary): array
    {
        if (! $portal->is_reachable) {
            return $this->handoff->to($conversation, 'portal_gangguan', $summary, AssistantText::get('portal_gangguan', ['portal' => $portal->name]));
        }

        // Sudah dirujuk ke portal yang sama: pesan baru dianggap kendala dan
        // diteruskan ke pendamping, bukan rujukan kedua.
        if ($existing = $this->referrals->openFor($conversation, $portal)) {
            return $this->referrals->requestHelp($existing, $summary);
        }

        $referral = $this->referrals->create($portal, $conversation, $summary);
        $pendamping = $referral->assignee ? Str::before($referral->assignee->name, ' ') : null;

        return [$this->say(
            $conversation,
            AssistantText::get('rujukan', ['portal' => $portal->name.($portal->managed_by ? " ({$portal->managed_by})" : '')])
                .($pendamping ? ' '.AssistantText::get('rujukan_pendamping', ['nama' => $pendamping]) : ''),
            [
                'kind' => 'rujukan',
                'portal' => $portal->card(),
                'rujukan' => [
                    'kode' => $referral->code,
                    'url' => $referral->publicUrl(),
                    'pendamping' => $pendamping,
                ],
            ],
        )];
    }

    /** @param  array<string, mixed>  $meta */
    public function say(ChatConversation $conversation, string $body, array $meta): ChatMessage
    {
        return $this->chat->send($conversation, $body, 'ai', null, $meta);
    }
}
