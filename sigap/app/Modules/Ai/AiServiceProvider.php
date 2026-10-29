<?php

namespace App\Modules\Ai;

use App\Services\Ai\LlmClient;
use Illuminate\Support\ServiceProvider;

/** Modul Ai: driver model dipasang di sini, hanya dipakai {@see AiGateway}. */
final class AiServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(LlmClient::class, fn () => LlmDrivers::fromConfig());
    }
}
