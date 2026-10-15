<?php

namespace App\Services\Knowledge;

use App\Models\KnowledgeArticle;
use App\Models\KnowledgeDocument;
use App\Models\User;
use App\Services\Ai\AiException;
use App\Services\Ai\LlmClient;
use App\Services\Ai\Prompts;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Dokumen resmi → usulan artikel Basis Pengetahuan.
 *
 * AI hanya MENGUSULKAN tanya-jawab beserta halaman sumbernya. Usulan baru
 * menjadi artikel setelah dipilih petugas, dan selalu berstatus draf.
 */
class KnowledgeDocumentService
{
    /** Batas teks per panggilan AI (≈ 6–8 ribu token). */
    private const CHUNK_CHARS = 24000;

    private const MAX_PROPOSALS = 24;

    public function __construct(
        private readonly PdfTextExtractor $extractor,
        private readonly LlmClient $llm,
        private readonly KnowledgeRetriever $retriever,
    ) {}

    public function process(KnowledgeDocument $document): void
    {
        try {
            $pages = $this->extractor->pages(Storage::disk('local')->path($document->path));
        } catch (\RuntimeException $e) {
            $this->fail($document, 'PDF tidak dapat dibaca. Pastikan berkas tidak rusak atau terkunci kata sandi.', $e);

            return;
        }

        if (collect($pages)->every(fn (string $text) => mb_strlen($text) < 20)) {
            $this->fail($document, 'Tidak ada teks yang dapat dibaca. Dokumen hasil pindai (gambar) belum didukung.');

            return;
        }

        try {
            $proposals = [];
            foreach ($this->chunks($pages) as $chunk) {
                array_push($proposals, ...$this->propose($chunk));
                if (count($proposals) >= self::MAX_PROPOSALS) {
                    break;
                }
            }
        } catch (AiException $e) {
            $this->fail($document, 'Asisten AI tidak dapat dihubungi. Coba proses ulang beberapa saat lagi.', $e);

            return;
        }

        $numbered = [];
        foreach (array_slice($proposals, 0, self::MAX_PROPOSALS) as $id => $proposal) {
            $numbered[] = $proposal + ['id' => $id, 'tersimpan' => false];
        }

        $document->forceFill([
            'pages' => count($pages),
            'status' => KnowledgeDocument::STATUS_READY,
            'error' => null,
            'proposals' => $numbered,
        ])->save();
    }

    /**
     * Simpan usulan terpilih sebagai artikel DRAF.
     *
     * @param  array<int, array{id: int, judul: string, jawaban: string, kategori?: string|null}>  $selected
     */
    public function saveDrafts(KnowledgeDocument $document, array $selected, User $user): int
    {
        $proposals = collect($document->proposals ?? [])->keyBy('id');
        $source = Str::of($document->original_name)->beforeLast('.')->limit(200, '')->toString();
        $saved = 0;

        foreach ($selected as $item) {
            $proposal = $proposals->get((int) $item['id']);
            if ($proposal === null || ($proposal['tersimpan'] ?? false)) {
                continue;
            }

            KnowledgeArticle::create([
                'title' => Str::limit(trim($item['judul']), 250, ''),
                'body' => trim($item['jawaban']),
                'category' => $item['kategori'] ?? $proposal['kategori'] ?? null,
                'source' => $source,
                'source_ref' => 'Hal. '.$proposal['halaman'],
                'status' => KnowledgeArticle::STATUS_DRAFT,
                'knowledge_document_id' => $document->id,
                'created_by' => $user->id,
                'updated_by' => $user->id,
            ]);

            $proposals->put($proposal['id'], ['tersimpan' => true] + $proposal);
            $saved++;
        }

        $document->forceFill(['proposals' => $proposals->values()->all()])->save();

        return $saved;
    }

    /**
     * Kelompokkan halaman agar satu panggilan AI tidak melebihi batas teks.
     *
     * @param  list<string>  $pages
     * @return list<list<array{no: int, teks: string}>>
     */
    private function chunks(array $pages): array
    {
        $chunks = [[]];
        $size = 0;

        foreach ($pages as $index => $text) {
            if (mb_strlen($text) < 20) {
                continue;
            }

            $text = Str::limit($text, self::CHUNK_CHARS, '');
            if ($size + mb_strlen($text) > self::CHUNK_CHARS && $chunks[array_key_last($chunks)] !== []) {
                $chunks[] = [];
                $size = 0;
            }

            $chunks[array_key_last($chunks)][] = ['no' => $index + 1, 'teks' => $text];
            $size += mb_strlen($text);
        }

        return array_values(array_filter($chunks));
    }

    /**
     * @param  list<array{no: int, teks: string}>  $chunk
     * @return list<array<string, mixed>>
     */
    private function propose(array $chunk): array
    {
        $content = $this->llm->complete([
            ['role' => 'system', 'content' => Prompts::propose()],
            ['role' => 'user', 'content' => json_encode(['halaman' => $chunk], JSON_UNESCAPED_UNICODE)],
        ], json: true);

        $data = Prompts::decodeJson($content) ?? throw new AiException('Usulan AI bukan JSON.');
        $validPages = array_column($chunk, 'no');

        return collect($data['usulan'] ?? [])
            ->filter(fn ($p) => is_array($p) && filled($p['judul'] ?? null) && filled($p['jawaban'] ?? null))
            ->map(function (array $p) use ($validPages) {
                $page = (int) ($p['halaman'] ?? 0);
                $title = Str::limit(trim((string) $p['judul']), 250, '');
                $similar = $this->retriever->search($title, 1)->first();

                return [
                    'judul' => $title,
                    'jawaban' => Str::limit(trim((string) $p['jawaban']), 4000, ''),
                    'kategori' => filled($p['kategori'] ?? null) ? Str::limit(trim((string) $p['kategori']), 100, '') : null,
                    // Halaman di luar potongan = rujukan tidak dapat dipercaya → halaman pertama potongan.
                    'halaman' => in_array($page, $validPages, true) ? $page : $validPages[0],
                    'cek_angka' => (bool) ($p['cek_angka'] ?? false) || preg_match('/\d/', (string) $p['jawaban']) === 1,
                    'mirip' => $similar ? ['id' => $similar->id, 'judul' => $similar->title] : null,
                ];
            })
            ->values()
            ->all();
    }

    private function fail(KnowledgeDocument $document, string $message, ?\Throwable $e = null): void
    {
        if ($e) {
            Log::warning("Dokumen pengetahuan #{$document->id} gagal diproses: ".$e->getMessage());
        }

        $document->forceFill(['status' => KnowledgeDocument::STATUS_FAILED, 'error' => $message])->save();
    }
}
