<?php

namespace App\Services\Knowledge;

use App\Models\KnowledgeArticle;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * Mencari artikel terbit yang relevan dengan pertanyaan warga.
 *
 * Sengaja sederhana (pencocokan kata kunci berbobot, tanpa embedding) karena
 * Basis Pengetahuan berukuran puluhan–ratusan artikel. Kata dicocokkan lewat
 * awalan 6 huruf sehingga bentuk akhiran berbeda ("sertifikat" ≈ "sertifikasi")
 * tetap cocok; imbuhan awalan ("daftar" vs "pendaftaran") belum tertangani.
 */
class KnowledgeRetriever
{
    private const STOPWORDS = [
        'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'apa', 'apakah', 'bagaimana', 'gimana', 'cara',
        'saya', 'aku', 'kami', 'kita', 'ini', 'itu', 'ada', 'atau', 'tidak', 'bisa', 'sudah', 'akan', 'pada',
        'dalam', 'adalah', 'juga', 'mau', 'ingin', 'tolong', 'mohon', 'pak', 'bu', 'bapak', 'ibu', 'kak', 'min',
        'ya', 'dong', 'sih', 'kah', 'nya', 'kalau', 'kalo', 'jika', 'bila', 'agar', 'supaya', 'bagi', 'oleh',
        'para', 'sebagai', 'kapan', 'dimana', 'mana', 'siapa', 'berapa', 'mengapa', 'kenapa', 'tentang', 'soal',
        'harus', 'perlu', 'boleh', 'saja', 'lagi', 'masih', 'belum', 'sudahkah', 'halo', 'hai', 'terima', 'kasih',
    ];

    /**
     * @return Collection<int, KnowledgeArticle> paling banyak `$limit` artikel, paling relevan dulu
     */
    public function search(string $question, int $limit = 3): Collection
    {
        $terms = $this->terms($question);
        if ($terms === []) {
            return collect();
        }

        return $this->published()
            ->map(fn (KnowledgeArticle $a) => [$a, $this->score($a, $terms)])
            ->filter(fn (array $pair) => $pair[1] >= 2.0)
            ->sortByDesc(fn (array $pair) => $pair[1])
            ->take($limit)
            ->map(fn (array $pair) => $pair[0])
            ->values();
    }

    /** @return list<string> */
    public function terms(string $text): array
    {
        $words = preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($text), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        $terms = [];
        foreach ($words as $word) {
            $word = (string) preg_replace('/(nya|kah|lah)$/u', '', $word);
            if (mb_strlen($word) >= 3 && ! in_array($word, self::STOPWORDS, true)) {
                $terms[] = mb_substr($word, 0, 6);
            }
        }

        return array_values(array_unique($terms));
    }

    /** @param list<string> $terms */
    private function score(KnowledgeArticle $article, array $terms): float
    {
        $title = $this->terms($article->title.' '.$article->category);
        $body = $this->terms($article->body);

        $score = 0.0;
        foreach ($terms as $term) {
            if (in_array($term, $title, true)) {
                $score += 3;
            } elseif (in_array($term, $body, true)) {
                $score += 1;
            }
        }

        return $score;
    }

    /** @return Collection<int, KnowledgeArticle> */
    private function published(): Collection
    {
        return Cache::remember(
            KnowledgeArticle::CACHE_KEY,
            now()->addMinutes(10),
            fn () => KnowledgeArticle::query()->published()->get(['id', 'title', 'body', 'category', 'source', 'source_ref']),
        );
    }
}
