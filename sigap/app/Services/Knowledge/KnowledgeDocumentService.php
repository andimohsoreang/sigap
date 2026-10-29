<?php

namespace App\Services\Knowledge;

use App\Models\KnowledgeArticle;
use App\Models\KnowledgeDocument;
use App\Models\KnowledgeSource;
use App\Models\User;
use App\Modules\Ai\AiGateway;
use App\Modules\Ai\AiResult;
use App\Modules\Ai\AiTask;
use App\Services\Ai\AiException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Dokumen resmi → kutipan Sumber Resmi + usulan artikel Basis Pengetahuan.
 *
 * - Teksnya langsung dipotong menjadi kutipan yang dapat dirujuk asisten
 *   (nama berkas + halaman), tanpa menunggu AI.
 * - AI hanya MENGUSULKAN tanya-jawab beserta halaman sumbernya. Usulan baru
 *   menjadi artikel setelah dipilih petugas, dan selalu berstatus draf.
 */
class KnowledgeDocumentService
{
    /** Batas teks per panggilan AI (≈ 6–8 ribu token). */
    private const CHUNK_CHARS = 24000;

    private const MAX_PROPOSALS = 24;

    public function __construct(
        private readonly PdfTextExtractor $extractor,
        private readonly DocxTextExtractor $docx,
        private readonly AiGateway $gateway,
        private readonly KnowledgeRetriever $retriever,
        private readonly SourceIngestor $ingestor,
    ) {}

    public function process(KnowledgeDocument $document): void
    {
        try {
            $pages = $this->pages($document);
        } catch (\RuntimeException $e) {
            $this->fail($document, 'Berkas tidak dapat dibaca. Pastikan berkas tidak rusak atau terkunci kata sandi.', $e);

            return;
        }

        if (collect($pages)->every(fn (string $text) => mb_strlen($text) < 20)) {
            $this->fail($document, 'Tidak ada teks yang dapat dibaca. Dokumen hasil pindai (gambar) belum didukung.');

            return;
        }

        // Kutipan dulu: berkas sudah bisa dirujuk asisten walau AI gagal mengusulkan artikel.
        $source = KnowledgeSource::query()->firstOrCreate(
            ['knowledge_document_id' => $document->id],
            [
                'kind' => KnowledgeSource::KIND_FILE,
                'name' => Str::limit($document->original_name, 250, ''),
                'created_by' => $document->uploaded_by,
            ],
        );
        $this->ingestor->sync($source);

        try {
            $proposals = [];
            foreach ($this->chunks($pages) as $chunk) {
                array_push($proposals, ...$this->propose($chunk));
                if (count($proposals) >= self::MAX_PROPOSALS) {
                    break;
                }
            }
        } catch (AiException $e) {
            Log::warning("Usulan artikel dokumen #{$document->id} gagal: ".$e->getMessage());
            $document->forceFill([
                'pages' => count($pages),
                'status' => KnowledgeDocument::STATUS_READY,
                'error' => 'Isi berkas sudah dapat dikutip asisten. Usulan artikel belum dapat dibuat karena asisten AI tidak dapat dihubungi; coba proses ulang beberapa saat lagi.',
                'proposals' => [],
            ])->save();

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
                'source_ref' => ($document->isDocx() ? 'Bagian ' : 'Hal. ').$proposal['halaman'],
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
     * Teks per halaman. DOCX tidak berhalaman: tiap bagian (judul) dihitung satu "halaman".
     *
     * @return list<string>
     */
    private function pages(KnowledgeDocument $document): array
    {
        $path = Storage::disk('local')->path($document->path);

        if (! $document->isDocx()) {
            return $this->extractor->pages($path);
        }

        return array_map(
            fn (array $s) => trim(($s['heading'] ? $s['heading']."\n" : '').$s['text']),
            $this->docx->sections($path),
        );
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
        $result = $this->gateway->run(AiTask::UsulArtikel, ['halaman' => $chunk]);
        if (! $result->isOk()) {
            throw new AiException($result->status === AiResult::FALLBACK ? 'Usulan AI bukan JSON.' : 'Model AI tidak dapat dipakai.', $result->reason);
        }
        $data = $result->data;
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
