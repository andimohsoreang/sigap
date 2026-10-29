<?php

namespace Tests\Feature\Ai;

use App\Console\Commands\UjiAsistenCommand;
use App\Models\KnowledgeArticle;
use App\Models\KnowledgePassage;
use App\Models\KnowledgeSource;
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

    /**
     * Pertanyaan (`tanya`) yang fakta `harus_memuat`-nya BELUM ada di 3 sumber
     * teratas (lokal: semua artikel seeder terbit, tanpa Sumber Resmi). Label
     * tetap fakta yang benar; daftar ini hanya boleh MENYUSUT — kasus baru yang
     * gagal langsung merah, dan kasus yang sudah lulus wajib dihapus dari sini
     * (pola sama dengan baseline uji arsitektur).
     *
     * @var list<string>
     */
    private const DIKETAHUI_GAGAL = [
        // "KTP-el" ada di artikel persyaratan TKN, tetapi pertanyaan umum soal
        // syarat menemukan artikel "Siapa yang boleh menjadi transmigran".
        'Apa saja syarat untuk menjadi peserta program transmigrasi?',
    ];

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

    /** @return array<string, string> tanya → keterangan, untuk kasus yang faktanya tidak ada di 3 sumber teratas */
    private function factMisses(): array
    {
        $retriever = app(KnowledgeRetriever::class);
        $misses = [];

        foreach (require database_path('data/uji-asisten.php') as $case) {
            if (! is_string($case['harus_memuat'])) {
                continue;
            }
            $top = $retriever->sources($case['tanya'])->take(3);
            if (! UjiAsistenCommand::containsFact($case['harus_memuat'], $top)) {
                $misses[$case['tanya']] = "{$case['tanya']} ⇢ \"{$case['harus_memuat']}\" → [".$top->pluck('title')->implode(' | ').']';
            }
        }

        return $misses;
    }

    public function test_every_answerable_question_has_its_fact_in_top_three_sources(): void
    {
        $new = array_values(array_diff_key($this->factMisses(), array_flip(self::DIKETAHUI_GAGAL)));

        $this->assertSame([], $new, "Fakta harus_memuat tidak ada di 3 sumber teratas:\n".implode("\n", $new));
    }

    public function test_known_fact_misses_only_shrink(): void
    {
        $fixed = array_values(array_diff(self::DIKETAHUI_GAGAL, array_keys($this->factMisses())));

        $this->assertSame([], $fixed, "Sudah lulus (atau tidak ada lagi di paket uji) — hapus dari DIKETAHUI_GAGAL:\n".implode("\n", $fixed));
    }

    /**
     * Regresi: di produksi hanya artikel layanan SIGAP yang terbit, dan satu-
     * satunya yang menyebut "Kementerian Transmigrasi" (artikel SP4N-LAPOR!)
     * dulu lolos cakupan untuk 8/43 pertanyaan hanya karena kata
     * transmigrasi/transmigran/kementerian berbobot tinggi.
     */
    public function test_generic_domain_words_alone_do_not_pass_coverage(): void
    {
        KnowledgeArticle::query()->delete();
        $this->seed(KnowledgeSeeder::class);
        $retriever = app(KnowledgeRetriever::class);

        foreach ([
            'alamat kantor kementerian transmigrasi di mana?',
            'gimana caranya daftar jadi transmigran?',
            'apa kewajiban seorang transmigran?',
            'tugas kementerian transmigrasi itu apa?',
        ] as $question) {
            $this->assertNotContains(
                'Kapan sebaiknya melapor ke SP4N-LAPOR! atau ke Inspektorat Jenderal?',
                $retriever->search($question)->pluck('title')->all(),
                $question,
            );
        }

        // Kata khas pertanyaan tetap menemukan artikel itu.
        $this->assertContains(
            'Kapan sebaiknya melapor ke SP4N-LAPOR! atau ke Inspektorat Jenderal?',
            $retriever->search('mau lapor pungutan liar pegawai Kementerian Transmigrasi')->pluck('title')->all(),
        );
    }

    public function test_question_with_only_generic_words_still_finds_articles(): void
    {
        KnowledgeArticle::query()->delete();
        $article = KnowledgeArticle::create([
            'title' => 'Apa yang dimaksud dengan transmigrasi?',
            'body' => 'Transmigrasi adalah perpindahan penduduk secara sukarela.',
            'status' => KnowledgeArticle::STATUS_PUBLISHED,
        ]);
        KnowledgeArticle::create(['title' => 'Cara melacak tiket', 'body' => 'Masukkan nomor tiket.', 'status' => KnowledgeArticle::STATUS_PUBLISHED]);

        $this->assertSame([$article->id], app(KnowledgeRetriever::class)->search('transmigrasi?')->pluck('id')->all());
    }

    public function test_fact_check_ignores_case_whitespace_and_dash_style_and_reads_passages(): void
    {
        $passage = new KnowledgePassage(['heading' => 'Pasal 10', 'body' => "Transmigrasi Umum diutamakan bagi\n  wilayah yang tingkat KEPADATAN penduduknya tinggi."]);
        $passage->setRelation('source', new KnowledgeSource(['name' => 'UU 15/1997']));

        $this->assertTrue(UjiAsistenCommand::containsFact('kepadatan penduduk', collect([$passage])));
        $this->assertTrue(UjiAsistenCommand::containsFact('diutamakan bagi wilayah', collect([$passage])));
        $passage->body = 'Berusia produktif, yaitu usia antara 19 - 53 tahun.';
        $this->assertTrue(UjiAsistenCommand::containsFact('19–53 tahun', collect([$passage])));
        $this->assertTrue(UjiAsistenCommand::containsFact('19 - 53 tahun', collect([$passage])));
        $passage->body = "Transmigrasi Umum diutamakan bagi\n  wilayah yang tingkat KEPADATAN penduduknya tinggi.";
        $this->assertFalse(UjiAsistenCommand::containsFact('bencana alam', collect([$passage])));
        $this->assertTrue(UjiAsistenCommand::containsFact(null, collect()));
        $this->assertFalse(UjiAsistenCommand::containsFact(null, collect([$passage])));
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
