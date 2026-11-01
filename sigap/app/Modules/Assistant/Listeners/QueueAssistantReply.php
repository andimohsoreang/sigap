<?php

namespace App\Modules\Assistant\Listeners;

use App\Modules\Assistant\AssistantServiceProvider;
use App\Modules\Assistant\Jobs\RespondToMessage;
use App\Modules\ContactCenter\Events\CitizenMessageReceived;

/** Antrekan jawaban TARA di antrean `ai` (didaftarkan {@see AssistantServiceProvider}). */
final class QueueAssistantReply
{
    public function handle(CitizenMessageReceived $event): void
    {
        RespondToMessage::dispatch($event->conversationId, $event->messageId);
    }
}
