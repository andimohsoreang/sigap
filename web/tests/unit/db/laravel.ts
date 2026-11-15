import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { DIR_SIGAP } from '../legacy/fixture';

// Laravel asli (model Eloquent + cast `encrypted` + hook `saving`) lewat `php -r`, tanpa menambah perintah artisan.
// Skema uji diset lewat search_path; APP_TIMEZONE=Asia/Jakarta seperti produksi.
const KODE = String.raw`
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config(['database.connections.pgsql.search_path' => getenv('CC_SKEMA')]);
$in = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);

if ($in['aksi'] === 'tulis') {
    Carbon\Carbon::setTestNow(Carbon\Carbon::parse($in['sekarang'], 'Asia/Jakarta'));
    $u = App\Models\User::query()->forceCreate(['name' => 'Uji', 'password' => 'sandi-uji', 'nik' => $in['nik']]);
    $t = App\Models\Ticket::query()->forceCreate([
        'ticket_no' => $in['ticket_no'], 'title' => 'Uji', 'description' => 'Uji', 'reporter_nik' => $in['nik'],
        'sla_due_at' => Carbon\Carbon::now()->addDays(14),
    ]);
    $c = App\Models\ChatConversation::query()->forceCreate(['contact' => $in['kontak']]);
    $r = App\Models\Referral::query()->forceCreate(['token' => str_repeat('a', 64), 'code' => 'RJK-UJI', 'portal_id' => 1, 'contact' => $in['kontak']]);
    $hasil = ['user' => $u->id, 'ticket' => $t->id, 'chat' => $c->id, 'referral' => $r->id];
} else {
    $u = App\Models\User::query()->findOrFail($in['user']);
    $t = App\Models\Ticket::query()->findOrFail($in['ticket']);
    $hasil = [
        'nik' => $u->nik,
        'created_at' => $u->jsonSerialize()['created_at'],
        'created_at_wib' => $u->created_at->format('Y-m-d H:i:s'),
        'user_by_nik' => App\Models\User::findByNik($in['nik'])?->id,
        'reporter_nik' => $t->reporter_nik,
        'ticket_by_hash' => App\Models\Ticket::query()->where('reporter_nik_hash', App\Support\Nik::hash($in['nik']))->value('id'),
        'sla_due_at' => $t->jsonSerialize()['sla_due_at'],
        'chat_contact' => App\Models\ChatConversation::query()->findOrFail($in['chat'])->contact,
        'referral_contact' => App\Models\Referral::query()->findOrFail($in['referral'])->contact,
    ];
}
echo "\n", json_encode($hasil, JSON_THROW_ON_ERROR);
`;

/** null bila PHP & sigap/vendor siap; selain itu alasan untuk pesan skip/gagal. */
export function cekLaravel(): string | null {
    if (spawnSync('php', ['-v']).status !== 0) return '`php` tidak ada di PATH';
    if (!existsSync(join(DIR_SIGAP, 'vendor/autoload.php'))) return 'sigap/vendor belum ada (composer install di sigap/)';
    return null;
}

export type EnvLaravel = { skema: string; appKey: string; appPreviousKeys: string; nikHashKey: string };

export function laravel<T>(e: EnvLaravel, masukan: Record<string, unknown>): T {
    const r = spawnSync('php', ['-r', KODE], {
        cwd: DIR_SIGAP,
        input: JSON.stringify(masukan),
        encoding: 'utf8',
        env: {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
            NODE_ENV: 'test',
            APP_ENV: 'testing',
            APP_KEY: e.appKey,
            APP_PREVIOUS_KEYS: e.appPreviousKeys,
            NIK_HASH_KEY: e.nikHashKey,
            APP_TIMEZONE: 'Asia/Jakarta',
            DB_CONNECTION: 'pgsql',
            DB_HOST: '127.0.0.1',
            DB_PORT: '5432',
            DB_DATABASE: 'contact_center_dev',
            DB_USERNAME: 'cc_app',
            DB_PASSWORD: '',
            CC_SKEMA: e.skema,
            CACHE_STORE: 'array',
            SESSION_DRIVER: 'array',
            QUEUE_CONNECTION: 'sync',
            MAIL_MAILER: 'array',
            BROADCAST_CONNECTION: 'null',
            LOG_CHANNEL: 'stderr',
        },
    });
    if (r.status !== 0) throw new Error(`php gagal (${r.status}):\n${r.stderr}\n${r.stdout}`);
    return JSON.parse(r.stdout.trim().split('\n').at(-1) ?? '') as T;
}
