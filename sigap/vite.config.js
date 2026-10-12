import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            ssr: 'resources/js/ssr.jsx',
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
    esbuild: {
        jsx: 'automatic',
    },
    server: {
        // Dev server hanya di loopback IPv4: tidak terekspos ke LAN, dan alamat
        // di public/hot (http://127.0.0.1:5173) valid sebagai sumber CSP lokal
        // (literal IPv6 seperti [::1] tidak didukung sintaks CSP).
        host: '127.0.0.1',
    },
});
