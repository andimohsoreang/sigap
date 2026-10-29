<?php

namespace Tests\Feature\Ai;

use App\Enums\UserRole;
use App\Events\NotificationBroadcast;
use App\Models\AiCall;
use App\Models\ChatConversation;
use App\Models\KnowledgeArticle;
use App\Models\User;
use App\Modules\Ai\AiContext;
use App\Modules\Ai\AiGateway;
use App\Modules\Ai\AiResult;
use App\Modules\Ai\AiTask;
use App\Modules\Ai\Prompts\JawabPrompt;
use App\Modules\Ai\TokenBudget;
use App\Services\Ai\AiException;
use App\Services\Ai\LlmClient;
use Carbon\CarbonInterval;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Sleep;
use Tests\TestCase;

/**
 * PRD-AI Tahap 1 — AI Gateway: satu pintu (FR-AI-01), catatan tanpa teks
 * (FR-AI-02), ketahanan & biaya (FR-AI-03), prompt berversi (FR-AI-06),
 * penyamaran terpusat (FR-AI-10).
 */
class AiGatewayTest extends TestCase
{
    use RefreshDatabase;

    private const NIK = '3201234567890123';

    private const HP = '0812-3456-7890';

    private const EMAIL = 'budi@contoh.id';

    protected function setUp(): void
    {
        parent::setUp();
        Sleep::fake();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /**
     * Driver tiruan yang merekam pesan dan memutar urutan balasan/galat.
     *
     * @param  list<string|AiException>  $script
     */
    private function driver(array $script = ['{"jenis":"informasi"}']): object
    {
        $driver = new class($script) implements LlmClient
        {
            /** @var list<array<int, array{role: string, content: string}>> */
            public array $calls = [];

            public function __construct(private array $script) {}

            public function complete(array $messages, bool $json = false): string
            {
                $this->calls[] = $messages;
                $next = count($this->script) > 1 ? array_shift($this->script) : $this->script[0];
                if ($next instanceof AiException) {
                    throw $next;
                }

                return $next;
            }
        };
        $this->app->instance(LlmClient::class, $driver);

        return $driver;
    }

    private function gateway(): AiGateway
    {
        return app(AiGateway::class);
    }

    private function pii(): string
    {
        return 'NIK '.self::NIK.', HP '.self::HP.', surel '.self::EMAIL;
    }

    // --- FR-AI-10: penyamaran terpusat -----------------------------------

    public function test_citizen_text_is_masked_for_every_task_before_reaching_the_driver(): void
    {
        $driver = $this->driver(['{"usulan":[]}']);

        $this->gateway()->run(AiTask::Jawab, ['pertanyaan' => $this->pii(), 'riwayat' => [['dari' => 'warga', 'isi' => $this->pii()]], 'sumber' => [], 'portal' => []]);
        $this->gateway()->run(AiTask::SaranTiket, ['aduan' => $this->pii(), 'kawasan' => [], 'kategori' => []]);
        $this->gateway()->run(AiTask::UsulArtikel, ['halaman' => [['no' => 1, 'teks' => $this->pii()]]]);

        $this->assertCount(3, $driver->calls);
        foreach ($driver->calls as $messages) {
            $sent = json_encode($messages);
            foreach ([self::NIK, '3456-7890', self::EMAIL] as $secret) {
                $this->assertStringNotContainsString($secret, $sent);
            }
            $this->assertStringContainsString('[NIK]', $messages[1]['content']);
        }
    }

    public function test_official_sources_are_sent_unmasked_so_answers_keep_hotline_numbers(): void
    {
        $driver = $this->driver();

        $this->gateway()->run(AiTask::Jawab, [
            'pertanyaan' => 'Nomor hotline?',
            'riwayat' => [],
            'portal' => [],
            'sumber' => [['no' => 1, 'isi' => 'Hotline WhatsApp 0811-7720-45']],
        ]);

        $this->assertStringContainsString('0811-7720-45', $driver->calls[0][1]['content']);
    }

    // --- FR-AI-01 / FR-AI-06: prompt berversi & validasi -------------------

    public function test_versioned_prompt_is_used_and_recorded(): void
    {
        $driver = $this->driver();

        $result = $this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'Halo']);

        $this->assertTrue($result->isOk());
        $this->assertSame(['jenis' => 'informasi'], $result->data);
        $this->assertSame(JawabPrompt::system(), $driver->calls[0][0]['content']);
        $this->assertSame(JawabPrompt::VERSION, AiCall::query()->sole()->prompt_version);
    }

    public function test_broken_json_becomes_fallback_and_is_recorded(): void
    {
        $this->driver(['maaf, bukan json']);

        $result = $this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'Halo']);

        $this->assertSame(AiResult::FALLBACK, $result->status);
        $this->assertSame('json_tidak_valid', $result->reason);
        $this->assertSame([AiResult::FALLBACK, 'json_tidak_valid'], [AiCall::query()->sole()->status, AiCall::query()->sole()->error_code]);
    }

    // --- FR-AI-01: coba ulang ---------------------------------------------

    public function test_retries_once_on_server_error_then_succeeds(): void
    {
        $driver = $this->driver([new AiException('down', 'http_503'), '{"jenis":"informasi"}']);

        $result = $this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'Halo']);

        $this->assertTrue($result->isOk());
        $this->assertCount(2, $driver->calls);
        Sleep::assertSleptTimes(1);
        Sleep::assertSlept(fn (CarbonInterval $d) => $d->totalMilliseconds >= 300 && $d->totalMilliseconds <= 800);
        $this->assertSame(['error', 'ok'], AiCall::query()->orderBy('id')->pluck('status')->all());
    }

    public function test_retries_at_most_once(): void
    {
        $driver = $this->driver([new AiException('timeout', 'timeout')]);

        $result = $this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'Halo']);

        $this->assertSame([AiResult::ERROR, 'timeout'], [$result->status, $result->reason]);
        $this->assertCount(2, $driver->calls);
        $this->assertSame(['timeout', 'timeout'], AiCall::query()->orderBy('id')->pluck('status')->all());
    }

    public function test_client_errors_are_not_retried(): void
    {
        $driver = $this->driver([new AiException('kunci salah', 'http_401')]);

        $result = $this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'Halo']);

        $this->assertSame(AiResult::ERROR, $result->status);
        $this->assertCount(1, $driver->calls);
        Sleep::assertNeverSlept();
    }

    // --- FR-AI-03: pemutus sirkuit ----------------------------------------

    public function test_circuit_opens_after_threshold_and_skips_the_provider_until_cooldown(): void
    {
        config(['services.ai.breaker_threshold' => 3, 'services.ai.breaker_cooldown' => 300]);
        $driver = $this->driver([new AiException('kunci salah', 'http_401')]);

        foreach (range(1, 3) as $_) {
            $this->assertSame(AiResult::ERROR, $this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'Halo'])->status);
        }
        $this->assertCount(3, $driver->calls);

        $skipped = $this->gateway()->run(AiTask::SaranTiket, ['aduan' => 'Jalan rusak']);
        $this->assertSame([AiResult::SKIPPED, 'sirkuit_terbuka'], [$skipped->status, $skipped->reason]);
        $this->assertCount(3, $driver->calls, 'Selama sirkuit terbuka, penyedia tidak dipanggil.');

        Carbon::setTestNow(now()->addSeconds(301));
        $this->driver();
        $this->assertTrue($this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'Halo'])->isOk());
    }

    public function test_open_circuit_hands_chat_to_staff_with_the_usual_message(): void
    {
        $this->seed(MasterSeeder::class);
        config(['services.ai.enabled' => true, 'services.ai.breaker_threshold' => 1]);
        Carbon::setTestNow(Carbon::parse('2026-10-13 10:00', 'Asia/Jakarta'));
        $this->driver([new AiException('kunci salah', 'http_401')]);
        $this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'Halo']); // membuka sirkuit

        $this->postJson('/chat/mulai', ['nama' => 'Siti Aminah'])->assertCreated();
        $this->postJson('/chat/pesan', ['body' => 'Bagaimana cara daftar program transmigrasi?'])
            ->assertCreated()
            ->assertJsonPath('balasan.0.body', 'Maaf, asisten sedang tidak dapat menjawab. Pesan Anda kami teruskan ke petugas.')
            ->assertJsonPath('asisten.mode', 'petugas');

        $this->assertSame('ai_gagal', ChatConversation::query()->sole()->handoff_reason);
        $this->assertSame('sirkuit_terbuka', AiCall::query()->latest('id')->first()->error_code);
    }

    // --- FR-AI-03: anggaran token harian ----------------------------------

    public function test_daily_budget_warns_super_admin_at_80_percent_and_stops_at_100(): void
    {
        $this->seed(MasterSeeder::class);
        $admin = User::factory()->admin(UserRole::SuperAdmin)->create();
        Event::fake([NotificationBroadcast::class]);
        $warnings = fn () => Event::dispatched(NotificationBroadcast::class, fn (NotificationBroadcast $e) => $e->payload['event'] === 'ai_anggaran' && $e->userId === $admin->id)->count();
        config(['services.ai.driver' => 'openai', 'services.ai.base_url' => 'https://ai.contoh.test/v1', 'services.ai.daily_token_budget' => 1000]);
        Http::fake(['ai.contoh.test/*' => Http::response([
            'choices' => [['message' => ['content' => '{"jenis":"informasi"}']]],
            'usage' => ['prompt_tokens' => 400, 'completion_tokens' => 50],
        ])]);

        $this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'Satu']);   // 450
        $this->assertSame(0, $warnings());
        $this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'Dua']);    // 900 → 80%
        $this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'Tiga']);   // 1350 → habis
        $this->assertSame(1, $warnings(), 'Peringatan 80% hanya sekali.');

        $result = $this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'Empat']);
        $this->assertSame([AiResult::SKIPPED, 'anggaran_habis'], [$result->status, $result->reason]);
        Http::assertSentCount(3);

        // Anggaran baru setelah tengah malam WIB.
        Carbon::setTestNow(now('Asia/Jakarta')->addDay()->startOfDay()->addMinute());
        $this->assertTrue($this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'Lima'])->isOk());
    }

    // --- FR-AI-03: batas per percakapan -----------------------------------

    public function test_retry_pause_is_random_between_300_and_800_ms(): void
    {
        foreach (range(1, 20) as $_) {
            $this->driver([new AiException('down', 'koneksi'), '{"jenis":"informasi"}']);
            $this->gateway()->run(AiTask::SaranTiket, ['aduan' => 'Jalan rusak']);
        }

        Sleep::assertSleptTimes(20);
        Sleep::assertSlept(fn (CarbonInterval $d) => $d->totalMilliseconds >= 300 && $d->totalMilliseconds <= 800, 20);
    }

    public function test_default_limit_is_20_answers_per_conversation_per_hour(): void
    {
        $this->assertSame(20, config('services.ai.max_calls_per_conversation_hour'));
        $driver = $this->driver();
        $ctx = AiContext::conversation(9);

        foreach (range(1, 20) as $i) {
            $this->assertTrue($this->gateway()->run(AiTask::Jawab, ['pertanyaan' => "q{$i}"], $ctx)->isOk(), "Jawaban ke-{$i} masih diizinkan.");
        }
        $this->assertSame('batas_percakapan', $this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'q21'], $ctx)->reason);
        $this->assertCount(20, $driver->calls);

        // Jam berikutnya boleh lagi; tugas selain Jawab tidak dibatasi.
        $this->assertTrue($this->gateway()->run(AiTask::SaranTiket, ['aduan' => 'x'], $ctx)->isOk());
        Carbon::setTestNow(now('Asia/Jakarta')->addHour()->startOfHour());
        $this->assertTrue($this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'q22'], $ctx)->isOk());
    }

    public function test_exhausted_budget_skips_every_task_and_chat_hands_over_to_staff(): void
    {
        $this->seed(MasterSeeder::class);
        config(['services.ai.enabled' => true, 'services.ai.daily_token_budget' => 100]);
        Carbon::setTestNow(Carbon::parse('2026-10-13 10:00', 'Asia/Jakarta'));
        app(TokenBudget::class)->add(100);
        $driver = $this->driver();

        foreach (AiTask::cases() as $task) {
            $this->assertSame([AiResult::SKIPPED, 'anggaran_habis'], [($r = $this->gateway()->run($task, []))->status, $r->reason]);
        }
        $this->assertCount(0, $driver->calls, 'Anggaran habis: penyedia tidak dipanggil.');

        $this->postJson('/chat/mulai', ['nama' => 'Siti Aminah'])->assertCreated();
        $this->postJson('/chat/pesan', ['body' => 'Bagaimana cara daftar program transmigrasi?'])
            ->assertJsonPath('balasan.0.body', 'Maaf, asisten sedang tidak dapat menjawab. Pesan Anda kami teruskan ke petugas.')
            ->assertJsonPath('asisten.mode', 'petugas');
    }

    public function test_answers_per_conversation_are_limited_per_hour(): void
    {
        config(['services.ai.max_calls_per_conversation_hour' => 2]);
        $driver = $this->driver();
        $ctx = AiContext::conversation(7);

        $this->assertTrue($this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'a'], $ctx)->isOk());
        $this->assertTrue($this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'b'], $ctx)->isOk());
        $third = $this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'c'], $ctx);

        $this->assertSame([AiResult::SKIPPED, 'batas_percakapan'], [$third->status, $third->reason]);
        $this->assertCount(2, $driver->calls);
        $this->assertTrue($this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'd'], AiContext::conversation(8))->isOk(), 'Percakapan lain tidak terpengaruh.');
    }

    // --- FR-AI-02: catatan tanpa teks -------------------------------------

    public function test_calls_are_recorded_with_provider_model_tokens_and_no_text(): void
    {
        config(['services.ai.driver' => 'openai', 'services.ai.base_url' => 'https://ai.contoh.test/v1', 'services.ai.model' => 'model-uji']);
        Http::fake(['ai.contoh.test/*' => Http::response([
            'choices' => [['message' => ['content' => '{"jenis":"informasi"}']]],
            'usage' => ['prompt_tokens' => 812, 'completion_tokens' => 64],
        ])]);

        $this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'Apa syarat daftar? '.$this->pii()], AiContext::conversation(null));

        $call = AiCall::query()->sole();
        $this->assertSame(['jawab', 'ai.contoh.test', 'model-uji', 'ok', 812, 64], [$call->task, $call->provider, $call->model, $call->status, $call->prompt_tokens, $call->completion_tokens]);
        foreach (['prompt', 'response', 'content', 'question', 'answer', 'messages', 'body'] as $textColumn) {
            $this->assertNotContains($textColumn, Schema::getColumnListing('ai_calls'));
        }
        $row = json_encode($call->getAttributes());
        $this->assertStringNotContainsString(self::NIK, $row);
        $this->assertStringNotContainsString('syarat daftar', $row);
    }

    public function test_timeouts_are_recorded_as_timeout(): void
    {
        config(['services.ai.driver' => 'openai', 'services.ai.base_url' => 'https://ai.contoh.test/v1']);
        Http::fake(fn () => throw new ConnectionException('cURL error 28: Operation timed out after 45001 milliseconds'));

        $result = $this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'Halo']);

        $this->assertSame([AiResult::ERROR, 'timeout'], [$result->status, $result->reason]);
        $this->assertSame(['timeout', 'timeout'], AiCall::query()->orderBy('id')->pluck('error_code')->all());
    }

    public function test_task_specific_model_is_used_for_ticket_suggestions(): void
    {
        config(['services.ai.driver' => 'openai', 'services.ai.base_url' => 'https://ai.contoh.test/v1', 'services.ai.model' => 'model-utama', 'services.ai.models.saran_tiket' => 'model-murah']);
        Http::fake(['ai.contoh.test/*' => Http::response(['choices' => [['message' => ['content' => '{"judul":"x"}']]]])]);

        $this->gateway()->run(AiTask::SaranTiket, ['aduan' => 'Jalan rusak']);
        $this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'Halo']);

        Http::assertSent(fn ($r) => $r['model'] === 'model-murah');
        Http::assertSent(fn ($r) => $r['model'] === 'model-utama');
        $this->assertSame(['model-murah', 'model-utama'], AiCall::query()->orderBy('id')->pluck('model')->all());
    }

    public function test_chat_answer_is_linked_to_its_conversation(): void
    {
        $this->seed(MasterSeeder::class);
        config(['services.ai.enabled' => true, 'services.ai.driver' => 'fake']);
        Carbon::setTestNow(Carbon::parse('2026-10-13 10:00', 'Asia/Jakarta'));
        KnowledgeArticle::create([
            'title' => 'Bagaimana cara mendaftar program transmigrasi?',
            'body' => 'Daftar di dinas kabupaten/kota yang membidangi transmigrasi dengan membawa KTP dan KK.',
            'status' => KnowledgeArticle::STATUS_PUBLISHED,
        ]);

        $this->postJson('/chat/mulai', ['nama' => 'Siti Aminah'])->assertCreated();
        $this->postJson('/chat/pesan', ['body' => 'Bagaimana cara daftar program transmigrasi?'])->assertJsonPath('balasan.0.jenis', 'jawaban');

        $this->assertSame(ChatConversation::query()->sole()->id, AiCall::query()->sole()->conversation_id);
    }

    public function test_logging_failure_never_breaks_the_task(): void
    {
        $this->driver();
        Schema::drop('ai_calls');

        $this->assertTrue($this->gateway()->run(AiTask::Jawab, ['pertanyaan' => 'Halo'])->isOk());
    }

    public function test_old_records_are_pruned_after_retention(): void
    {
        config(['services.ai.log_retention_days' => 90]);
        foreach ([91, 89] as $days) {
            (new AiCall)->forceFill(['task' => 'jawab', 'status' => 'ok', 'latency_ms' => 10, 'created_at' => now()->subDays($days)])->save();
        }

        Artisan::call('model:prune', ['--model' => [AiCall::class]]);

        $this->assertSame(1, AiCall::query()->count());
    }
}
