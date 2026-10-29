<?php

namespace App\Modules\Ai;

/** Konteks pemanggil untuk catatan & batas (mis. percakapan asal). */
final readonly class AiContext
{
    public function __construct(public ?int $conversationId = null) {}

    public static function conversation(?int $id): self
    {
        return new self($id);
    }
}
