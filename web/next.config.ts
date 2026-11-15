import type { NextConfig } from 'next';
import path from 'node:path';

// Akar repo: deploy/next/Dockerfile mengharapkan .next/standalone/web/server.js (tata letak /repo/web + /repo/sigap).
const root = path.resolve(import.meta.dirname, '..');

const nextConfig: NextConfig = {
    output: 'standalone',
    poweredByHeader: false,
    outputFileTracingRoot: root,
    turbopack: { root },
    // Filesystem container read-only (kecuali /tmp & .next/cache): cache ISR tetap di memori.
    experimental: { isrFlushToDisk: false },
    // next/image dilarang (§8); endpoint /_next/image dimatikan. sharp tetap ikut standalone untuk lampiran chat (S13).
    images: { unoptimized: true },
    // bcryptjs tidak dibundel: tetap paket di node_modules standalone (dilacak lewat src/server/legacy/sandi.ts yang
    // diimpor rute /masuk), karena deploy/next/uji/buat-admin.sh me-require-nya langsung di image cc-web. Pelacak
    // hanya mengikutkan entri ESM yang diimpor worker bcrypt; entri CommonJS (umd/) untuk require() ditambahkan.
    serverExternalPackages: ['bcryptjs'],
    outputFileTracingIncludes: { '/masuk': ['./node_modules/bcryptjs/umd/**'] },
    // CSS & font dari scripts/css-statis.mjs: nama berkas ber-hash konten, aman di-cache permanen.
    headers: async () => [
        { source: '/_cc/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
        // Header keamanan untuk SEMUA respons (termasuk aset), nilai & urutan persis deploy/docker/security-headers.conf
        // produksi app2 (`add_header … always`; HSTS juga di http, diabaikan browser). CSP ber-nonce: src/proxy.ts.
        {
            source: '/:path*',
            headers: [
                { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=()' },
            ],
        },
    ],
    // WebSocket browser → Sockudo lewat origin yang sama. Server standalone meneruskan upgrade WebSocket untuk rewrite
    // ke URL luar (router-server upgradeHandler → proxyRequest, http-proxy ws). Tujuan DITANAM saat build
    // (routes-manifest): bawaan = service compose `sockudo:6001`; env runtime REALTIME_HOST/PORT tidak mengubahnya.
    // Hanya /app/:key (WebSocket); HTTP API Sockudo (/apps/…) tidak diteruskan. Diuji: `../` mentah dinormalkan Next
    // (404), bentuk ter-encode (%2F, %2e%2e, %5C) diteruskan apa adanya di bawah /app/ — tidak keluar dari /app/. Kunci
    // tetap dibatasi pola kunci Pusher agar hanya kunci sah yang sampai ke Sockudo.
    rewrites: async () => [
        {
            source: '/_realtime/app/:key([A-Za-z0-9_-]+)',
            destination: `http://${process.env.REALTIME_HOST || 'sockudo'}:${process.env.REALTIME_PORT || '6001'}/app/:key`,
        },
    ],
};

export default nextConfig;
