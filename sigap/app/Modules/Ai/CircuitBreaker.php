<?php

namespace App\Modules\Ai;

use Illuminate\Support\Facades\Cache;

/**
 * Pemutus sirkuit penyedia AI (PRD-AI FR-AI-03): ≥ `AI_BREAKER_THRESHOLD`
 * kegagalan dalam 2 menit → terbuka selama `AI_BREAKER_COOLDOWN` detik.
 * Selama terbuka, model tidak dipanggil sehingga warga langsung diteruskan ke
 * petugas tanpa menunggu batas waktu. Status disimpan di cache aplikasi.
 */
final class CircuitBreaker
{
    private const FAILURES = 'ai:sirkuit:gagal';

    private const OPEN_UNTIL = 'ai:sirkuit:terbuka_sampai';

    private const WINDOW_SECONDS = 120;

    public function allows(): bool
    {
        return now()->getTimestamp() >= (int) Cache::get(self::OPEN_UNTIL, 0);
    }

    public function failure(): void
    {
        $now = now()->getTimestamp();
        $recent = array_values(array_filter(
            (array) Cache::get(self::FAILURES, []),
            fn ($t) => is_int($t) && $t > $now - self::WINDOW_SECONDS,
        ));
        $recent[] = $now;

        if (count($recent) >= max(1, (int) config('services.ai.breaker_threshold', 5))) {
            Cache::put(self::OPEN_UNTIL, $now + max(1, (int) config('services.ai.breaker_cooldown', 300)), now()->addDay());
            Cache::forget(self::FAILURES);

            return;
        }

        Cache::put(self::FAILURES, $recent, self::WINDOW_SECONDS);
    }

    public function success(): void
    {
        Cache::forget(self::FAILURES);
    }
}
