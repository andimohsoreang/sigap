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
class OpenAiCompatibleClient implements LlmClient
{
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

            throw new AiException('Model AI tidak dapat dihubungi.');
        }

        $content = trim((string) $response->json('choices.0.message.content'));

        if ($content === '') {
            throw new AiException('Model AI membalas kosong.');
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

            return null;
        }
    }
}
