<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        {{-- Tema & aksesibilitas dipasang sebelum halaman tampil agar tidak berkedip.
             Kunci & kelas sama dengan resources/js/lib/preferences.ts. --}}
        <script nonce="{{ \Illuminate\Support\Facades\Vite::cspNonce() }}">
            (function () {
                try {
                    var d = document.documentElement, t = localStorage.getItem('cc-theme') || 'light';
                    if (t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) d.classList.add('dark');
                    var a = JSON.parse(localStorage.getItem('cc-a11y') || '{}');
                    if (a.text === 1 || a.text === 2) d.classList.add('a11y-text-' + a.text);
                    ['contrast', 'links', 'dyslexia', 'motion', 'focus', 'gray'].forEach(function (k) { if (a[k] === true) d.classList.add('a11y-' + k); });
                    if (a.dyslexia === true) {
                        var l = document.createElement('link');
                        l.rel = 'stylesheet'; l.href = 'https://fonts.bunny.net/css?family=atkinson-hyperlegible:400,400i,700'; l.setAttribute('data-cc-font', '');
                        document.head.appendChild(l);
                    }
                } catch (e) {}
            })();
        </script>

        <title inertia>{{ config('app.name', 'Contact Center') }}</title>

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
