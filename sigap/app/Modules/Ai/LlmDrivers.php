<?php

namespace App\Modules\Ai;

use App\Services\Ai\FakeLlmClient;
use App\Services\Ai\LlmClient;
use App\Services\Ai\OpenAiCompatibleClient;
use Illuminate\Contracts\Container\Container;

/**
 * Memilih driver model per tugas (PRD-AI FR-AI-09): `fake` atau `openai`
 * (semua penyedia kompatibel OpenAI). Model khusus tugas
 * (`AI_MODEL_SARAN_TIKET`, `AI_MODEL_USUL_ARTIKEL`) hanya berlaku untuk
 * driver `openai`; selain itu dipakai driver bawaan dari container.
 */
final class LlmDrivers
{
    public function __construct(private readonly Container $app) {}

    /** Driver bawaan dari konfigurasi (dipakai binding container). */
    public static function fromConfig(): LlmClient
    {
        $ai = config('services.ai');

        return $ai['driver'] === 'openai'
            ? new OpenAiCompatibleClient($ai['base_url'], $ai['api_key'], $ai['model'], $ai['timeout'], $ai['max_tokens'], $ai['reasoning_effort'] ?? null)
            : new FakeLlmClient;
    }

    public function for(AiTask $task): LlmClient
    {
        $ai = config('services.ai');
        $override = $this->override($task);

        if ($override !== null) {
            return new OpenAiCompatibleClient($ai['base_url'], $ai['api_key'], $override, $ai['timeout'], $ai['max_tokens'], $ai['reasoning_effort'] ?? null);
        }

        return $this->app->make(LlmClient::class);
    }

    /** @return array{provider: string|null, model: string|null} untuk catatan `ai_calls` */
    public function describe(AiTask $task): array
    {
        $ai = config('services.ai');
        if ($ai['driver'] !== 'openai') {
            return ['provider' => (string) $ai['driver'], 'model' => (string) $ai['driver']];
        }

        return [
            'provider' => parse_url((string) $ai['base_url'], PHP_URL_HOST) ?: null,
            'model' => $this->override($task) ?? $ai['model'],
        ];
    }

    private function override(AiTask $task): ?string
    {
        $key = $task->modelKey();
        $model = $key === null ? null : config("services.ai.models.{$key}");

        return config('services.ai.driver') === 'openai' && is_string($model) && $model !== '' ? $model : null;
    }
}
