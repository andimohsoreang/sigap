<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        <title inertia>{{ config('app.name', 'SIGAP') }}</title>

        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=inter:300,400,500,600,700,800" rel="stylesheet" />

        @php
            // A-14: rute Ziggy dibatasi per peran (lihat config/ziggy.php).
            $sigapUser = auth()->user();
            $ziggyGroups = match (true) {
                $sigapUser?->isAdmin() === true => ['public', 'admin'],
                $sigapUser?->role?->value === 'warga' => ['public', 'warga'],
                default => ['public'],
            };
        @endphp

        {{-- N-01: semua <script> inline membawa nonce CSP per-request (SecurityHeaders). --}}
        @routes($ziggyGroups, nonce: \Illuminate\Support\Facades\Vite::cspNonce())
        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
