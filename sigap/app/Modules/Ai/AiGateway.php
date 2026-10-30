<?php

namespace App\Modules\Ai;

use App\Models\AiCall;
use App\Services\Ai\AiException;
use App\Services\Ai\PiiMasker;
use App\Services\Ai\Prompts;
use App\Services\Ai\ReportsUsage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Sleep;
use Throwable;

/**
 * Satu pintu semua tugas AI (PRD-AI FR-AI-01):
 * pemutus sirkuit & anggaran → samarkan masukan → susun prompt berversi →
 * panggil penyedia (coba ulang 1×) → urai & validasi JSON → catat `ai_calls`.
 *
 * Gateway tidak pernah melempar galat penyedia: hasil selain `ok` berarti
 * pemanggil memakai jalur cadangan tanpa model (AI mati ≠ chat mati).
 */
final class AiGateway
{
    public function __construct(
        private readonly LlmDrivers $drivers,
        private readonly PiiMasker $masker,
        private readonly CircuitBreaker $breaker,
        private readonly TokenBudget $budget,
        private readonly ConversationLimit $limit,
    ) {}

    /** @param  array<string, mixed>  $input */
    public function run(AiTask $task, array $input, ?AiContext $ctx = null): AiResult
    {
        $conversationId = $ctx?->conversationId;

        if (! $this->breaker->allows()) {
            return $this->skip($task, $conversationId, 'sirkuit_terbuka');
        }
        if ($this->budget->exhausted()) {
            return $this->skip($task, $conversationId, 'anggaran_habis');
        }
        if ($task === AiTask::Jawab && $conversationId !== null && ! $this->limit->hit($conversationId)) {
            return $this->skip($task, $conversationId, 'batas_percakapan');
        }

        $messages = [
            ['role' => 'system', 'content' => $task->systemPrompt()],
            ['role' => 'user', 'content' => (string) json_encode($this->mask($task, $input), JSON_UNESCAPED_UNICODE)],
        ];
        $driver = $this->drivers->for($task);

        for ($attempt = 1; ; $attempt++) {
            $started = hrtime(true);

            try {
                $content = $driver->complete($messages, json: true);
            } catch (Throwable $e) {
                $reason = $e instanceof AiException ? $e->reason : null;
                $this->record($task, $conversationId, $started, $reason === 'timeout' ? AiCall::STATUS_TIMEOUT : AiCall::STATUS_ERROR, $reason ?? class_basename($e), $driver);
                $this->breaker->failure();

                if ($attempt === 1 && $this->retryable($reason) && $this->breaker->allows()) {
                    Sleep::for(random_int(300, 800))->milliseconds();

                    continue;
                }

                return AiResult::error($reason ?? 'galat');
            }

            $this->breaker->success();
            $usage = $driver instanceof ReportsUsage ? $driver->lastUsage() : null;
            $this->budget->add((int) ($usage['prompt'] ?? 0) + (int) ($usage['completion'] ?? 0));

            $data = Prompts::decodeJson($content);
            if ($data === null || ! $task->accepts($data)) {
                $this->record($task, $conversationId, $started, AiResult::FALLBACK, 'json_tidak_valid', $driver);

                return AiResult::fallback('json_tidak_valid');
            }

            return AiResult::ok($data, $this->record($task, $conversationId, $started, AiCall::STATUS_OK, null, $driver));
        }
    }

    /**
     * Samarkan semua teks masukan kecuali konten resmi yang dinyatakan tugas
     * (FR-AI-10). Penyamaran bersifat idempoten.
     *
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function mask(AiTask $task, array $input): array
    {
        $trusted = $task->trustedInput();
        $walk = function (mixed $value) use (&$walk): mixed {
            return match (true) {
                is_string($value) => $this->masker->mask($value),
                is_array($value) => array_map($walk, $value),
                default => $value,
            };
        };

        foreach ($input as $key => $value) {
            if (! in_array($key, $trusted, true)) {
                $input[$key] = $walk($value);
            }
        }

        return $input;
    }

    /** Coba ulang hanya untuk galat jaringan, batas waktu, dan 5xx. */
    private function retryable(?string $reason): bool
    {
        return in_array($reason, ['timeout', 'koneksi'], true) || preg_match('/^http_5\d\d$/', (string) $reason) === 1;
    }

    private function skip(AiTask $task, ?int $conversationId, string $reason): AiResult
    {
        $this->record($task, $conversationId, hrtime(true), AiResult::SKIPPED, $reason, null);

        return AiResult::skipped($reason);
    }

    /**
     * Tandai panggilan yang jawabannya ditolak pengaman server (FR-AI-12),
     * mis. `angka_tanpa_dasar`. Gagal mencatat tidak menggagalkan alur.
     */
    public function reject(?int $callId, string $reason): void
    {
        if ($callId === null) {
            return;
        }

        try {
            AiCall::query()->whereKey($callId)->update(['status' => AiCall::STATUS_REJECTED, 'error_code' => substr($reason, 0, 40)]);
        } catch (Throwable $e) {
            Log::warning('AI: gagal menandai ai_calls ditolak', ['error' => class_basename($e)]);
        }
    }

    /**
     * Catat panggilan tanpa teks; gagal mencatat tidak pernah menggagalkan tugas.
     *
     * @return int|null id baris `ai_calls`
     */
    private function record(AiTask $task, ?int $conversationId, int $started, string $status, ?string $errorCode, mixed $driver): ?int
    {
        try {
            $usage = $driver instanceof ReportsUsage ? $driver->lastUsage() : null;
            $meta = $this->drivers->describe($task);

            return AiCall::query()->create([
                'task' => $task->value,
                'prompt_version' => $task->promptVersion(),
                'provider' => $meta['provider'],
                'model' => $meta['model'],
                'status' => $status,
                'latency_ms' => (int) round((hrtime(true) - $started) / 1_000_000),
                'prompt_tokens' => $status === AiCall::STATUS_OK || $status === AiResult::FALLBACK ? ($usage['prompt'] ?? null) : null,
                'completion_tokens' => $status === AiCall::STATUS_OK || $status === AiResult::FALLBACK ? ($usage['completion'] ?? null) : null,
                'conversation_id' => $conversationId,
                'error_code' => $errorCode === null ? null : substr($errorCode, 0, 40),
            ])->id;
        } catch (Throwable $e) {
            Log::warning('AI: gagal mencatat ai_calls', ['error' => class_basename($e)]);

            return null;
        }
    }
}
