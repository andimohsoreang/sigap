<?php

namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;

/**
 * Pesan warga/tamu tersimpan dan butuh jawaban model (PRD-AI FR-AI-04).
 * Dipancarkan ContactCenter; Assistant menanggapinya lewat antrean `ai`.
 */
final class CitizenMessageReceived
{
    use Dispatchable;

    public function __construct(
        public readonly int $conversationId,
        public readonly int $messageId,
    ) {}
}
