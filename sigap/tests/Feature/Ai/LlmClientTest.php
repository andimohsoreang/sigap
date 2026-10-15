<?php

namespace Tests\Feature\Ai;

use App\Services\Ai\AiException;
use App\Services\Ai\FakeLlmClient;
use App\Services\Ai\LlmClient;
use App\Services\Ai\OpenAiCompatibleClient;
use App\Services\Ai\PiiMasker;
use App\Services\Ai\Prompts;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class LlmClientTest extends TestCase
{
    private function client(): OpenAiCompatibleClient
    {
        return new OpenAiCompatibleClient('https://ai.test/v1', 'kunci-uji', 'model-uji');
    }

    public function test_openai_compatible_client_posts_chat_completion_and_returns_content(): void
    {
        Http::fake(['ai.test/*' => Http::response(['choices' => [['message' => ['content' => ' Halo ']]]])]);

        $this->assertSame('Halo', $this->client()->complete([['role' => 'user', 'content' => 'hai']], json: true));

        Http::assertSent(fn (Request $r) => $r->url() === 'https://ai.test/v1/chat/completions'
            && $r->hasHeader('Authorization', 'Bearer kunci-uji')
            && $r['model'] === 'model-uji'
            && $r['response_format'] === ['type' => 'json_object']);
    }

    public function test_client_retries_without_response_format_when_provider_rejects_it(): void
    {
        Http::fake(['ai.test/*' => Http::sequence()
            ->push(['error' => 'response_format tidak didukung'], 400)
            ->push(['choices' => [['message' => ['content' => '{"ok":true}']]]])]);

        $this->assertSame('{"ok":true}', $this->client()->complete([['role' => 'user', 'content' => 'x']], json: true));

        Http::assertSentCount(2);
    }

    public function test_client_throws_on_server_error(): void
    {
        Http::fake(['ai.test/*' => Http::response([], 503)]);

        $this->expectException(AiException::class);
        $this->client()->complete([['role' => 'user', 'content' => 'x']]);
    }

    public function test_driver_is_chosen_from_config(): void
    {
        config(['services.ai.driver' => 'fake']);
        $this->assertInstanceOf(FakeLlmClient::class, app(LlmClient::class));

        config(['services.ai.driver' => 'openai']);
        $this->assertInstanceOf(OpenAiCompatibleClient::class, app(LlmClient::class));
    }

    public function test_masker_hides_nik_phone_email_and_long_numbers(): void
    {
        $masked = (new PiiMasker)->mask('NIK 3201234567890123, HP 0812-3456-7890 / +6281234567890, surel budi@contoh.id, rek 1234567890');

        $this->assertSame('NIK [NIK], HP [NOMOR HP] / [NOMOR HP], surel [SUREL], rek [NOMOR]', $masked);
    }

    public function test_masker_keeps_ticket_numbers_and_short_numbers(): void
    {
        $text = 'Tiket TKT-261012-7KQ4MZ sejak 3 bulan, jalan 2 km';

        $this->assertSame($text, (new PiiMasker)->mask($text));
    }

    public function test_decode_json_tolerates_fences_and_preamble(): void
    {
        $this->assertSame(['a' => 1], Prompts::decodeJson("Berikut:\n```json\n{\"a\":1}\n```"));
        $this->assertNull(Prompts::decodeJson('bukan json'));
    }
}
