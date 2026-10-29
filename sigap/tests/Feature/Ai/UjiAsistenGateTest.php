<?php

namespace Tests\Feature\Ai;

use App\Models\KnowledgeArticle;
use App\Services\Ai\AiException;
use App\Services\Ai\LlmClient;
use Database\Seeders\KnowledgeSeeder;
use Database\Seeders\OfficialKnowledgeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
