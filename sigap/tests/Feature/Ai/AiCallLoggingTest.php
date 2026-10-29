<?php

namespace Tests\Feature\Ai;

use App\Models\AiCall;
use App\Models\ChatConversation;
use App\Models\KnowledgeArticle;
use App\Services\Ai\AiException;
use App\Services\Ai\LlmClient;
use App\Services\Ai\Prompts;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * PRD-AI Tahap 0 (FR-AI-02): setiap panggilan model tercatat di `ai_calls`
 * tanpa isi teks, dan pencatatan tidak mengubah perilaku panggilan.
 */
class AiCallLoggingTest extends TestCase
{
    use RefreshDatabase;

    private const QUESTION = 'Apa syarat daftar transmigrasi? NIK saya 3201234567890123';

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function answerMessages(): array
    {
        return [
            ['role' => 'system', 'content' => Prompts::answer()],
            ['role' => 'user', 'content' => json_encode(['pertanyaan' => self::QUESTION, 'sumber' => []])],
        ];
    }

    public function test_each_task_is_recorded_without_any_text(): void
    {
        config(['services.ai.driver' => 'fake']);
        $client = app(LlmClient::class);

        $client->complete($this->answerMessages(), json: true);
        $client->complete([['role' => 'system', 'content' => Prompts::propose()], ['role' => 'user', 'content' => '{}']], json: true);
        $client->complete([['role' => 'system', 'content' => Prompts::ticket()], ['role' => 'user', 'content' => '{}']], json: true);

        $this->assertSame(['jawab', 'usul_artikel', 'saran_tiket'], AiCall::query()->orderBy('id')->pluck('task')->all());

        $call = AiCall::query()->where('task', 'jawab')->sole();
        $this->assertSame(AiCall::STATUS_OK, $call->status);
        $this->assertSame('fake', $call->provider);
        $this->assertStringStartsWith('jawab#', (string) $call->prompt_version);
        $this->assertGreaterThanOrEqual(0, $call->latency_ms);

        // Tidak ada kolom teks, dan tidak ada potongan pertanyaan di baris mana pun.
        $columns = Schema::getColumnListing('ai_calls');
        foreach (['prompt', 'response', 'content', 'question', 'answer', 'messages', 'body'] as $textColumn) {
            $this->assertNotContains($textColumn, $columns);
        }
        foreach (AiCall::query()->get() as $row) {
            $this->assertStringNotContainsString('3201234567890123', json_encode($row->getAttributes()));
            $this->assertStringNotContainsString('syarat daftar', json_encode($row->getAttributes()));
        }
    }

    public function test_openai_driver_records_provider_host_model_and_tokens(): void
    {
        config(['services.ai.driver' => 'openai', 'services.ai.base_url' => 'https://ai.contoh.test/v1', 'services.ai.model' => 'model-uji']);
        Http::fake(['ai.contoh.test/*' => Http::response([
            'choices' => [['message' => ['content' => '{"jenis":"informasi"}']]],
            'usage' => ['prompt_tokens' => 812, 'completion_tokens' => 64],
        ])]);

        $this->assertSame('{"jenis":"informasi"}', app(LlmClient::class)->complete($this->answerMessages(), json: true));

        $call = AiCall::query()->sole();
        $this->assertSame('ai.contoh.test', $call->provider);
        $this->assertSame('model-uji', $call->model);
        $this->assertSame(812, $call->prompt_tokens);
        $this->assertSame(64, $call->completion_tokens);
        $this->assertSame(AiCall::STATUS_OK, $call->status);
    }

    public function test_provider_errors_are_recorded_and_rethrown_unchanged(): void
    {
        config(['services.ai.driver' => 'openai', 'services.ai.base_url' => 'https://ai.contoh.test/v1']);
        Http::fake(['ai.contoh.test/*' => Http::response('down', 503)]);

        try {
            app(LlmClient::class)->complete($this->answerMessages());
            $this->fail('AiException diharapkan.');
        } catch (AiException $e) {
            $this->assertSame('Model AI tidak dapat dihubungi.', $e->getMessage());
        }

        $call = AiCall::query()->sole();
        $this->assertSame(AiCall::STATUS_ERROR, $call->status);
        $this->assertSame('http_503', $call->error_code);
    }

    public function test_timeouts_are_recorded_as_timeout(): void
    {
        config(['services.ai.driver' => 'openai', 'services.ai.base_url' => 'https://ai.contoh.test/v1']);
        Http::fake(fn () => throw new ConnectionException('cURL error 28: Operation timed out after 45001 milliseconds'));

        $this->expectException(AiException::class);

        try {
            app(LlmClient::class)->complete($this->answerMessages());
        } finally {
            $call = AiCall::query()->sole();
            $this->assertSame(AiCall::STATUS_TIMEOUT, $call->status);
            $this->assertSame('timeout', $call->error_code);
        }
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
        $this->postJson('/chat/pesan', ['body' => 'Bagaimana cara daftar program transmigrasi?'])
            ->assertCreated()
            ->assertJsonPath('balasan.0.jenis', 'jawaban');

        $call = AiCall::query()->sole();
        $this->assertSame('jawab', $call->task);
        $this->assertSame(ChatConversation::query()->sole()->id, $call->conversation_id);
    }

    public function test_logging_failure_never_breaks_the_call(): void
    {
        config(['services.ai.driver' => 'fake']);
        Schema::drop('ai_calls');

        $content = app(LlmClient::class)->complete($this->answerMessages(), json: true);

        $this->assertNotSame('', $content);
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
