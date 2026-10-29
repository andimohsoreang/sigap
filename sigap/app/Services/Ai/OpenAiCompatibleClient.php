<?php

namespace App\Services\Ai;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Endpoint Chat Completions kompatibel OpenAI:
 * - OpenCode Zen : https://opencode.ai/inference/openai/v1
 * - Ollama       : http://localhost:11434/v1
 * - vLLM         : http://<server>:8000/v1
 * - Sumopod AI   : https://ai.sumopod.com/v1
 *
 * Model penalaran (mis. deepseek-v4-flash) "berpikir" dulu sebelum menjawab:
 * lambat dan bisa menghabiskan jatah token sebelum jawaban keluar. Isi
 * `reasoning_effort` (mis. "none") untuk mematikannya.
 */
class OpenAiCompatibleClient implements LlmClient, ReportsUsage
{
    /** @var array{prompt: int|null, completion: int|null}|null */
    private ?array $usage = null;

    /** Alasan galat koneksi terakhir (untuk catatan `ai_calls`). */
    private ?string $connectionError = null;

    public function __construct(
        private readonly string $baseUrl,
        private readonly ?string $apiKey,
        private readonly string $model,
        private readonly int $timeout = 45,
        private readonly int $maxTokens = 900,
        private readonly ?string $reasoningEffort = null,
    ) {}

    public function complete(array $messages, bool $json = false): string
    {
        $this->usage = null;
        $this->connectionError = null;

        $payload = [
            'model' => $this->model,
            'messages' => $messages,
            'temperature' => 0.2,
            'max_tokens' => $this->maxTokens,
        ];
        if ($this->reasoningEffort !== null && $this->reasoningEffort !== '') {
            $payload['reasoning_effort'] = $this->reasoningEffort;
        }

        $response = $this->send($json ? $payload + ['response_format' => ['type' => 'json_object']] : $payload);

        // Sebagian model/penyedia menolak `response_format`; ulangi tanpa itu.
        if ($json && $response?->status() === 400) {
            $response = $this->send($payload);
        }

        if ($response === null || ! $response->successful()) {
            Log::warning('AI: permintaan gagal', ['status' => $response?->status(), 'model' => $this->model]);

            throw new AiException('Model AI tidak dapat dihubungi.', $response === null ? $this->connectionError : 'http_'.$response->status());
        }

        $usage = $response->json('usage');
        $this->usage = is_array($usage) ? [
            'prompt' => isset($usage['prompt_tokens']) ? (int) $usage['prompt_tokens'] : null,
            'completion' => isset($usage['completion_tokens']) ? (int) $usage['completion_tokens'] : null,
        ] : null;

        $content = trim((string) $response->json('choices.0.message.content'));

        if ($content === '') {
            throw new AiException('Model AI membalas kosong.', 'kosong');
        }

        return $content;
    }

    private function send(array $payload): ?Response
    {
        try {
            return Http::acceptJson()
                ->withToken((string) $this->apiKey)
                ->timeout($this->timeout)
                ->post($this->baseUrl.'/chat/completions', $payload);
        } catch (ConnectionException $e) {
            Log::warning('AI: koneksi gagal — '.$e->getMessage());
            $this->connectionError = preg_match('/timed out|cURL error 28/i', $e->getMessage()) ? 'timeout' : 'koneksi';

            return null;
        }
    }

    public function lastUsage(): ?array
    {
        return $this->usage;
    }
}
