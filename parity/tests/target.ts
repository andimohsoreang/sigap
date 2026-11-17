import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Target suite: `laravel` (acuan, bawaan) atau `next`. Hanya perbedaan yang DISENGAJA dan tercatat di
 * docs/slices/S1.md ("Perbedaan yang disengaja") yang boleh bergantung pada target; selain itu harapan identik.
 */
export const TARGET = (process.env.TARGET ?? 'laravel') as 'laravel' | 'next';
if (TARGET !== 'laravel' && TARGET !== 'next') throw new Error(`TARGET harus laravel atau next, bukan ${String(TARGET)}`);

/** Port bawaan target lokal (scripts/laravel.sh, scripts/next.sh); PARITAS_PORT menggantinya. */
export const PORT = Number(process.env.PARITAS_PORT ?? (TARGET === 'next' ? 3124 : 8124));
export const BASE_URL = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Nilai env/laravel.env (sintaks KEY=nilai / KEY="nilai"; komentar & baris kosong dilewati). */
const laravelEnv: Record<string, string> = Object.fromEntries(
    readFileSync(path.join(root, 'env/laravel.env'), 'utf8')
        .split('\n')
        .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map((m) => [m[1], m[2].replace(/^"(.*)"$/, '$1')]),
);

/** Origin WebSocket dari sisi browser, aturan SecurityHeaders::reverbOrigins (mode ketat): https → wss, port default dibuang. */
function wsOrigin(scheme: string, host: string, port: string) {
    const secure = scheme === 'https';
    const p = port !== '' && Number(port) !== (secure ? 443 : 80) ? `:${port}` : '';
    return `${secure ? 'wss' : 'ws'}://${host}${p}`;
}

/**
 * Perbedaan yang disengaja (docs/slices/S1.md):
 * 1. Cookie sesi: Laravel `sigap_session`; Next.js `__Host-cc_session` (sesi sendiri, keputusan S0). Prefix `__Host-`
 *    mewajibkan Secure, jadi cookie Next.js (sesi & XSRF-TOKEN) selalu Secure — sama dengan Laravel PRODUKSI
 *    (SESSION_SECURE_COOKIE=true); target Laravel lokal memakai http ([lokal] SESSION_SECURE_COOKIE=false).
 * 2. CSP connect-src: Laravel = Reverb dari VITE_REVERB_* (env/laravel.env); Next.js = Sockudo lewat origin
 *    aplikasi (`/_realtime`, host APP_URL = BASE_URL).
 */
const laravelSecure = laravelEnv.SESSION_SECURE_COOKIE === 'true';
export const EXPECT =
    TARGET === 'laravel'
        ? {
              sessionCookie: laravelEnv.SESSION_COOKIE,
              cookieSecure: laravelSecure,
              wsOrigin: wsOrigin(laravelEnv.VITE_REVERB_SCHEME, laravelEnv.VITE_REVERB_HOST, laravelEnv.VITE_REVERB_PORT),
          }
        : (() => {
              const u = new URL(BASE_URL);
              return {
                  sessionCookie: '__Host-cc_session',
                  cookieSecure: true,
                  wsOrigin: wsOrigin(u.protocol.slice(0, -1), u.hostname, u.port),
              };
          })();
