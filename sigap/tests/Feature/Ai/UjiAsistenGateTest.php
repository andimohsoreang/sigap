<?php

namespace Tests\Feature\Ai;

use App\Models\KnowledgeArticle;
use App\Models\KnowledgeSource;
use App\Models\Portal;
use App\Services\Ai\AiException;
use App\Services\Ai\LlmClient;
use Database\Seeders\KnowledgeSeeder;
use Database\Seeders\OfficialKnowledgeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * PRD-AI FR-AI-07: `sigap:uji-asisten` sebagai gerbang kualitas — keluar
 * dengan kode gagal bila ambang tidak terpenuhi. Bagian pencarian (tanpa
 * model) dijalankan di CI lewat tes ini dengan ambang 95%.
 */
class UjiAsistenGateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([KnowledgeSeeder::class, OfficialKnowledgeSeeder::class]);
        KnowledgeArticle::query()->update(['status' => KnowledgeArticle::STATUS_PUBLISHED]);
    }

    public function test_search_gate_passes_at_95_percent(): void
    {
        $this->artisan('sigap:uji-asisten', ['--hanya-pencarian' => true, '--min-pencarian' => 95])
            ->expectsOutputToContain('Gerbang kualitas LULUS.')
            ->assertSuccessful();
    }

    public function test_search_gate_fails_when_threshold_not_met(): void
    {
        $this->artisan('sigap:uji-asisten', ['--hanya-pencarian' => true, '--min-pencarian' => 101])
            ->expectsOutputToContain('Gerbang kualitas GAGAL: pencarian')
            ->assertFailed();
    }

    public function test_without_thresholds_the_command_only_reports(): void
    {
        $this->artisan('sigap:uji-asisten', ['--hanya-pencarian' => true])
            ->doesntExpectOutputToContain('Gerbang kualitas')
            ->assertSuccessful();
    }

    public function test_model_thresholds_are_ignored_for_search_only_runs(): void
    {
        $this->artisan('sigap:uji-asisten', ['--hanya-pencarian' => true, '--min-klasifikasi' => 100])
            ->expectsOutputToContain('Ambang model diabaikan pada --hanya-pencarian: --min-klasifikasi')
            ->assertSuccessful();
    }

    public function test_classification_gate_counts_failed_calls_as_wrong(): void
    {
        $this->app->bind(LlmClient::class, fn () => new class implements LlmClient
        {
            public function complete(array $messages, bool $json = false): string
            {
                throw new AiException('mati', 'koneksi');
            }
        });

        $this->artisan('sigap:uji-asisten', ['--min-klasifikasi' => 85, '--maks-p95' => 12])
            ->expectsOutputToContain('Gerbang kualitas GAGAL: klasifikasi 0% < 85%; P95 tidak terukur')
            ->assertFailed();
    }

    /** Sumber Resmi dengan batas usia lain untuk kasus "umur berapa batas maksimal…". */
    private function oldAgeSource(array $basis = []): void
    {
        $source = KnowledgeSource::create($basis + ['kind' => 'situs', 'name' => 'Persyaratan lama', 'url' => 'https://www.transmigrasi.go.id/layanan/persyaratan-transmigrasi', 'status' => 'siap']);
        $source->passages()->create(['url' => $source->url, 'title' => 'Persyaratan Transmigrasi', 'heading' => 'Syarat Mendaftar', 'body' => 'Berusia produktif, yaitu usia antara 19 s/d 49 tahun, batas umur maksimal ikut transmigrasi.', 'position' => 0]);
        Cache::flush();
    }

    private function answering(array $answer): void
    {
        $this->app->bind(LlmClient::class, fn () => new class($answer) implements LlmClient
        {
            public function __construct(private array $answer) {}

            public function complete(array $messages, bool $json = false): string
            {
                return (string) json_encode($this->answer + ['jenis' => 'informasi', 'portal' => null, 'ringkasan' => '']);
            }
        });
    }

    public function test_conflict_case_without_deciding_labels_must_go_to_staff(): void
    {
        $this->oldAgeSource();

        $this->answering(['jawaban' => 'Batas usia 19–53 tahun [1].', 'sumber' => [1], 'beda_sumber' => false, 'perlu_petugas' => false]);
        $this->artisan('sigap:uji-asisten')->expectsOutputToContain('Sumber berbeda tepat: 0% (0/1)')->assertSuccessful();

        $this->answering(['jawaban' => 'Menurut [1] 19–53 tahun. Menurut [2] 19–49 tahun.', 'sumber' => [1, 2], 'beda_sumber' => true, 'perlu_petugas' => true, 'alasan_petugas' => 'sumber_berbeda']);
        $this->artisan('sigap:uji-asisten')->expectsOutputToContain('Sumber berbeda tepat: 100% (1/1)')->assertSuccessful();
    }

    public function test_conflict_case_with_deciding_labels_must_name_current_and_old_rule(): void
    {
        $this->oldAgeSource(['dasar_hukum' => 'Peraturan Lama 11/2017', 'status_dasar' => 'diganti', 'diganti_oleh' => 'Peraturan Baru 2/2024']);
        KnowledgeArticle::query()->update(['dasar_hukum' => 'Peraturan Baru 2/2024', 'status_dasar' => 'berlaku']);

        $this->answering(['jawaban' => 'Batas usia 19–53 tahun [1]. Ketentuan 19–49 tahun [2] adalah aturan lama yang sudah diganti.', 'sumber' => [1, 2], 'beda_sumber' => true, 'perlu_petugas' => false]);
        $this->artisan('sigap:uji-asisten')->expectsOutputToContain('Sumber berbeda tepat: 100% (1/1)')->assertSuccessful();

        $this->answering(['jawaban' => 'Menurut [1] 19–53 tahun. Menurut [2] 19–49 tahun.', 'sumber' => [1, 2], 'beda_sumber' => true, 'perlu_petugas' => true, 'alasan_petugas' => 'sumber_berbeda']);
        $this->artisan('sigap:uji-asisten')->expectsOutputToContain('Sumber berbeda tepat: 0% (0/1)')->assertSuccessful();
    }

    public function test_portal_choice_is_checked_for_marked_cases(): void
    {
        Portal::query()->create(['code' => 'trans-tuntas', 'name' => 'Trans Tuntas', 'url' => 'https://tuntas-trans.transmigrasi.go.id/', 'audience' => Portal::AUDIENCE_PUBLIC, 'purpose' => 'Pengaduan masalah lahan transmigrasi', 'is_active' => true]);

        $this->answering(['jenis' => 'aduan', 'jawaban' => '', 'sumber' => [], 'portal' => 'trans-tuntas', 'beda_sumber' => false, 'perlu_petugas' => false]);
        $this->artisan('sigap:uji-asisten')->expectsOutputToContain('Portal tepat        : 100% (1/1)')->assertSuccessful();

        $this->answering(['jenis' => 'aduan', 'jawaban' => '', 'sumber' => [], 'portal' => null, 'beda_sumber' => false, 'perlu_petugas' => false]);
        $this->artisan('sigap:uji-asisten')->expectsOutputToContain('Portal tepat        : 0% (0/1)')->assertSuccessful();
    }

    public function test_number_guard_rejections_are_reported_per_case(): void
    {
        $this->answering(['jawaban' => 'Jawabannya 987654 hari [1].', 'sumber' => [1], 'beda_sumber' => false, 'perlu_petugas' => false]);

        $this->artisan('sigap:uji-asisten')
            ->expectsOutputToContain('⛔ angka tanpa dasar: 987654')
            ->expectsOutputToContain('— #1 (987654)')
            ->assertSuccessful();
    }

    public function test_answers_without_sources_fail_the_gate(): void
    {
        // Model selalu menjawab "informasi" dengan sumber yang tidak dikirim → dianggap menebak.
        $this->app->bind(LlmClient::class, fn () => new class implements LlmClient
        {
            public function complete(array $messages, bool $json = false): string
            {
                return '{"jenis":"informasi","jawaban":"Jawaban karangan [99]","sumber":[99]}';
            }
        });

        $this->artisan('sigap:uji-asisten', ['--maks-tanpa-sumber' => 0])
            ->expectsOutputToContain('Gerbang kualitas GAGAL: jawaban tanpa sumber')
            ->assertFailed();
    }
}
