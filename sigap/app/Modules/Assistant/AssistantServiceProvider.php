<?php

namespace App\Modules\Assistant;

use App\Modules\Assistant\Listeners\QueueAssistantReply;
use App\Modules\ContactCenter\Events\CitizenMessageReceived;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

/**
 * Modul Assistant mendengarkan pesan warga dari ContactCenter (PRD-AI §4.2):
 * ContactCenter tidak memanggil Assistant langsung, cukup memancarkan event.
 */
final class AssistantServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Event::listen(CitizenMessageReceived::class, QueueAssistantReply::class);
    }
}
