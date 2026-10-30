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
 *
 * Pertanyaan panjang multi-aspek (mis. pertanyaan kebijakan) jarang lolos
 * syarat cakupan sebagai satu kalimat utuh. Pertanyaan seperti itu juga
 * dicari per segmen, hasilnya digabung bergiliran, dan kutipannya diperbanyak
 * ({@see spread()}).
 */
class KnowledgeRetriever
{
    private const FIELD_WEIGHT = 3;

    private const K1 = 1.2;

    private const B = 0.5;

    /** Porsi bobot kata pertanyaan yang harus ditemukan di artikel. */
    private const MIN_COVERAGE = 0.45;

    /**
     * Bobot tetap kata domain umum di penyebut cakupan, sebagai porsi rata-rata
     * bobot kata pertanyaan (bukan IDF kata umum itu sendiri).
     */
    private const GENERIC_COVERAGE_SHARE = 0.25;

    /**
     * Kata di IndonesianText::GENERIC_WORDS yang tetap khas untuk Basis
     * Pengetahuan ("jam layanan", "biaya layanan"), meski umum untuk portal.
     */
    private const SPECIFIC_FOR_KNOWLEDGE = ['layanan'];

    /** Artikel di bawah porsi skor artikel teratas ini tidak ikut dikirim. */
    private const RELATIVE_CUTOFF = 0.35;

    /** Pertanyaan dengan kata bermakna sebanyak ini dianggap panjang/multi-aspek. */
    public const LONG_QUESTION_TERMS = 12;

    /** Jumlah kutipan untuk pertanyaan panjang (artikel tetap paling banyak 3). */
    private const LONG_PASSAGES = 6;

    /** Segmen dengan kata bermakna lebih sedikit digabung ke potongan berikutnya. */
    private const MIN_SEGMENT_TERMS = 2;

    /** Batas segmen per pertanyaan agar biaya pencarian tetap terukur. */
    private const MAX_SEGMENTS = 8;

    /**
     * Syarat cakupan per segmen lebih longgar: satu segmen pun sering memuat
     * dua aspek ("keberhasilan … perubahan demografi") yang dibahas di dua
     * kutipan berbeda.
     */
    private const SEGMENT_MIN_COVERAGE = 0.3;

    /**
     * @return Collection<int, KnowledgeArticle> paling banyak `$limit` artikel, paling relevan dulu
     */
    public function search(string $question, int $limit = 3): Collection
    {
        $index = $this->index();

        return collect($this->spread($question, fn (string $q, float $min) => array_column($this->score($index, $q, $min), 'i')))
            ->take($limit)
            ->map(fn (int $i) => $index['articles'][$i])
            ->values();
    }

    /**
     * Artikel terbit + kutipan Sumber Resmi aktif, artikel lebih dulu.
     * Tanpa `$passages`, pertanyaan panjang mendapat lebih banyak kutipan.
     *
     * @return Collection<int, KnowledgeArticle|KnowledgePassage>
     */
    public function sources(string $question, int $articles = 3, ?int $passages = null): Collection
    {
        $passages ??= $this->isLong($question) ? self::LONG_PASSAGES : 3;

        return $this->search($question, $articles)->concat($this->passages($question, $passages))->values();
    }

    /** Pertanyaan panjang/multi-aspek: dicari per segmen dan diberi kutipan lebih banyak. */
    public function isLong(string $question): bool
    {
        return count($this->terms($question)) >= self::LONG_QUESTION_TERMS;
    }

    /**
     * Pecah pertanyaan per aspek: per kalimat, koma, dan kata sambung ("dan",
     * "serta", "melainkan", …). Potongan yang kata bermaknanya kurang dari dua
     * digabung ke potongan berikutnya agar tidak mencari satu kata lepas.
     *
     * @return list<string>
     */
    public function segments(string $question): array
    {
        $pieces = preg_split('/[.,;:?!\n]+|\s(?:dan|serta|maupun|melainkan|namun|tetapi|sedangkan|atau)\s/iu', $question, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        $segments = [];
        $carry = '';
        foreach ($pieces as $piece) {
            $carry = trim($carry.' '.$piece);
            if (count($this->terms($carry)) >= self::MIN_SEGMENT_TERMS) {
                $segments[] = $carry;
                $carry = '';
            }
        }
        // Sisa pendek di ujung ("… adil dan berkelanjutan") ikut segmen terakhir.
        if ($carry !== '' && $segments !== []) {
            $segments[count($segments) - 1] .= ' '.$carry;
        } elseif ($carry !== '') {
            $segments[] = $carry;
        }

        return array_slice(array_values(array_unique($segments)), 0, self::MAX_SEGMENTS);
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
        $ids = array_slice($this->spread($question, fn (string $q, float $min) => array_column($this->rankPassages($q, $min), 'id')), 0, $limit * 5);
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
    public function rankPassages(string $question, float $minCoverage = self::MIN_COVERAGE): array
    {
        $index = $this->passageIndex();

        return array_map(
            fn (array $hit) => ['id' => $index['ids'][$hit['i']], 'score' => $hit['score'], 'coverage' => $hit['coverage']],
            $this->score($index, $question, $minCoverage),
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
     * Urutan kandidat. Pertanyaan pendek: peringkat biasa. Pertanyaan panjang:
     * peringkat kalimat utuh dan tiap segmen digabung bergiliran (round-robin)
     * — juara tiap daftar dulu, lalu peringkat kedua, dst. — agar tiap aspek
     * yang ditanya mendapat kandidat. Urutannya tetap (deterministik).
     *
     * @param  callable(string, float): list<int>  $ranker  (teks, syarat cakupan) → id/posisi dokumen, paling relevan dulu
     * @return list<int>
     */
    private function spread(string $question, callable $ranker): array
    {
        if (! $this->isLong($question)) {
            return $ranker($question, self::MIN_COVERAGE);
        }

        $lists = [
            $ranker($question, self::MIN_COVERAGE),
            ...array_map(fn (string $segment) => $ranker($segment, self::SEGMENT_MIN_COVERAGE), $this->segments($question)),
        ];
        $merged = [];
        $rounds = max(array_map('count', $lists));
        for ($r = 0; $r < $rounds; $r++) {
            foreach ($lists as $list) {
                if (isset($list[$r])) {
                    $merged[$list[$r]] ??= count($merged);
                }
            }
        }

        return array_keys($merged);
    }

    /**
     * BM25 + syarat cakupan di atas satu indeks.
     *
     * @param  array{docs: list<array{tf: array<string, int>, len: int}>, df: array<string, int>, avg: float}  $index
     * @return list<array{i: int, score: float, coverage: float}>
     */
    private function score(array $index, string $question, float $minCoverage = self::MIN_COVERAGE): array
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

        // Kata domain umum ("transmigrasi", "kementerian") tetap menambah skor,
        // tetapi kecocokannya tidak dihitung untuk lolos syarat cakupan: tanpa
        // ini, satu artikel yang kebetulan menyebut "Kementerian Transmigrasi"
        // lolos untuk hampir semua pertanyaan karena kata itu jarang di artikel
        // lain dan berbobot tinggi. Di penyebut ia tetap ada dengan bobot kecil
        // yang tetap, agar pertanyaan pendek tidak lolos hanya dengan satu kata
        // biasa ("daftar jadi transmigran" → "cara masuk sebagai warga"), tanpa
        // menghukum artikel yang benar saat basis pengetahuan masih kecil.
        // Pertanyaan yang hanya berisi kata umum ("transmigrasi itu apa?")
        // tetap memakai semua katanya.
        $counted = array_map(fn (array $keys) => ! IndonesianText::isGeneric(array_diff($keys, self::SPECIFIC_FOR_KNOWLEDGE)), $words);
        if (! in_array(true, $counted, true)) {
            $counted = array_fill(0, count($words), true);
        }
        $specificWeights = array_filter($wordWeights, fn (int $w) => $counted[$w], ARRAY_FILTER_USE_KEY);
        $genericWeight = self::GENERIC_COVERAGE_SHARE * array_sum($wordWeights) / count($wordWeights);
        $totalWeight = (array_sum($specificWeights) + (count($words) - count($specificWeights)) * $genericWeight) ?: 1.0;

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
                    $covered += $counted[$w] ? $wordWeights[$w] : 0.0;
                }
            }

            $coverage = $covered / $totalWeight;
            if ($score > 0 && $coverage >= $minCoverage) {
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
                // Kolom dasar hukum ikut dimuat: labelnya dikirim ke model (PRD-AI FR-AI-11).
                ->get(['id', 'title', 'body', 'category', 'keywords', 'source', 'source_ref', 'source_url', ...KnowledgeArticle::LEGAL_BASIS_FIELDS])
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
