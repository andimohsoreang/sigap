<?php

namespace App\Services\Ai;

/**
 * Konteks panggilan AI yang sedang berjalan (saat ini: percakapan asal) agar
 * catatan `ai_calls` dapat dikaitkan ke percakapan tanpa mengubah antarmuka
 * {@see LlmClient}. Terikat sebagai `scoped` sehingga bersih per request/job.
 */
class AiCallContext
{
    private ?int $conversationId = null;

    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public function forConversation(?int $conversationId, callable $callback): mixed
    {
        $previous = $this->conversationId;
        $this->conversationId = $conversationId;

        try {
            return $callback();
        } finally {
            $this->conversationId = $previous;
        }
    }

    public function conversationId(): ?int
    {
        return $this->conversationId;
    }
}
