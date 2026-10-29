<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;

/**
 * Satu panggilan model AI (PRD-AI FR-AI-02): tugas, penyedia, status, waktu,
 * token. Sengaja tanpa kolom teks — isi percakapan sudah ada di chat_messages.
 *
 * @property string $task
 * @property string|null $prompt_version
 * @property string|null $provider
 * @property string|null $model
 * @property string $status
 * @property int $latency_ms
 * @property int|null $prompt_tokens
 * @property int|null $completion_tokens
 * @property int|null $conversation_id
 * @property string|null $error_code
 */
class AiCall extends Model
{
    use Prunable;

    public const UPDATED_AT = null;

    public const STATUS_OK = 'ok';

    public const STATUS_ERROR = 'error';

    public const STATUS_TIMEOUT = 'timeout';

    protected $fillable = [
        'task', 'prompt_version', 'provider', 'model', 'status', 'latency_ms',
        'prompt_tokens', 'completion_tokens', 'conversation_id', 'error_code',
    ];

    protected function casts(): array
    {
        return [
            'latency_ms' => 'integer',
            'prompt_tokens' => 'integer',
            'completion_tokens' => 'integer',
        ];
    }

    /** Retensi `AI_LOG_RETENTION_DAYS` (bawaan 90 hari) lewat `model:prune`. */
    public function prunable(): Builder
    {
        return static::query()->where('created_at', '<', now()->subDays(max(1, (int) config('services.ai.log_retention_days', 90))));
    }
}
