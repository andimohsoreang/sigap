import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { configureEcho } from '@laravel/echo-react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { route as routeFn } from 'ziggy-js';
import { reverbClientOptions } from './lib/reverb';

// Reverb (PRD D5). Nilai VITE_REVERB_* DITANAM saat `npm run build`, jadi
// .env harus sudah benar SEBELUM build (lihat docs/DEPLOY.md). Bila key
// kosong, realtime dilewati: komponen memeriksa echoIsConfigured() dan
// kembali ke polling — halaman tidak boleh crash karena Echo.
const reverb = reverbClientOptions(import.meta.env);
if (reverb) {
    try {
        configureEcho({ broadcaster: 'reverb', ...reverb });
    } catch (error) {
        console.warn('[Contact Center] Realtime (Reverb) dinonaktifkan:', error);
    }
}

declare global {
    const route: typeof routeFn;
}

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, import.meta.glob('./pages/**/*.tsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    progress: {
        color: '#4B5563',
    },
});
