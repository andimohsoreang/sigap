<?php

namespace App\Services\Knowledge;

use App\Models\KnowledgeArticle;
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
     * Peringkat lengkap beserta skornya (dipakai uji kualitas pencarian).
     *
     * @return list<array{article: KnowledgeArticle, score: float, coverage: float}>
     */
    public function rank(string $question): array
    {
        $words = IndonesianText::words($question);
        if ($words === []) {
            return [];
        }

        ['articles' => $articles, 'docs' => $docs, 'df' => $df, 'avg' => $avg] = $this->index();
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
                $hits[] = ['article' => $articles[$i], 'score' => round($score, 3), 'coverage' => round($coverage, 2)];
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
}
