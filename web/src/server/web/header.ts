import 'server-only';

import { randomBytes } from 'node:crypto';

// CSP ber-nonce: port sigap/app/Http/Middleware/SecurityHeaders.php (laravel-baseline). Header keamanan lain (HSTS, XFO,
// nosniff, Referrer-Policy, Permissions-Policy) dipasang next.config.ts untuk semua jalur, seperti nginx produksi.

const RECAPTCHA_SCRIPT = 'https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/';
const RECAPTCHA_FRAME = 'https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/';

/** Nonce per permintaan: 40 karakter seperti Str::random(40) di Vite::useCspNonce() (base64url, sah untuk CSP). */
export function buatNonce(): string {
    return randomBytes(30).toString('base64url');
}

export interface OpsiCsp {
    nonce: string;
    /** Bukan local/testing Laravel = NODE_ENV production. */
    ketat: boolean;
    /** services.recaptcha.site_key terisi. */
    recaptcha: boolean;
    /** Origin aplikasi (APP_URL): WebSocket realtime lewat origin yang sama (/_realtime). */
    appUrl?: string;
}

/**
 * Padanan reverbOrigins(): origin WebSocket dari sisi browser. Di Next.js klien pusher-js membuka WebSocket ke host
 * halaman (`wsHost: location.hostname`, forceTLS), jadi host = host APP_URL; https → wss tanpa port 443.
 * Mode tidak ketat + localhost/127.0.0.1 → keduanya, seperti Laravel.
 */
function originRealtime(appUrl: string | undefined, ketat: boolean): string[] {
    if (!appUrl) return [];
    const u = new URL(appUrl);
    const aman = u.protocol === 'https:';
    const skema = aman ? 'wss' : 'ws';
    const port = u.port ? `:${u.port}` : '';
    const host = u.hostname;
    if (!/^[A-Za-z0-9.-]+$/.test(host)) return [];
    const daftar = !ketat && (host === 'localhost' || host === '127.0.0.1') ? ['localhost', '127.0.0.1'] : [host];
    return daftar.map((h) => `${skema}://${h}${port}`);
}

/** SecurityHeaders::contentSecurityPolicy, urutan direktif & sumber identik. */
export function kebijakanCsp({ nonce, ketat, recaptcha, appUrl }: OpsiCsp): string {
    const script = ketat ? ["'self'", `'nonce-${nonce}'`] : ["'self'", "'unsafe-inline'", "'unsafe-eval'"];
    const style = ["'self'", "'unsafe-inline'"];
    const connect = [...new Set(["'self'", ...originRealtime(appUrl, ketat)])];
    const frame: string[] = [];
    if (recaptcha) {
        script.push(RECAPTCHA_SCRIPT);
        frame.push(RECAPTCHA_FRAME);
    }
    return [
        "default-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        `script-src ${script.join(' ')}`,
        `style-src ${style.join(' ')}`,
        "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://www.transmigrasi.go.id",
        "font-src 'self' data:",
        `connect-src ${connect.join(' ')}`,
        `frame-src ${frame.length === 0 ? "'none'" : frame.join(' ')}`,
        "worker-src 'self' blob:",
        "manifest-src 'self'",
    ].join('; ');
}
