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
    // CSS & font dari scripts/css-statis.mjs: nama berkas ber-hash konten, aman di-cache permanen.
    headers: async () => [{ source: '/_cc/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }],
    // WebSocket browser → Sockudo lewat origin yang sama. Server standalone meneruskan upgrade WebSocket untuk rewrite
    // ke URL luar (router-server upgradeHandler → proxyRequest, http-proxy ws). Tujuan DITANAM saat build
    // (routes-manifest): bawaan = service compose `sockudo:6001`; env runtime REALTIME_HOST/PORT tidak mengubahnya.
    // Hanya /app/:key (WebSocket); HTTP API Sockudo (/apps/…) tidak diteruskan.
    rewrites: async () => [
        {
            source: '/_realtime/app/:key',
            destination: `http://${process.env.REALTIME_HOST || 'sockudo'}:${process.env.REALTIME_PORT || '6001'}/app/:key`,
        },
    ],
};

export default nextConfig;
