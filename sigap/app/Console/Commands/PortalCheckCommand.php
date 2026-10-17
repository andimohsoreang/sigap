<?php

namespace App\Console\Commands;

use App\Models\Portal;
use App\Services\PortalHealthCheck;
use Illuminate\Console\Command;

/** Cek ketersediaan semua portal aktif (dijadwalkan per jam). */
class PortalCheckCommand extends Command
{
    protected $signature = 'sigap:cek-portal';

    protected $description = 'Periksa apakah portal tujuan rujukan dapat diakses';

    public function handle(PortalHealthCheck $health): int
    {
        foreach (Portal::query()->where('is_active', true)->orderBy('sort')->get() as $portal) {
            $ok = $health->check($portal);
            $this->line(($ok ? '✓ ' : '✗ ').$portal->name.' ('.($portal->last_status ?? 'tanpa respons').')');
        }

        return self::SUCCESS;
    }
}
