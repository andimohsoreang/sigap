import type { NextConfig } from 'next';
import path from 'node:path';

// Akar repo: Tailwind memindai ../sigap (lihat postcss.config.mjs) dan Turbopack menolak dependensi di luar root.
const root = path.resolve(import.meta.dirname, '..');

const nextConfig: NextConfig = {
    output: 'standalone',
    outputFileTracingRoot: root,
    turbopack: { root },
    // Filesystem container read-only (kecuali /tmp & .next/cache): cache ISR tetap di memori.
    experimental: { isrFlushToDisk: false },
};

export default nextConfig;
