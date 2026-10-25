<?php

namespace App\Services\Knowledge;

use App\Models\KnowledgeArticle;
use App\Models\KnowledgePassage;
use App\Models\KnowledgeSource;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * Mencari artikel terbit yang relevan dengan pertanyaan warga.
 *
 * Pencarian leksikal BM25 (tanpa embedding) di atas kata dasar Bahasa
 * Indonesia ({@see IndonesianText}). Cukup untuk Basis Pengetahuan berukuran
 * puluhan sampai ratusan artikel dan dapat dijelaskan ke petugas:
 * - judul, kategori, dan kata kunci berbobot lebih tinggi daripada isi;
 * - kata yang muncul di hampir semua artikel ("transmigrasi") berbobot kecil
 *   (IDF), jadi tidak membuat artikel yang tak relevan ikut terpilih;
 * - artikel harus memuat sebagian besar kata penting pertanyaan (cakupan),
 *   agar satu kata kebetulan sama tidak dianggap jawaban.
 *
 * Kutipan Sumber Resmi (situs & berkas resmi) dicari dengan cara yang sama
 * di indeksnya sendiri, lalu dikirim SETELAH artikel: artikel sudah ditinjau
 * petugas, kutipan menambal pertanyaan yang belum punya artikel.
 */
class KnowledgeRetriever
{
    private const FIELD_WEIGHT = 3;

    private const K1 = 1.2;

    private const B = 0.5;

    /** Porsi bobot kata pertanyaan yang harus ditemukan di artikel. */
    private const MIN_COVERAGE = 0.45;

    /** Artikel di bawah porsi skor artikel teratas ini tidak ikut dikirim. */
    private const RELATIVE_CUTOFF = 0.35;

    /**
     * @return Collection<int, KnowledgeArticle> paling banyak `$limit` artikel, paling relevan dulu
     */
    public function search(string $question, int $limit = 3): Collection
    {
        return collect($this->rank($question))
            ->take($limit)
            ->map(fn (array $hit) => $hit['article'])
            ->values();
    }

    /**
     * Artikel terbit + kutipan Sumber Resmi aktif, artikel lebih dulu.
     *
     * @return Collection<int, KnowledgeArticle|KnowledgePassage>
     */
    public function sources(string $question, int $articles = 3, int $passages = 3): Collection
    {
        return $this->search($question, $articles)->concat($this->passages($question, $passages))->values();
    }

    /**
     * Kutipan terpilih: teks yang sama persis (mis. halaman yang sama dirayapi
     * dua sumber) dikirim sekali, dan tiap sumber diberi giliran dulu sebelum
     * sumber yang sama dipakai lagi — agar bila dua situs resmi menulis
     * ketentuan berbeda, keduanya sampai ke AI.
     *
     * @return Collection<int, KnowledgePassage> kutipan beserta sumbernya, paling relevan dulu
     */
    public function passages(string $question, int $limit = 3): Collection
    {
        $ids = array_column(array_slice($this->rankPassages($question), 0, $limit * 5), 'id');
        if ($ids === []) {
            return collect();
        }

        $found = KnowledgePassage::query()->with('source.document')->whereKey($ids)->get()->keyBy('id');
        $ranked = collect($ids)->map(fn (int $id) => $found->get($id))->filter()->values();

        $seenText = [];
        $unique = $ranked->filter(function (KnowledgePassage $p) use (&$seenText) {
            $key = md5(mb_strtolower(preg_replace('/\s+/u', ' ', $p->body)));
            if (isset($seenText[$key])) {
                return false;
            }

            return $seenText[$key] = true;
        })->values();

        $firstPerSource = $unique->unique('knowledge_source_id');
        $picked = $firstPerSource->take($limit)
            ->concat($unique->diff($firstPerSource)->take(max(0, $limit - $firstPerSource->count())))
            ->pluck('id')
            ->all();

        // Urutan akhir tetap menurut relevansi.
        return $unique->filter(fn (KnowledgePassage $p) => in_array($p->id, $picked, true))->values();
    }

    /**
     * @return list<array{id: int, score: float, coverage: float}>
     */
    public function rankPassages(string $question): array
    {
        $index = $this->passageIndex();

        return array_map(
            fn (array $hit) => ['id' => $index['ids'][$hit['i']], 'score' => $hit['score'], 'coverage' => $hit['coverage']],
            $this->score($index, $question),
        );
    }

    /**
     * Peringkat lengkap beserta skornya (dipakai uji kualitas pencarian).
     *
     * @return list<array{article: KnowledgeArticle, score: float, coverage: float}>
     */
    public function rank(string $question): array
    {
        $index = $this->index();

        return array_map(
            fn (array $hit) => ['article' => $index['articles'][$hit['i']], 'score' => $hit['score'], 'coverage' => $hit['coverage']],
            $this->score($index, $question),
        );
    }

    /**
     * BM25 + syarat cakupan di atas satu indeks.
     *
     * @param  array{docs: list<array{tf: array<string, int>, len: int}>, df: array<string, int>, avg: float}  $index
     * @return list<array{i: int, score: float, coverage: float}>
     */
    private function score(array $index, string $question): array
    {
        $words = IndonesianText::words($question);
        if ($words === []) {
            return [];
        }

        ['docs' => $docs, 'df' => $df, 'avg' => $avg] = $index;
        $n = count($docs);
        if ($n === 0) {
            return [];
        }

        $idf = fn (string $key) => log(1 + ($n - ($df[$key] ?? 0) + 0.5) / (($df[$key] ?? 0) + 0.5));

        // Bobot tiap kata pertanyaan = IDF kuncinya yang paling khas. Kata
        // yang tak ada di artikel mana pun dihitung sekhas kata yang muncul
        // di satu artikel: tetap menurunkan cakupan, tetapi tidak sampai
        // menenggelamkan kata kunci yang cocok ("kapan jadup cair?").
        $rarest = log(1 + ($n - 0.5) / 1.5);
        $wordWeights = array_map(fn (array $keys) => min($rarest, max(array_map($idf, $keys))), $words);
        $totalWeight = array_sum($wordWeights) ?: 1.0;

        $hits = [];
        foreach ($docs as $i => $doc) {
            $score = 0.0;
            $covered = 0.0;
            foreach ($words as $w => $keys) {
                $best = 0.0;
                foreach ($keys as $key) {
                    $tf = $doc['tf'][$key] ?? 0;
                    if ($tf === 0) {
                        continue;
                    }
                    $norm = $tf * (self::K1 + 1) / ($tf + self::K1 * (1 - self::B + self::B * $doc['len'] / $avg));
                    $best = max($best, $idf($key) * $norm);
                }
                if ($best > 0) {
                    $score += $best;
                    $covered += $wordWeights[$w];
                }
            }

            $coverage = $covered / $totalWeight;
            if ($score > 0 && $coverage >= self::MIN_COVERAGE) {
                $hits[] = ['i' => $i, 'score' => round($score, 3), 'coverage' => round($coverage, 2)];
            }
        }

        usort($hits, fn (array $a, array $b) => $b['score'] <=> $a['score']);

        $top = $hits[0]['score'] ?? 0;

        return array_values(array_filter($hits, fn (array $h) => $h['score'] >= $top * self::RELATIVE_CUTOFF));
    }

    /**
     * Jumlah kata bermakna di teks (kata tanya & sapaan tidak dihitung).
     *
     * @return list<string>
     */
    public function terms(string $text): array
    {
        return array_map(fn (array $keys) => $keys[0], IndonesianText::words($text));
    }

    /**
     * @return array{articles: list<KnowledgeArticle>, docs: list<array{tf: array<string, int>, len: int}>, df: array<string, int>, avg: float}
     */
    private function index(): array
    {
        return Cache::remember(KnowledgeArticle::CACHE_KEY, now()->addMinutes(10), function () {
            $articles = KnowledgeArticle::query()->published()
                ->get(['id', 'title', 'body', 'category', 'keywords', 'source', 'source_ref', 'source_url'])
                ->all();

            $docs = [];
            $df = [];
            foreach ($articles as $article) {
                $tf = IndonesianText::frequencies($article->body);
                foreach (IndonesianText::frequencies(implode(' ', [$article->title, $article->category, $article->keywords])) as $key => $count) {
                    $tf[$key] = ($tf[$key] ?? 0) + $count * self::FIELD_WEIGHT;
                }
                foreach (array_keys($tf) as $key) {
                    $df[$key] = ($df[$key] ?? 0) + 1;
                }
                $docs[] = ['tf' => $tf, 'len' => max(1, array_sum($tf))];
            }

            $avg = $docs === [] ? 1.0 : array_sum(array_column($docs, 'len')) / count($docs);

            return ['articles' => array_values($articles), 'docs' => $docs, 'df' => $df, 'avg' => $avg];
        });
    }

    /**
     * Indeks kutipan dari sumber aktif. Hanya id + frekuensi kata yang
     * di-cache; isi kutipan dimuat dari basis data untuk hasil teratas saja.
     *
     * @return array{ids: list<int>, docs: list<array{tf: array<string, int>, len: int}>, df: array<string, int>, avg: float}
     */
    private function passageIndex(): array
    {
        return Cache::remember(KnowledgeSource::CACHE_KEY, now()->addMinutes(10), function () {
            $ids = [];
            $docs = [];
            $df = [];

            KnowledgePassage::query()
                ->whereIn('knowledge_source_id', KnowledgeSource::query()->active()->select('id'))
                ->select(['id', 'title', 'heading', 'body'])
                ->orderBy('id')
                ->chunk(500, function ($passages) use (&$ids, &$docs, &$df) {
                    foreach ($passages as $passage) {
                        $tf = IndonesianText::frequencies($passage->body);
                        foreach (IndonesianText::frequencies(implode(' ', [$passage->title, $passage->heading])) as $key => $count) {
                            $tf[$key] = ($tf[$key] ?? 0) + $count * 2;
                        }
                        foreach (array_keys($tf) as $key) {
                            $df[$key] = ($df[$key] ?? 0) + 1;
                        }
                        $ids[] = $passage->id;
                        $docs[] = ['tf' => $tf, 'len' => max(1, array_sum($tf))];
                    }
                });

            $avg = $docs === [] ? 1.0 : array_sum(array_column($docs, 'len')) / count($docs);

            return ['ids' => $ids, 'docs' => $docs, 'df' => $df, 'avg' => $avg];
        });
    }
}
