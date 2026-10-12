<?php

/*
|--------------------------------------------------------------------------
| Proxy Tepercaya (N-03)
|--------------------------------------------------------------------------
| Dibaca oleh Illuminate\Http\Middleware\TrustProxies saat request. Isi env
| TRUSTED_PROXIES dengan daftar IP/CIDR dipisah koma, mis. "127.0.0.1".
| Kosong (default lokal) = tidak ada proxy yang dipercaya. Wildcard '*'/'**'
| sengaja dibuang: header X-Forwarded-* dari klien tidak boleh dipercaya.
*/

$proxies = array_values(array_filter(
    array_map('trim', explode(',', (string) env('TRUSTED_PROXIES', ''))),
    fn (string $ip) => $ip !== '' && $ip !== '*' && $ip !== '**',
));

return [
    'proxies' => $proxies === [] ? null : $proxies,
];
