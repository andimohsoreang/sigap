import { headers } from 'next/headers';
import type { ReactNode } from 'react';

// CSS dibangun scripts/css-statis.mjs dari globals.css (bukan lewat Turbopack) agar identik dengan build Vite Laravel.
import asetCss from './aset-css.json';

// Tanpa judul metadata: <title> halaman dirender <InertiaApp> (lihat src/lib/inertia/head.ts) — dua <title> milik React
// saling berebut elemen yang sama di <head>.

// Disalin apa adanya dari sigap/resources/views/app.blade.php: tema & aksesibilitas dipasang sebelum paint.
const skripPreferensi = `
            (function () {
                try {
                    var d = document.documentElement, t = localStorage.getItem('cc-theme') || 'light';
                    if (t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) d.classList.add('dark');
                    var a = JSON.parse(localStorage.getItem('cc-a11y') || '{}');
                    if (a.text === 1 || a.text === 2) d.classList.add('a11y-text-' + a.text);
                    ['contrast', 'links', 'dyslexia', 'motion', 'focus', 'gray'].forEach(function (k) { if (a[k] === true) d.classList.add('a11y-' + k); });
                } catch (e) {}
            })();
        `;

export default async function RootLayout({ children }: { children: ReactNode }) {
    // Nonce CSP per permintaan dari src/proxy.ts (padanan Vite::cspNonce() di app.blade.php). Membaca header membuat
    // semua halaman dirender per permintaan — syarat nonce (halaman statis tidak bisa membawa nonce).
    const nonce = (await headers()).get('x-nonce') ?? undefined;
    return (
        // Skrip di atas menambah kelas pada <html> sebelum hidrasi.
        <html lang="id" suppressHydrationWarning>
            <head>
                <script nonce={nonce} dangerouslySetInnerHTML={{ __html: skripPreferensi }} />
                {/* Tanpa `precedence`: React tidak memindahkan link ini, jadi urutannya sama dengan Blade (skrip lalu CSS). */}
                <link rel="stylesheet" href={asetCss.href} />
            </head>
            <body className="font-sans antialiased">{children}</body>
        </html>
    );
}
