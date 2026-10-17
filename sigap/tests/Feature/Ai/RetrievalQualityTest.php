<?php

namespace Tests\Feature\Ai;

use App\Models\KnowledgeArticle;
use App\Services\Knowledge\IndonesianText;
use App\Services\Knowledge\KnowledgeRetriever;
use Database\Seeders\KnowledgeSeeder;
use Database\Seeders\OfficialKnowledgeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Kualitas pencarian Basis Pengetahuan atas paket uji database/data/uji-asisten.php.
 * Bila menambah artikel atau mengubah pencarian, tes ini menjaga agar
 * pertanyaan yang dulu terjawab tidak tiba-tiba kehilangan sumbernya.
 */
class RetrievalQualityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([KnowledgeSeeder::class, OfficialKnowledgeSeeder::class]);
        KnowledgeArticle::query()->update(['status' => KnowledgeArticle::STATUS_PUBLISHED]);
    }

    public function test_every_answerable_question_finds_its_article_in_top_three(): void
    {
        $retriever = app(KnowledgeRetriever::class);
        $misses = [];
        $first = 0;
        $total = 0;

        foreach (require database_path('data/uji-asisten.php') as $case) {
            if (! is_string($case['artikel'])) {
                continue;
            }
            $total++;
            $titles = $retriever->search($case['tanya'])->pluck('title')->all();
            $rank = collect($titles)->search(fn (string $t) => str_contains(mb_strtolower($t), mb_strtolower($case['artikel'])));

            if ($rank === false) {
                $misses[] = "{$case['tanya']} → [".implode(' | ', $titles).']';
            } elseif ($rank === 0) {
                $first++;
            }
        }

        $this->assertSame([], $misses, "Pertanyaan yang tidak menemukan artikelnya:\n".implode("\n", $misses));
        $this->assertGreaterThanOrEqual(0.85, $first / $total, "Artikel benar di peringkat 1 hanya {$first}/{$total}.");
    }

    public function test_out_of_scope_questions_find_nothing(): void
    {
        $retriever = app(KnowledgeRetriever::class);

        foreach (require database_path('data/uji-asisten.php') as $case) {
            if ($case['artikel'] === null) {
                $this->assertSame([], $retriever->search($case['tanya'])->pluck('title')->all(), $case['tanya']);
            }
        }
    }

    public function test_stemmer_reduces_common_affixes(): void
    {
        $this->assertContains('daftar', IndonesianText::keys('pendaftaran'));
        $this->assertContains('tolak', IndonesianText::keys('ditolak'));
        $this->assertContains('kirim', IndonesianText::keys('mengirimkan'));
        $this->assertContains('mohon', IndonesianText::keys('permohonan'));
        $this->assertContains('syarat', IndonesianText::keys('persyaratannya'));
        $this->assertContains('lahan', IndonesianText::keys('tanah'));
        // Partikel yang sebenarnya bagian kata dasar tidak merusak kata.
        $this->assertContains('nikah', IndonesianText::keys('menikah'));
        $this->assertContains('masalah', IndonesianText::keys('masalah'));
        $this->assertContains('transm', IndonesianText::keys('transmigran'));
        $this->assertContains('transm', IndonesianText::keys('transmigrasi'));
    }

    public function test_keywords_field_makes_article_findable_by_citizen_terms(): void
    {
        KnowledgeArticle::query()->delete();
        $article = KnowledgeArticle::create([
            'title' => 'Bantuan biaya hidup awal',
            'body' => 'Diberikan sampai transmigran mampu berproduksi.',
            'keywords' => 'jadup, jatah hidup',
            'status' => KnowledgeArticle::STATUS_PUBLISHED,
        ]);
        KnowledgeArticle::create(['title' => 'Cara melacak tiket', 'body' => 'Masukkan nomor tiket.', 'status' => KnowledgeArticle::STATUS_PUBLISHED]);

        $this->assertSame([$article->id], app(KnowledgeRetriever::class)->search('kapan jadup cair?')->pluck('id')->all());
    }
}
