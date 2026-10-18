<?php

namespace App\Services\Ai;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\KnowledgeArticle;
use App\Models\Portal;
use App\Models\User;
use App\Services\ChatService;
use App\Services\Knowledge\KnowledgeRetriever;
use App\Services\PortalDirectory;
use App\Services\ReferralService;
use App\Services\TicketService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Asisten AI contact center.
 *
 * Satu pintu, dua jalan:
 * - Bisa dijawab dari Basis Pengetahuan → AI menjawab dengan sumber.
 * - Aduan, hak pribadi, diminta warga, sumber tidak ada, atau AI gagal →
 *   percakapan diteruskan ke petugas beserta ringkasan.
 *
 * Aturan tetap: AI tidak menerbitkan tiket, tidak memutuskan hak warga, dan
 * hanya menerima teks yang data pribadinya sudah disamarkan.
 */
class AssistantService
{
    private const TYPES = ['informasi', 'aduan', 'pribadi', 'tidak_jelas', 'lainnya'];

    private const REFERENCE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

    public function __construct(
        private readonly LlmClient $llm,
        private readonly KnowledgeRetriever $retriever,
        private readonly PiiMasker $masker,
        private readonly ChatService $chat,
        private readonly TicketService $tickets,
        private readonly ServiceHours $hours,
        private readonly PortalDirectory $portals,
        private readonly ReferralService $referrals,
    ) {}

    public static function enabled(): bool
    {
        return (bool) config('services.ai.enabled');
    }

    /**
     * Tanggapi pesan warga/tamu yang baru tersimpan.
     *
     * @return list<ChatMessage> pesan asisten/sistem yang dibuat (kosong bila
     *                           percakapan sudah ditangani petugas)
     */
    public function respond(ChatConversation $conversation, ChatMessage $incoming, ?User $viewer = null): array
    {
        if (! self::enabled() || ! $conversation->isWithAssistant()) {
            return [];
        }

        $text = trim($incoming->body);

        if ($ticketNo = $this->ticketNumber($text)) {
            return [$this->ticketStatus($conversation, $ticketNo, $viewer)];
        }

        $articles = $this->retriever->search($this->searchText($conversation, $text, $incoming->id));

        try {
            $result = $this->ask($conversation, $text, $articles, $incoming->id);
        } catch (AiException) {
            return $this->handoff($conversation, 'ai_gagal', null, 'Maaf, asisten sedang tidak dapat menjawab. Pesan Anda kami teruskan ke petugas.');
        }

        $summary = $result['ringkasan'] !== '' ? $result['ringkasan'] : null;

        if ($result['perlu_petugas']) {
            return $this->handoff($conversation, 'diminta', $summary);
        }

        // Aduan/urusan pribadi yang dilayani portal lain (mis. lahan → Trans
        // Tuntas): dirujuk dengan pengantar + petugas pendamping, bukan antre.
        $portal = $this->portals->find($result['portal']);
        if ($portal?->track_completion && in_array($result['jenis'], ['aduan', 'pribadi'], true)) {
            return $this->refer($conversation, $portal, $summary ?? $this->masker->mask(Str::limit($text, 300)));
        }

        return match ($result['jenis']) {
            'aduan' => [
                $this->say($conversation, 'Terima kasih. Laporan Anda saya ringkas untuk petugas agar bisa langsung ditindaklanjuti.'
                    .($summary ? "\n\nRingkasan: {$summary}" : ''), ['kind' => 'ringkasan']),
                ...$this->handoff($conversation, 'aduan', $summary),
            ],
            'pribadi' => [
                $this->say($conversation, 'Pertanyaan ini menyangkut data Anda pribadi, jadi perlu diperiksa langsung oleh petugas. Saya tidak dapat memastikannya.', ['kind' => 'pribadi']),
                ...$this->handoff($conversation, 'pribadi', $summary),
            ],
            'tidak_jelas' => [$this->say(
                $conversation,
                'Mohon maaf, saya belum dapat memahami pesan Bapak/Ibu dengan baik. Bisakah pertanyaannya disampaikan dalam Bahasa Indonesia? Bapak/Ibu juga dapat langsung berbicara dengan petugas.',
                ['kind' => 'tidak_jelas'],
            )],
            'lainnya' => [$this->say(
                $conversation,
                $result['jawaban'] !== '' ? $result['jawaban'] : 'Mohon maaf, saya hanya dapat membantu informasi seputar layanan Kementerian Transmigrasi.',
                ['kind' => 'lainnya'],
            )],
            default => [$this->answer($conversation, $text, $result, $articles, $portal)],
        };
    }

    /**
     * Teruskan percakapan ke petugas. Di luar jam layanan, warga diberi nomor
     * referensi dan diminta meninggalkan kontak.
     *
     * @return list<ChatMessage>
     */
    public function handoff(ChatConversation $conversation, string $reason, ?string $summary = null, ?string $notice = null): array
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
            ? $this->chat->send($conversation, 'Pesan Anda kami teruskan ke petugas beserta ringkasannya. Mohon tunggu, petugas akan membalas di percakapan ini.', 'system', null, [
                'kind' => 'diteruskan',
                'referensi' => $reference,
            ])
            : $this->chat->send($conversation, "Saat ini di luar jam layanan petugas ({$this->hours->label()}). Pesan Anda sudah kami catat dengan nomor referensi {$reference}. Tinggalkan nomor WhatsApp atau surel agar petugas dapat menghubungi Anda pada hari kerja berikutnya.", 'system', null, [
                'kind' => 'minta_kontak',
                'referensi' => $reference,
            ]);

        $this->chat->notifyStaff($conversation);

        return $messages;
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

    /** Catat penilaian warga atas jawaban AI dan teruskan ke statistik artikel. */
    public function recordFeedback(ChatMessage $message, bool $helpful): void
    {
        if ($message->feedback !== null) {
            return;
        }

        $message->forceFill(['feedback' => $helpful ? 1 : -1])->save();

        $ids = collect($message->meta['sumber'] ?? [])->pluck('id')->filter()->all();
        if ($ids !== []) {
            KnowledgeArticle::query()->whereKey($ids)->increment($helpful ? 'helpful_count' : 'unhelpful_count');
        }
    }

    /**
     * @param  array{jenis: string, jawaban: string, sumber: list<int>, portal: string|null, perlu_petugas: bool, ringkasan: string}  $result
     * @param  Collection<int, KnowledgeArticle>  $articles
     */
    private function answer(ChatConversation $conversation, string $question, array $result, Collection $articles, ?Portal $portal = null): ChatMessage
    {
        // Tanpa sumber yang sah, tidak ada jawaban: AI tidak boleh menebak.
        $sources = collect($result['sumber'])
            ->map(fn (int $no) => $articles->values()->get($no - 1))
            ->filter()
            ->unique('id')
            ->values();

        if (($sources->isEmpty() || $result['jawaban'] === '') && $portal !== null) {
            // Katalog portal dikelola admin = sumber resmi untuk "layanan ini ada di mana".
            return $this->say($conversation, "Layanan ini tersedia di {$portal->name}: {$portal->purpose}.", [
                'kind' => 'jawaban',
                'portal' => $portal->card(),
            ]);
        }

        if ($sources->isEmpty() || $result['jawaban'] === '') {
            return $this->say(
                $conversation,
                'Maaf, saya belum menemukan informasi resmi untuk pertanyaan tersebut, jadi saya tidak akan menebak. Anda dapat menanyakannya langsung ke petugas.',
                ['kind' => 'tidak_tahu', 'pertanyaan' => Str::limit($this->masker->mask($question), 200)],
            );
        }

        KnowledgeArticle::query()->whereKey($sources->pluck('id')->all())->increment('used_count');

        return $this->say($conversation, $result['jawaban'], [
            'kind' => 'jawaban',
            'sumber' => $sources->map(fn (KnowledgeArticle $a) => [
                'id' => $a->id,
                'judul' => $a->title,
                'label' => $a->sourceLabel(),
                'url' => $a->source_url,
            ])->all(),
            'portal' => $portal?->card(),
        ]);
    }

    /**
     * @param  Collection<int, KnowledgeArticle>  $articles
     * @return array{jenis: string, jawaban: string, sumber: list<int>, portal: string|null, perlu_petugas: bool, ringkasan: string}
     */
    private function ask(ChatConversation $conversation, string $question, Collection $articles, int $incomingId): array
    {
        $history = $conversation->messages()->getQuery()
            ->where('id', '<', $incomingId)
            ->reorder('id', 'desc')
            ->limit(6)
            ->get()
            ->reverse()
            ->map(fn (ChatMessage $m) => [
                'dari' => match ($m->sender_type) {
                    'user', 'guest' => 'warga',
                    'admin' => 'petugas',
                    default => 'asisten',
                },
                'isi' => $this->masker->mask(Str::limit($m->body, 400)),
            ])
            ->values()
            ->all();

        return $this->consult($question, $history, $articles);
    }

    /**
     * Satu panggilan model untuk satu pertanyaan (tanpa menyimpan apa pun).
     * Dipakai alur chat dan perintah `sigap:uji-asisten`.
     *
     * @param  list<array{dari: string, isi: string}>  $history
     * @param  Collection<int, KnowledgeArticle>  $articles
     * @return array{jenis: string, jawaban: string, sumber: list<int>, portal: string|null, perlu_petugas: bool, ringkasan: string}
     *
     * @throws AiException
     */
    public function consult(string $question, array $history, Collection $articles): array
    {
        $input = [
            'pertanyaan' => $this->masker->mask($question),
            'riwayat' => $history,
            'portal' => $this->portals->forAssistant($question),
            'sumber' => $articles->values()->map(fn (KnowledgeArticle $a, int $i) => [
                'no' => $i + 1,
                'judul' => $a->title,
                'isi' => Str::limit($a->body, 2500),
                'rujukan' => $a->sourceLabel(),
            ])->all(),
        ];

        $content = $this->llm->complete([
            ['role' => 'system', 'content' => Prompts::answer()],
            ['role' => 'user', 'content' => json_encode($input, JSON_UNESCAPED_UNICODE)],
        ], json: true);

        $data = Prompts::decodeJson($content) ?? throw new AiException('Balasan AI bukan JSON.');

        return [
            'jenis' => in_array($data['jenis'] ?? null, self::TYPES, true) ? $data['jenis'] : 'informasi',
            'jawaban' => trim((string) ($data['jawaban'] ?? '')),
            'sumber' => array_values(array_filter(array_map('intval', (array) ($data['sumber'] ?? [])))),
            'portal' => $this->portals->find(is_string($data['portal'] ?? null) ? $data['portal'] : null)?->code,
            'perlu_petugas' => (bool) ($data['perlu_petugas'] ?? false),
            'ringkasan' => Str::limit(trim((string) ($data['ringkasan'] ?? '')), 600),
        ];
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
            return $this->handoff($conversation, 'portal_gangguan', $summary, "{$portal->name} sedang tidak dapat diakses. Pesan Anda kami teruskan ke petugas agar tetap dapat dibantu.");
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
            "Masalah ini ditangani langsung oleh {$portal->name}".($portal->managed_by ? " ({$portal->managed_by})" : '').'. '
                .'Saya sudah menyiapkan pengantar berisi langkah, hal yang perlu disiapkan, dan ringkasan aduan Anda.'
                .($pendamping ? " {$pendamping} dari SIGAP mendampingi Anda sampai aduan tercatat." : ''),
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

    private function ticketStatus(ChatConversation $conversation, string $ticketNo, ?User $viewer): ChatMessage
    {
        $ticket = $this->tickets->findForPublicLookup($ticketNo, $viewer, ['category', 'region']);

        if ($ticket === null) {
            return $this->say(
                $conversation,
                "Tiket {$ticketNo} tidak ditemukan. Periksa kembali nomornya. Tiket bernomor format lama memerlukan kode akses di halaman Lacak Tiket.",
                ['kind' => 'info'],
            );
        }

        return $this->say($conversation, "Status tiket {$ticket->ticket_no}: {$ticket->status?->label()}.", [
            'kind' => 'status_tiket',
            'tiket' => [
                'nomor' => $ticket->ticket_no,
                'status' => $ticket->status?->value,
                'status_label' => $ticket->status?->label(),
                'kategori' => $ticket->category?->name,
                'kawasan' => $ticket->region?->name,
                'tenggat' => $ticket->sla_due_at?->toIso8601String(),
                'diperbarui' => $ticket->updated_at?->toIso8601String(),
                'url' => '/lacak/'.$ticket->ticket_no,
            ],
        ]);
    }

    private function ticketNumber(string $text): ?string
    {
        return preg_match('/\bTKT-(?:\d{6}-[A-Z0-9]{6}|\d{1,10})\b/i', $text, $m) ? strtoupper($m[0]) : null;
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

    private function say(ChatConversation $conversation, string $body, array $meta): ChatMessage
    {
        return $this->chat->send($conversation, $body, 'ai', null, $meta);
    }
}
