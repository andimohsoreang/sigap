<?php

namespace App\Console\Commands;

use App\Models\Channel;
use App\Services\Channels\ChannelAdapterManager;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Sinkronisasi harian kanal nasional (STUB adapter — PRD D7 / TECH-SPEC §8).
 *
 * Dijadwalkan harian. Setiap adapter menulis `channel_sync_logs` sendiri,
 * jadi command ini hanya memilih adapter, menandai `channels.last_synced_at`,
 * lalu mengirim ringkasan ke PIC bila ada kegagalan.
 */
class SyncChannelsCommand extends Command
{
    protected $signature = 'sigap:sync-channels {--channel= : Hanya kanal tertentu (sp4n|wbs)}';

    protected $description = 'Sinkronisasi kanal pengaduan nasional (stub) dan tulis log';

    public function __construct(
        private readonly ChannelAdapterManager $adapters,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $keys = $this->option('channel')
            ? [Str::lower((string) $this->option('channel'))]
            : $this->adapters->keys();

        $exitCode = self::SUCCESS;

        foreach ($keys as $key) {
            try {
                $result = $this->adapters->for($key)->sync();

                Channel::query()
                    ->where('name', 'like', '%'.($key === 'wbs' ? 'Whistle' : 'SP4N').'%')
                    ->update(['last_synced_at' => now()]);

                $this->info(sprintf('%-5s %s (%d tiket)', $key, $result->status, $result->pulledCount));
            } catch (\Throwable $e) {
                $exitCode = self::FAILURE;
                $this->error("{$key}: {$e->getMessage()}");
                Log::error('Sinkronisasi kanal gagal', ['channel' => $key, 'error' => $e->getMessage()]);
            }
        }

        return $exitCode;
    }
}