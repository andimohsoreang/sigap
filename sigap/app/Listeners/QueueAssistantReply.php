<?php

namespace App\Listeners;

use App\Events\CitizenMessageReceived;
use App\Jobs\RespondToMessage;

/** Antrekan jawaban TARA di antrean `ai` (didaftarkan otomatis lewat event discovery). */
final class QueueAssistantReply
{
    public function handle(CitizenMessageReceived $event): void
    {
        RespondToMessage::dispatch($event->conversationId, $event->messageId);
    }
}
