<?php

namespace App\Modules\Assistant;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\KnowledgeArticle;
use App\Models\KnowledgePassage;
use App\Models\KnowledgeSource;
use App\Modules\Ai\AiContext;
use App\Modules\Ai\AiGateway;
use App\Modules\Ai\AiResult;
use App\Modules\Ai\AiTask;
use App\Modules\Ai\NumberGuard;
use App\Services\Ai\AiException;
use App\Services\PortalDirectory;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Satu konsultasi model untuk satu pertanyaan (PRD-AI FR-AI-05): menyusun
 * masukan (pertanyaan, riwayat, portal, sumber berlabel dasar hukum),
 * memanggil Gateway tugas Jawab, lalu menjalankan pengaman angka (FR-AI-12).
 * Tidak menyimpan pesan apa pun; dipakai alur chat dan `sigap:uji-asisten`.
 *
 * @phpstan-import-type Result from ResponsePolicy
 */
final class Consultation
{
    private const TYPES = ['informasi', 'aduan', 'pribadi', 'tidak_jelas', 'lainnya'];

    public function __construct(
        private readonly AiGateway $gateway,
        private readonly PortalDirectory $portals,
    ) {}

    /**
     * Enam pesan terakhir sebelum pesan warga ini, untuk konteks model.
     *
     * @return list<array{dari: string, isi: string}>
     */
    public function history(ChatConversation $conversation, int $incomingId): array
    {
        return $conversation->messages()->getQuery()
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
                'isi' => Str::limit($m->body, 400),
            ])
            ->values()
            ->all();
    }

    /**
     * @param  list<array{dari: string, isi: string}>  $history
     * @param  Collection<int, KnowledgeArticle|KnowledgePassage>  $articles
     * @return Result
     *
     * @throws AiException
     */
    public function consult(string $question, array $history, Collection $articles, ?int $conversationId = null): array
    {
        // Penyamaran teks warga dilakukan AiGateway (PRD-AI FR-AI-10).
        $input = [
            'pertanyaan' => $question,
            'riwayat' => $history,
            'portal' => $this->portals->forAssistant($question),
            'sumber' => $articles->values()->map(fn (KnowledgeArticle|KnowledgePassage $s, int $i) => $s instanceof KnowledgePassage
                ? [
                    'no' => $i + 1,
                    'jenis' => 'kutipan',
                    'judul' => $s->displayTitle(),
                    'isi' => Str::limit($s->body, 1500),
                    'rujukan' => $s->label(),
                    // Label dasar hukum Sumber Resmi (PRD-AI FR-AI-11).
                    'dasar' => $s->source?->legalBasisLabel() ?? (new KnowledgeSource)->legalBasisLabel(),
                ]
                : [
                    'no' => $i + 1,
                    'jenis' => 'artikel',
                    'judul' => $s->title,
                    'isi' => Str::limit($s->body, 2500),
                    'rujukan' => $s->sourceLabel(),
                    'dasar' => $s->legalBasisLabel(),
                ])->all(),
        ];

        $result = $this->gateway->run(AiTask::Jawab, $input, AiContext::conversation($conversationId));
        if (! $result->isOk()) {
            // Jalur cadangan tetap sama: pemanggil menyerahkan ke petugas (ai_gagal).
            throw new AiException($result->status === AiResult::FALLBACK ? 'Balasan AI bukan JSON.' : 'Model AI tidak dapat dipakai.', $result->reason);
        }
        $data = $result->data;

        $type = in_array($data['jenis'] ?? null, self::TYPES, true) ? $data['jenis'] : 'informasi';
        $answer = trim((string) ($data['jawaban'] ?? ''));
        $cited = array_values(array_filter(array_map('intval', (array) ($data['sumber'] ?? []))));

        // Pengaman angka (FR-AI-12): dasar = teks sumber yang dikutip persis
        // seperti dikirim (judul, isi, rujukan, label dasar hukum) + pesan warga.
        $basis = [$question, ...collect($history)->where('dari', 'warga')->pluck('isi')->all()];
        foreach (array_unique($cited) as $no) {
            if (isset($input['sumber'][$no - 1])) {
                $basis[] = implode("\n", Arr::only($input['sumber'][$no - 1], ['judul', 'isi', 'rujukan', 'dasar']));
            }
        }
        $unsupported = $answer === '' ? [] : NumberGuard::unsupported($answer, $basis);
        if ($unsupported !== []) {
            $this->gateway->reject($result->callId, 'angka_tanpa_dasar');
        }
        // Pertanyaan kebijakan dijawab sebagai informasi: "hak warga" di
        // dalamnya bersifat umum, bukan kasus pribadi. Aduan tetap aduan.
        $policy = (bool) ($data['kebijakan'] ?? false) && in_array($type, ['informasi', 'pribadi'], true);

        return [
            'jenis' => $policy ? 'informasi' : $type,
            'jawaban' => $answer,
            'sumber' => $cited,
            'beda_sumber' => (bool) ($data['beda_sumber'] ?? false),
            'kebijakan' => $policy,
            'portal' => $this->portals->find(is_string($data['portal'] ?? null) ? $data['portal'] : null)?->code,
            'perlu_petugas' => (bool) ($data['perlu_petugas'] ?? false),
            'alasan_petugas' => in_array($data['alasan_petugas'] ?? null, ['diminta', 'sumber_berbeda'], true) ? $data['alasan_petugas'] : null,
            'kompleks' => ! $policy && (bool) ($data['kompleks'] ?? false),
            'ringkasan' => Str::limit(trim((string) ($data['ringkasan'] ?? '')), 600),
            'angka_tanpa_dasar' => $unsupported,
        ];
    }
}
