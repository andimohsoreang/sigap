<?php

namespace App\Services\Ai;

use App\Models\AiCall;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Pembungkus pencatat di sekitar driver {@see LlmClient} (PRD-AI Tahap 0):
 * setiap panggilan dicatat ke `ai_calls` — tugas, versi prompt, penyedia,
 * model, status, waktu, token — TANPA isi pertanyaan maupun jawaban.
 *
 * Perilaku tidak berubah: hasil dan galat driver diteruskan apa adanya, dan
 * gagal mencatat tidak pernah menggagalkan panggilan.
 */
class RecordingLlmClient implements LlmClient
{
    /** Baris pertama prompt sistem → nama tugas (PRD-AI FR-AI-01). */
    private const TASKS = [
        Prompts::TASK_ANSWER => 'jawab',
        Prompts::TASK_PROPOSE => 'usul_artikel',
        Prompts::TASK_TICKET => 'saran_tiket',
    ];

    public function __construct(
        private readonly LlmClient $inner,
        private readonly AiCallContext $context,
        private readonly ?string $provider,
        private readonly ?string $model,
    ) {}

    public function complete(array $messages, bool $json = false): string
    {
        $started = hrtime(true);

        try {
            $content = $this->inner->complete($messages, $json);
        } catch (Throwable $e) {
            $reason = $e instanceof AiException ? $e->reason : null;
            $this->record($messages, $started, $reason === 'timeout' ? AiCall::STATUS_TIMEOUT : AiCall::STATUS_ERROR, $reason ?? class_basename($e));

            throw $e;
        }

        $this->record($messages, $started, AiCall::STATUS_OK, null);

        return $content;
    }

    /** Driver yang dibungkus (penyedia sebenarnya). */
    public function driver(): LlmClient
    {
        return $this->inner;
    }

    /** @param  array<int, array{role: string, content: string}>  $messages */
    private function record(array $messages, int $started, string $status, ?string $errorCode): void
    {
        try {
            $system = (string) (collect($messages)->firstWhere('role', 'system')['content'] ?? '');
            $task = self::TASKS[strtok($system, "\n") ?: ''] ?? 'lainnya';
            $usage = $this->inner instanceof ReportsUsage ? $this->inner->lastUsage() : null;

            AiCall::query()->create([
                'task' => $task,
                // Tahap 0: sidik jari isi prompt sistem; versi bernama menyusul di Tahap 1 (FR-AI-06).
                'prompt_version' => $system === '' ? null : $task.'#'.substr(hash('sha256', $system), 0, 10),
                'provider' => $this->provider,
                'model' => $this->model,
                'status' => $status,
                'latency_ms' => (int) round((hrtime(true) - $started) / 1_000_000),
                'prompt_tokens' => $usage['prompt'] ?? null,
                'completion_tokens' => $usage['completion'] ?? null,
                'conversation_id' => $this->context->conversationId(),
                'error_code' => $errorCode === null ? null : substr($errorCode, 0, 40),
            ]);
        } catch (Throwable $e) {
            Log::warning('AI: gagal mencatat ai_calls', ['error' => class_basename($e)]);
        }
    }
}
