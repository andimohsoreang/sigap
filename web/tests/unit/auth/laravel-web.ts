import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { cekLaravel } from '../db/laravel';
import { DIR_SIGAP } from '../legacy/fixture';

// Laravel asli (APP_ENV=production, APP_DEBUG=false) lewat `php -r` untuk membandingkan keluaran web: halaman/JSON
// galat exception handler, CSP SecurityHeaders, dan pesan validasi LoginRequest. Tanpa DB.
const KODE = String.raw`
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$h = app(Illuminate\Contracts\Debug\ExceptionHandler::class);
$hasil = [];
foreach (json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR) as $k) {
    if ($k['aksi'] === 'galat') {
        $req = Illuminate\Http\Request::create($k['jalur'], $k['metode']);
        foreach ($k['header'] as $n => $v) $req->headers->set($n, $v);
        app()->instance('request', $req);
        $e = match ($k['jenis']) {
            '419' => new Illuminate\Session\TokenMismatchException('CSRF token mismatch.'),
            '403' => new Symfony\Component\HttpKernel\Exception\HttpException(403, $k['pesan'] ?? ''),
            'akses' => new Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException(),
            '429' => new Illuminate\Http\Exceptions\ThrottleRequestsException('Too Many Attempts.', null, ['Retry-After' => 60]),
            '503' => new Symfony\Component\HttpKernel\Exception\HttpException(503),
            '500' => new RuntimeException('rahasia internal'),
            '401' => new Illuminate\Auth\AuthenticationException('Unauthenticated.'),
        };
        $r = $h->render($req, $e);
        $hasil[] = ['status' => $r->getStatusCode(), 'jenis' => $r->headers->get('Content-Type'), 'isi' => $r->getContent()];
    } elseif ($k['aksi'] === 'csp') {
        config(['services.recaptcha.site_key' => $k['recaptcha'], 'reverb.client.host' => $k['host'], 'reverb.client.scheme' => $k['skema'], 'reverb.client.port' => $k['port']]);
        $r = (new App\Http\Middleware\SecurityHeaders)->handle(Illuminate\Http\Request::create('/'), fn () => new Illuminate\Http\Response('ok'));
        $hasil[] = ['csp' => $r->headers->get('Content-Security-Policy'), 'nonce' => Illuminate\Support\Facades\Vite::cspNonce()];
    } else {
        $hasil[] = Illuminate\Support\Facades\Validator::make($k['input'], (new App\Http\Requests\LoginRequest)->rules())->errors()->toArray();
    }
}
echo "\n", json_encode($hasil, JSON_THROW_ON_ERROR);
`;

export const alasanLaravel = cekLaravel();

export type PerintahLaravel =
    | { aksi: 'galat'; jenis: string; jalur: string; metode: string; header: Record<string, string>; pesan?: string }
    | { aksi: 'csp'; recaptcha: string | null; host: string | null; skema: string; port: number | null }
    | { aksi: 'validasi'; input: Record<string, unknown> };

export function laravelWeb<T = unknown>(perintah: PerintahLaravel[]): T[] {
    const views = mkdtempSync(join(tmpdir(), 'cc-views-'));
    try {
        const r = spawnSync('php', ['-r', KODE], {
            cwd: DIR_SIGAP,
            input: JSON.stringify(perintah),
            encoding: 'utf8',
            env: {
                PATH: process.env.PATH,
                HOME: process.env.HOME,
                NODE_ENV: 'production',
                APP_ENV: 'production',
                APP_DEBUG: 'false',
                APP_NAME: 'Contact Center',
                APP_LOCALE: 'id',
                APP_KEY: 'base64:' + Buffer.alloc(32, 9).toString('base64'),
                CACHE_STORE: 'array',
                SESSION_DRIVER: 'array',
                LOG_CHANNEL: 'stderr',
                VIEW_COMPILED_PATH: views,
            },
        });
        if (r.status !== 0) throw new Error(`php gagal (${r.status}):\n${r.stderr}\n${r.stdout}`);
        return JSON.parse(r.stdout.trim().split('\n').at(-1) ?? '') as T[];
    } finally {
        rmSync(views, { recursive: true, force: true });
    }
}
