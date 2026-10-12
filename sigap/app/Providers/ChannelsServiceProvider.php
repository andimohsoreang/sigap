<?php

namespace App\Providers;

use App\Services\Channels\ChannelAdapterManager;
use Illuminate\Support\ServiceProvider;

class ChannelsServiceProvider extends ServiceProvider
{
    /**
     * Binding adapter kanal nasional (PRD D7 — stub dulu).
     *
     * Untuk mengaktifkan integrasi nyata nanti, cukup ganti kelas di sini
     * dengan implementasi HTTP; seluruh aplikasi (controller/UI) tidak berubah.
     */
    public function register(): void
    {
        $this->app->singleton(ChannelAdapterManager::class);
    }

    public function boot(): void
    {
        //
    }
}
