<?php

namespace App\Services\Ai;

use Carbon\CarbonInterface;

/** Jam layanan petugas contact center (`services.ai.service_hours`). */
class ServiceHours
{
    public function isOpen(?CarbonInterface $at = null): bool
    {
        $config = config('services.ai.service_hours');
        $now = ($at ?? now())->copy()->setTimezone($config['timezone']);

        if (! in_array($now->dayOfWeekIso, array_map('intval', $config['days']), true)) {
            return false;
        }

        $time = $now->format('H:i');

        return $time >= $config['start'] && $time < $config['end'];
    }

    public function label(): string
    {
        return (string) config('services.ai.service_hours.label');
    }
}
