<?php

namespace App\Services;

use App\Models\Portal;
use Illuminate\Support\Facades\Http;

/**
 * Cek ketersediaan portal tujuan. Portal yang tidak dapat diakses tidak
 * ditawarkan ke warga; percakapan diteruskan ke petugas sebagai gantinya.
 *
 * Status < 500 dianggap tersedia (403/401 berarti server hidup tapi butuh
 * login). Kegagalan jaringan atau 5xx = tidak tersedia.
 */
class PortalHealthCheck
{
    public function check(Portal $portal): bool
    {
        $status = null;
        try {
            $status = Http::timeout(8)->connectTimeout(5)->withHeaders(['User-Agent' => 'ContactCenter-PortalCheck/1.0'])
                ->get($portal->destination())->status();
            $reachable = $status < 500;
        } catch (\Throwable) {
            $reachable = false;
        }

        $portal->forceFill([
            'is_reachable' => $reachable,
            'last_status' => $status,
            'last_checked_at' => now(),
        ])->save();

        return $reachable;
    }
}
