import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { APP_NAME } from '@/lib/judul';
import './globals.css';

export const metadata: Metadata = {
    title: { default: APP_NAME, template: `%s - ${APP_NAME}` },
};

// Disalin apa adanya dari sigap/resources/views/app.blade.php: tema & aksesibilitas dipasang sebelum paint.
// TODO(S0 gelombang 2): nonce CSP per-request seperti Vite::cspNonce() di Laravel.
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

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        // Skrip di atas menambah kelas pada <html> sebelum hidrasi.
        <html lang="id" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: skripPreferensi }} />
            </head>
            <body className="font-sans antialiased">{children}</body>
        </html>
    );
}
