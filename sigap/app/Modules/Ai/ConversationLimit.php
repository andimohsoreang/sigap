<?php

namespace App\Modules\Ai;

use Illuminate\Support\Facades\Cache;

/**
 * Batas panggilan `Jawab` per percakapan per jam (PRD-AI FR-AI-03,
 * `AI_MAX_CALLS_PER_CONVERSATION_HOUR`) untuk melindungi dari spam.
 */
final class ConversationLimit
{
    /** Catat satu panggilan; false bila batas jam ini sudah terlewati. */
    public function hit(int $conversationId): bool
    {
        $max = (int) config('services.ai.max_calls_per_conversation_hour', 20);
        if ($max <= 0) {
            return true;
        }

        $key = 'ai:jawab:'.$conversationId.':'.now('Asia/Jakarta')->format('YmdH');
        Cache::add($key, 0, now()->addHours(2));

        return (int) Cache::increment($key) <= $max;
    }
}
