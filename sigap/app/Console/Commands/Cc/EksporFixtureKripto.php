<?php

namespace App\Console\Commands\Cc;

use App\Models\User;
use App\Support\Nik;
use Illuminate\Auth\SessionGuard;
use Illuminate\Console\Command;
use Illuminate\Cookie\CookieValuePrefix;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Encryption\Encrypter;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Session\Store;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\MessageBag;
use Illuminate\Support\Str;
use Illuminate\Support\ViewErrorBag;
use RuntimeException;
use Throwable;

/**
 * Rewrite Next.js (S0-B): ekspor vektor kripto dari kelas Laravel ASLI ke
 * `parity/fixtures/kripto/*.json`, dan `--verifikasi=<berkas>` untuk memeriksa
 * ciphertext/cookie/sesi/bcrypt yang ditulis TypeScript dengan kelas yang sama.
 * Hanya alat bantu; tidak mengubah fitur.
 *
 * Semua kunci di sini KUNCI UJI yang diturunkan dari teks tetap, BUKAN kunci
 * produksi. Sesi ditulis ke SQLite :memory: (hilang saat proses selesai).
 * Menolak berjalan di lingkungan production (tanpa .env Laravel menganggap
 * production): jalankan dengan `php artisan cc:ekspor-fixture-kripto --env=testing`.
 */
class EksporFixtureKripto extends Command
{
    protected $signature = 'cc:ekspor-fixture-kripto
        {--dir= : Folder tujuan (bawaan: ../parity/fixtures/kripto)}
        {--verifikasi= : Berkas JSON tulisan TypeScript yang diperiksa dengan kelas Laravel asli}';

    protected $description = 'Ekspor vektor enkripsi, NIK, bcrypt, cookie, dan sesi Laravel ke parity/fixtures/kripto (rewrite Next.js)';

    private const NOW = '2026-11-13 10:00:00';

    private const TIMEZONE = 'Asia/Jakarta';

    private const CONNECTION = 'cc_kripto';

    private const SESSION_COOKIE = 'sigap_session';

    private const LIFETIME = 120;

    private int $random = 0;

    /** KUNCI UJI: 32 byte dari sha256 teks tetap; bukan kunci produksi. */
    public static function testKey(string $label): string
    {
        return 'base64:'.base64_encode(hash('sha256', 'contact-center:kunci-uji:'.$label, true));
    }

    public function handle(): int
    {
        if (app()->isProduction()) {
            $this->error('cc:ekspor-fixture-kripto menolak berjalan di production; pakai --env=testing di mesin lokal/CI.');

            return self::FAILURE;
        }

        $this->setUpTestEnvironment();

        try {
            if ($file = $this->option('verifikasi')) {
                return $this->verify($file);
            }

            $dir = $this->option('dir') ?: base_path('../parity/fixtures/kripto');
            File::ensureDirectoryExists($dir);

            $files = [
                'enkripsi.json' => $this->encryption(),
                'nik.json' => $this->nik(),
                'sandi.json' => $this->passwords(),
                'serial.json' => $this->serialization(),
                'cookie.json' => $this->cookies(),
                'sesi.json' => $this->sessions(),
            ];

            foreach ($files as $name => $data) {
                File::put($dir.'/'.$name, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n");
                $this->line("{$name}: ".count($data['kasus']).' kasus');
            }

            return self::SUCCESS;
        } finally {
            Carbon::setTestNow();
            Str::createRandomStringsNormally();
            DB::purge(self::CONNECTION);
        }
    }

    /** Konfigurasi = produksi (SESSION_ENCRYPT=true, sigap_session, database, 120 mnt, bcrypt 12) dengan kunci uji. */
    private function setUpTestEnvironment(): void
    {
        config([
            'app.key' => self::testKey('app'),
            'app.previous_keys' => [self::testKey('app-sebelumnya')],
            'app.cipher' => 'AES-256-CBC',
            'app.nik_hash_key' => self::testKey('nik'),
            'hashing.driver' => 'bcrypt',
            'hashing.bcrypt.rounds' => 12,
            'hashing.bcrypt.verify' => true,
            'database.connections.'.self::CONNECTION => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => false],
            // Tidak ada query yang boleh menyentuh database .env lokal.
            'database.default' => self::CONNECTION,
            'session.driver' => 'database',
            'session.connection' => self::CONNECTION,
            'session.table' => 'sessions',
            'session.encrypt' => true,
            'session.cookie' => self::SESSION_COOKIE,
            'session.lifetime' => self::LIFETIME,
        ]);
        foreach (['encrypter', 'hash', 'hash.driver'] as $id) {
            app()->forgetInstance($id);
        }
        Crypt::clearResolvedInstance('encrypter');
        Hash::clearResolvedInstance('hash');
        Event::fake();
        date_default_timezone_set(self::TIMEZONE);
        Carbon::setTestNow(Carbon::parse(self::NOW, self::TIMEZONE));
        // Id sesi & _token deterministik (Str::random) agar diff fixture hanya pada ciphertext.
        Str::createRandomStringsUsing(fn (int $length) => substr(str_repeat(sprintf('Uji%04d', ++$this->random), 8), 0, $length));
        app()->instance('request', Request::create('https://cc.test/lacak', 'GET', server: [
            'REMOTE_ADDR' => '203.0.113.7',
            'HTTP_USER_AGENT' => 'Mozilla/5.0 (fixture uji)',
        ]));

        Schema::connection(self::CONNECTION)->create('sessions', function ($table) {
            // Salinan skema 0001_01_01_000000_create_users_table.
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
        // Kolom users yang dipakai SessionGuard::userFromRecaller.
        Schema::connection(self::CONNECTION)->create('users', function ($table) {
            $table->id();
            $table->string('password')->nullable();
            $table->rememberToken();
        });
    }

    private function header(array $sources, array $extra = []): array
    {
        $rev = Process::path(base_path())->run(['git', 'rev-parse', 'laravel-baseline^{commit}']);

        return [
            'sumber' => $sources,
            'commit' => $rev->successful() ? trim($rev->output()) : null,
            'tag' => 'laravel-baseline',
            'laravel' => app()->version(),
            'perintah' => 'php artisan cc:ekspor-fixture-kripto --env=testing',
            'peringatan' => 'Semua kunci di berkas ini KUNCI UJI (sha256 teks tetap), bukan kunci produksi.',
            ...$extra,
        ];
    }

    private function keys(): array
    {
        return [
            'app_key' => config('app.key'),
            'app_previous_keys' => implode(',', config('app.previous_keys')),
        ];
    }

    /** @return array{kelas: string, pesan: string}|null */
    private static function caught(callable $fn): ?array
    {
        try {
            $fn();

            return null;
        } catch (Throwable $e) {
            return ['kelas' => $e::class, 'pesan' => $e->getMessage()];
        }
    }

    private function encryption(): array
    {
        $plaintexts = [
            'ascii' => 'Halo, Contact Center!',
            'utf8' => 'Jalan rusak di Desa Sukamaju — Kab. Mamuju, Sulawesi Barat. Keluhan: “air bersih” ñ é 中文 🙂',
            'kosong' => '',
            'satu_blok' => 'abcdefghijklmnop',
            'panjang' => str_repeat('Laporan transmigrasi lahan usaha II belum bersertifikat. ', 120),
            'nik' => '3201234567890001',
            'nik_lain' => '7304056708990002',
            'kontak' => 'warga.uji@example.test',
            'telepon' => '081234567890',
            'json' => json_encode(['aktivasi' => ['token' => hash('sha256', 'token-uji'), 'kedaluwarsa' => '2026-11-14T10:00:00+07:00']]),
            'karakter_khusus' => "baris1\nbaris2\t\"kutip\" \\ / <>&'",
            'bom_di_awal' => "\u{FEFF}Halo dengan BOM",
        ];

        $crypt = app('encrypter');
        $previous = new Encrypter(base64_decode(Str::after(self::testKey('app-sebelumnya'), 'base64:')), 'AES-256-CBC');
        $other = new Encrypter(base64_decode(Str::after(self::testKey('lain'), 'base64:')), 'AES-256-CBC');

        $cases = [];
        foreach ($plaintexts as $label => $plain) {
            foreach (['sekarang' => $crypt, 'sebelumnya' => $previous] as $key => $encrypter) {
                $payload = $encrypter->encryptString($plain);
                if ($crypt->decryptString($payload) !== $plain) {
                    throw new RuntimeException("Vektor {$label} tidak bolak-balik");
                }
                $cases[] = ['label' => "{$label}_{$key}", 'kunci' => $key, 'plaintext' => $plain, 'payload' => $payload];
            }
        }

        $base = $crypt->encryptString('nilai rahasia uji');
        $json = json_decode(base64_decode($base), true);
        $key = $crypt->getKey();
        $with = fn (array $changes) => base64_encode(json_encode([...$json, ...$changes], JSON_UNESCAPED_SLASHES));
        $iv = base64_encode(str_repeat("\x01", 16));
        $garbage = base64_encode(str_repeat("\x02", 32));
        $tampered = [
            'mac_rusak' => $with(['mac' => strrev($json['mac'])]),
            'mac_kosong' => $with(['mac' => '']),
            'nilai_diubah' => $with(['value' => base64_encode(str_repeat("\x00", 16))]),
            'kunci_lain' => $other->encryptString('nilai rahasia uji'),
            'base64_rusak' => '!!!bukan-base64!!!',
            'bukan_json' => base64_encode('bukan json'),
            'json_daftar' => base64_encode('["a","b","c"]'),
            'tanpa_mac' => base64_encode(json_encode(['iv' => $json['iv'], 'value' => $json['value']])),
            'iv_bukan_string' => $with(['iv' => 12345]),
            'iv_8_byte' => $with(['iv' => base64_encode(str_repeat("\x01", 8))]),
            'tag_terisi' => $with(['tag' => base64_encode(str_repeat("\x03", 16))]),
            'tag_nol' => $with(['tag' => '0']),
            'tag_null' => $with(['tag' => null]),
            'kosong' => '',
            // MAC sah (dihitung dengan kunci uji) tetapi ciphertext bukan padding PKCS7 yang sah.
            'mac_sah_padding_rusak' => base64_encode(json_encode(['iv' => $iv, 'value' => $garbage, 'mac' => hash_hmac('sha256', $iv.$garbage, $key), 'tag' => ''], JSON_UNESCAPED_SLASHES)),
        ];
        $negative = [];
        foreach ($tampered as $label => $payload) {
            $result = null;
            $error = self::caught(function () use ($crypt, $payload, &$result) {
                $result = $crypt->decryptString($payload);
            });
            $negative[] = ['label' => $label, 'payload' => $payload, 'galat' => $error, 'plaintext' => $error ? null : $result];
        }

        return [
            ...$this->header([Encrypter::class.'::encryptString/decryptString', 'Illuminate\Encryption\EncryptionServiceProvider::parseKey'], ['cipher' => 'AES-256-CBC', ...$this->keys()]),
            'kasus' => $cases,
            'negatif' => $negative,
        ];
    }

    private function nik(): array
    {
        $raw = hash('sha256', 'contact-center:kunci-uji:nik', true);
        $keys = [
            'base64' => self::testKey('nik'),
            'literal' => 'kunci-nik-uji-literal-bukan-produksi',
            'base64_tidak_sah' => 'base64:!!bukan*base64*kunci*uji*panjang!!',
            'base64_tanpa_padding' => 'base64:'.rtrim(base64_encode($raw), '='),
            'base64_padding_kurang' => 'base64:'.substr(base64_encode(substr($raw, 0, 31)), 0, -1),
            'spasi_di_tepi' => "  \t".self::testKey('nik')."\n",
        ];
        $inputs = [
            '3201234567890001', '7304056708990002', ' 3201234567890001 ', "\t3201234567890001\n", "\x0B3201234567890001\0",
            "3201234567890001\u{00A0}", '', '   ', null, '1234567', '12345678', '320123456789000', 'abcdEFGH1234',
        ];

        $cases = [];
        foreach ($inputs as $input) {
            $hashes = [];
            foreach ($keys as $label => $key) {
                config(['app.nik_hash_key' => $key]);
                $hashes[$label] = Nik::hash($input);
            }
            $cases[] = ['nik' => $input, 'hash' => $hashes, 'mask' => Nik::mask($input), 'mirip_nik' => $input === null ? null : Nik::looksLikeNik($input)];
        }
        config(['app.nik_hash_key' => self::testKey('nik')]);

        return [
            ...$this->header([Nik::class]),
            'kunci_nik' => $keys,
            'kasus' => $cases,
        ];
    }

    private function passwords(): array
    {
        $passwords = [
            'rahasia123',
            'Kata Sandi Indonesia ñ 🙂',
            '',
            str_repeat('a', 72),
            str_repeat('a', 73),
            str_repeat('é', 40),
        ];
        $guard = Auth::guard('web');

        $cases = [];
        foreach ($passwords as $password) {
            $hash = Hash::make($password);
            $checks = [];
            foreach (array_unique([$password, $password.'x', mb_strtoupper($password), mb_substr($password, 0, -1), str_repeat('a', 72), str_repeat('a', 80)]) as $candidate) {
                $checks[] = ['sandi' => $candidate, 'hasil' => Hash::check($candidate, $hash)];
            }
            $cases[] = [
                'sandi' => $password,
                'hash' => $hash,
                'perlu_rehash' => Hash::needsRehash($hash),
                'cek' => $checks,
                'password_hash_web' => $guard->hashPasswordForCookie($hash),
            ];
        }

        $hash = $cases[0]['hash'];
        $other = [
            'awalan_2b' => '$2b$'.substr($hash, 4),
            'awalan_2a' => '$2a$'.substr($hash, 4),
            'kosong' => '',
            'bukan_bcrypt' => hash('sha256', 'rahasia123'),
        ];
        $negative = [];
        foreach ($other as $label => $value) {
            $result = null;
            $error = self::caught(function () use ($value, &$result) {
                $result = Hash::check('rahasia123', $value);
            });
            $negative[] = ['label' => $label, 'hash' => $value, 'galat' => $error, 'hasil' => $result];
        }

        return [
            ...$this->header([
                'Illuminate\Hashing\BcryptHasher (rounds 12, verify true)',
                SessionGuard::class.'::hashPasswordForCookie (kunci = config app.key mentah)',
            ], [
                'app_key' => config('app.key'),
                'galat_make_nul' => self::caught(fn () => Hash::make("a\0b")),
            ]),
            'kasus' => $cases,
            'negatif' => $negative,
        ];
    }

    private function serialization(): array
    {
        $values = [
            'null' => null, 'true' => true, 'false' => false, 'nol' => 0, 'negatif' => -42, 'int_aman_maks' => 9007199254740991,
            'float_satu' => 1.0, 'float_0_1' => 0.1, 'float_1e14' => 1e14, 'float_1e15' => 1e15, 'float_1e16' => 1e16, 'float_1e17' => 1e17,
            'float_besar' => 123456789012345678.0, 'float_0_0001' => 0.0001, 'float_1e_5' => 0.00001, 'float_kecil' => 1.5e-7,
            'float_minus_nol' => -0.0, 'float_1e25' => 1e25, 'float_pi' => 3.14159, 'float_neg' => -1.25e-10, 'float_hampir' => 999999999999999.9,
            'float_inf' => INF, 'float_minus_inf' => -INF, 'float_nan' => NAN,
            'string_kosong' => '', 'string' => 'abc', 'string_utf8' => 'Sukamaju — ñ 中文 🙂', 'string_jebakan' => 'a";s:1:"b";}', 'string_nul' => "a\0b\nc", 'string_bom' => "\u{FEFF}abc",
            'array_kosong' => [], 'daftar' => [1, 2, 3], 'asosiatif' => ['b' => 1, 'a' => 2], 'kunci_campur' => ['x' => 1, 5 => 'lima', -3 => 'neg', '05' => 'string', '7' => 'jadi int'],
            'bersarang' => ['_flash' => ['old' => ['success'], 'new' => []], '_previous' => ['url' => 'https://cc.test/a?b=c', 'route' => null], 'x' => [[[]]]],
            'daftar_berlubang' => [1 => 'a', 2 => 'b'],
        ];

        $cases = [];
        foreach ($values as $label => $value) {
            $isSpecial = is_float($value) && (is_nan($value) || is_infinite($value));
            $cases[] = ['label' => $label, 'serial' => serialize($value), 'json' => $isSpecial ? null : $value];
        }

        return [
            ...$this->header(['serialize() PHP '.PHP_VERSION.' (serialize_precision '.ini_get('serialize_precision').')']),
            'catatan' => 'json = json_encode nilai PHP (null untuk INF/NAN); int vs float hanya terlihat di serial.',
            'kasus' => $cases,
            'int_di_luar_batas_js' => serialize(PHP_INT_MAX),
        ];
    }

    /** Cookie persis seperti keluaran EncryptCookies (prefix HMAC + encrypt tanpa serialize). */
    private function encryptCookie(string $name, string $value): array
    {
        $response = (new EncryptCookies(app('encrypter')))->handle(Request::create('/'), fn () => (new Response)->withCookie(cookie($name, $value)));
        $cookie = collect($response->headers->getCookies())->first(fn ($c) => $c->getName() === $name);

        return ['nilai' => $cookie->getValue(), 'set_cookie' => (string) $cookie];
    }

    /** Nilai cookie setelah EncryptCookies::decrypt (null = ditolak). */
    private function decryptCookie(string $name, string $value): ?string
    {
        $seen = null;
        (new EncryptCookies(app('encrypter')))->handle(Request::create('/', cookies: [$name => $value]), function ($request) use ($name, &$seen) {
            $seen = $request->cookies->get($name);

            return new Response;
        });

        return $seen;
    }

    private function xsrfFromHeader(string $header): mixed
    {
        $csrf = new class(app(), app('encrypter')) extends ValidateCsrfToken
        {
            public function fromRequest($request)
            {
                return $this->getTokenFromRequest($request);
            }
        };

        return $csrf->fromRequest(Request::create('/', 'POST', server: ['HTTP_X_XSRF_TOKEN' => $header]));
    }

    private function cookies(): array
    {
        $guard = Auth::guard('web');
        $remember = $guard->getRecallerName();
        $userHash = Hash::make('rahasia123');
        $values = [
            self::SESSION_COOKIE => str_repeat('AbCdEfGhIj', 4),
            'XSRF-TOKEN' => 'TokenCsrfUji0123456789abcdefghijklmnopqr',
            'sigap_chat_tamu' => '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
            $remember => '101|'.str_repeat('r', 60).'|'.$guard->hashPasswordForCookie($userHash),
            'kosong' => '',
        ];

        $cases = [];
        foreach ($values as $name => $value) {
            $encrypted = $this->encryptCookie($name, $value);
            $cases[] = [
                'nama' => $name,
                'nilai' => $value,
                'terenkripsi' => $encrypted['nilai'],
                'set_cookie' => $encrypted['set_cookie'],
                'prefix' => CookieValuePrefix::create($name, app('encrypter')->getKey()),
                'hasil_dekripsi' => $this->decryptCookie($name, $encrypted['nilai']),
            ];
        }

        $session = $cases[0]['terenkripsi'];
        $previousKey = base64_decode(Str::after(self::testKey('app-sebelumnya'), 'base64:'));
        $previous = new Encrypter($previousKey, 'AES-256-CBC');
        $crypt = app('encrypter');
        $negative = [
            // Nilai cookie sesi dipindah ke nama lain: prefix HMAC tidak cocok.
            ['label' => 'nama_tertukar', 'nama' => 'XSRF-TOKEN', 'terenkripsi' => $session],
            ['label' => 'kunci_sebelumnya', 'nama' => self::SESSION_COOKIE, 'terenkripsi' => $previous->encryptString(CookieValuePrefix::create(self::SESSION_COOKIE, $previousKey).$values[self::SESSION_COOKIE])],
            ['label' => 'tanpa_prefix', 'nama' => self::SESSION_COOKIE, 'terenkripsi' => $crypt->encryptString($values[self::SESSION_COOKIE])],
            ['label' => 'prefix_v1_lama', 'nama' => self::SESSION_COOKIE, 'terenkripsi' => $crypt->encryptString(hash_hmac('sha1', self::SESSION_COOKIE.'v1', $crypt->getKey()).'|'.$values[self::SESSION_COOKIE])],
            ['label' => 'mac_rusak', 'nama' => self::SESSION_COOKIE, 'terenkripsi' => substr($session, 0, -8).'AAAAAAA='],
            ['label' => 'sampah', 'nama' => self::SESSION_COOKIE, 'terenkripsi' => 'bukan-cookie-laravel'],
            ['label' => 'terserialisasi', 'nama' => self::SESSION_COOKIE, 'terenkripsi' => $crypt->encrypt(CookieValuePrefix::create(self::SESSION_COOKIE, $crypt->getKey()).$values[self::SESSION_COOKIE])],
        ];
        foreach ($negative as &$case) {
            $case['hasil_dekripsi'] = $this->decryptCookie($case['nama'], $case['terenkripsi']);
        }
        unset($case);

        $xsrf = collect($cases)->firstWhere('nama', 'XSRF-TOKEN')['terenkripsi'];
        $headers = [
            ['label' => 'cookie_xsrf', 'header' => $xsrf],
            ['label' => 'cookie_sesi_tanpa_cek_prefix', 'header' => $session],
            ['label' => 'tanpa_prefix_terpotong', 'header' => $crypt->encryptString('pendek')],
            ['label' => 'sampah', 'header' => 'bukan-token'],
        ];
        foreach ($headers as &$case) {
            $case['token'] = $this->xsrfFromHeader($case['header']);
        }
        unset($case);

        return [
            ...$this->header([EncryptCookies::class, CookieValuePrefix::class, ValidateCsrfToken::class.'::getTokenFromRequest'], [
                ...$this->keys(),
                'nama_remember' => $remember,
                'catatan' => 'set_cookie = header Set-Cookie Symfony (nilai di-rawurlencode); hasil_dekripsi null = cookie dianggap tidak ada.',
            ]),
            'kasus' => $cases,
            'negatif' => $negative,
            'header_xsrf' => $headers,
            ...$this->rememberCases($remember),
        ];
    }

    /** Cookie remember_web_* dibaca SessionGuard::user() asli (sesi kosong) terhadap tabel users uji. */
    private function rememberCases(string $name): array
    {
        $token = str_repeat('r', 60);
        $hash = Hash::make('rahasia123');
        $users = [
            ['id' => 101, 'password' => $hash, 'remember_token' => $token],
            ['id' => 103, 'password' => Hash::make('sandi-baru'), 'remember_token' => $token],
            ['id' => 104, 'password' => $hash, 'remember_token' => null],
        ];
        DB::connection(self::CONNECTION)->table('users')->insert($users);
        $hmac = Auth::guard('web')->hashPasswordForCookie($hash);
        $values = [
            'sah_hmac' => "101|{$token}|{$hmac}",
            'sah_hash_mentah' => "101|{$token}|{$hash}",
            'segmen_lebih' => "101|{$token}|{$hmac}|ekstra",
            'terserialisasi' => serialize("101|{$token}|{$hmac}"),
            'token_salah' => '101|'.str_repeat('x', 60)."|{$hmac}",
            'sandi_berubah' => "103|{$token}|{$hmac}",
            'pengguna_tidak_ada' => "999|{$token}|{$hmac}",
            'token_db_kosong' => "104|{$token}|{$hmac}",
            'dua_segmen' => "101|{$token}",
            'id_kosong' => " |{$token}|{$hmac}",
            'serial_bukan_string' => serialize(['101', $token, $hmac]),
            'serial_falsy' => serialize(0),
        ];

        $cases = [];
        foreach ($values as $label => $value) {
            $encrypted = $this->encryptCookie($name, $value)['nilai'];
            $this->freshSession()->start();
            $guard = Auth::guard('web');
            $guard->setRequest(Request::create('/', cookies: [$name => $this->decryptCookie($name, $encrypted)]));
            $cases[] = ['label' => $label, 'nilai' => $value, 'terenkripsi' => $encrypted, 'user_id' => $guard->user()?->getAuthIdentifier()];
        }

        return ['pengguna' => $users, 'remember' => $cases];
    }

    /** Store sesi baru dari SessionManager asli (database + EncryptedStore), guard ikut segar. */
    private function freshSession(): Store
    {
        foreach (['session', 'session.store', 'auth.driver'] as $id) {
            app()->forgetInstance($id);
        }
        Auth::forgetGuards();

        return app('session.store');
    }

    private function row(string $id): array
    {
        return (array) DB::connection(self::CONNECTION)->table('sessions')->where('id', $id)->first();
    }

    private function user(int $id, string $password): User
    {
        return (new User)->setRawAttributes(['id' => $id, 'password' => Hash::make($password)], true);
    }

    private function sessions(): array
    {
        $guard = fn () => Auth::guard('web');
        $cases = [];
        $record = function (string $label, Store $store, ?User $user, string $note, array $extra = []) use (&$cases) {
            $row = $this->row($store->getId());
            $inner = app('encrypter')->decrypt(base64_decode($row['payload']));
            $data = unserialize($inner);
            $cases[] = [
                'label' => $label,
                'catatan' => $note,
                'cookie' => $this->encryptCookie(self::SESSION_COOKIE, $store->getId())['nilai'],
                'baris' => $row,
                'serial' => $inner,
                'data' => self::jsonable($data),
                'user_hash' => $user?->getAuthPassword(),
                'harapan' => [
                    'user_id' => $data[Auth::guard('web')->getName()] ?? null,
                    'password_hash' => $data['password_hash_web'] ?? null,
                ],
                ...$extra,
            ];
        };

        $s = $this->freshSession();
        $s->start();
        $s->setPreviousUrl('https://cc.test/lacak');
        $s->setPreviousRoute('lacak');
        $s->save();
        $record('tamu', $s, null, 'Tamu: _token + _previous + _flash kosong.');

        $s = $this->freshSession();
        $s->start();
        $s->put('chat_guest_token', '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
        $s->setPreviousUrl('https://cc.test/chat');
        $s->setPreviousRoute(null);
        $s->save();
        $record('tamu_chat', $s, null, 'Tamu dengan chat_guest_token (ChatController::SESSION_KEY).');

        $s = $this->freshSession();
        $s->start();
        $warga = $this->user(101, 'sandi-warga-uji');
        $guard()->login($warga);
        $s->flash('success', 'Selamat datang kembali.');
        $s->setPreviousUrl('https://cc.test/akun');
        $s->save();
        $record('warga', $s, $warga, 'Warga login (SessionGuard::login: migrate(true), login_web_*, password_hash_web) + flash success.');

        $s = $this->freshSession();
        $s->start();
        $admin = $this->user(1, 'sandi-admin-uji');
        $s->put('url.intended', 'https://cc.test/admin/tiket?status=baru');
        $guard()->login($admin);
        $s->flash('status', 'Kata sandi diperbarui.');
        $s->flashInput(['identifier' => 'admin', 'catatan' => 'ñ 🙂']);
        $s->setPreviousUrl('https://cc.test/admin');
        $s->setPreviousRoute('admin.dashboard');
        $s->save();
        $record('admin', $s, $admin, 'Admin login + url.intended + flash status & _old_input.');

        // Request berikutnya: flash lama dibuang, flash baru ditulis (ageFlashData).
        $id = $s->getId();
        $s = $this->freshSession();
        $s->setId($id);
        $s->start();
        // Seperti request asli: guard sudah me-resolve user (tanpa tabel users di sini).
        $guard()->setUser($admin);
        $s->flash('error', 'Tiket tidak ditemukan.');
        $s->save();
        $record('admin_request_berikutnya', $s, $admin, 'Sesi admin setelah satu request lagi: success/_old_input lama dibuang, flash error baru.');

        $s = $this->freshSession();
        $s->start();
        $warga = $this->user(102, 'sandi-warga-uji-2');
        $guard()->login($warga);
        $s->flash('errors', (new ViewErrorBag)->put('default', new MessageBag(['identifier' => ['NIK atau kata sandi salah.']])));
        $s->save();
        $record('warga_dengan_errors', $s, $warga, 'withErrors() menyimpan ViewErrorBag (objek O:) di sesi: TS menyimpannya sebagai byte mentah tanpa membuat objek.');

        $s = $this->freshSession();
        $s->start();
        $s->save();
        DB::connection(self::CONNECTION)->table('sessions')->where('id', $s->getId())->update(['last_activity' => Carbon::now()->getTimestamp() - self::LIFETIME * 60 - 1]);
        $record('kedaluwarsa', $s, null, 'last_activity < now - lifetime: DatabaseSessionHandler::read mengembalikan sesi kosong.', ['harapan_kosong' => true]);

        $s = $this->freshSession();
        $s->start();
        $s->save();
        DB::connection(self::CONNECTION)->table('sessions')->where('id', $s->getId())->update(['last_activity' => Carbon::now()->getTimestamp() - self::LIFETIME * 60]);
        $record('tepat_batas', $s, null, 'last_activity = now - lifetime: belum kedaluwarsa (perbandingan <).');

        $guardName = Auth::guard('web')->getName();
        $hashCases = [];
        foreach ($cases as $case) {
            if ($case['user_hash']) {
                $hmac = Auth::guard('web')->hashPasswordForCookie($case['user_hash']);
                $hashCases[] = ['user_hash' => $case['user_hash'], 'tersimpan' => $hmac, 'cocok' => true];
                $hashCases[] = ['user_hash' => $case['user_hash'], 'tersimpan' => $case['user_hash'], 'cocok' => true];
                $hashCases[] = ['user_hash' => Hash::make('sandi-baru'), 'tersimpan' => $hmac, 'cocok' => false];
            }
        }

        return [
            ...$this->header([Store::class, 'Illuminate\Session\EncryptedStore', 'Illuminate\Session\DatabaseSessionHandler', SessionGuard::class, 'Illuminate\Session\Middleware\AuthenticateSession'], [
                ...$this->keys(),
                'cookie_sesi' => self::SESSION_COOKIE,
                'lifetime_menit' => self::LIFETIME,
                'serialization' => config('session.serialization', 'php'),
                'sekarang' => Carbon::now()->getTimestamp(),
                'kunci_login' => $guardName,
                'catatan' => 'payload = base64(Encrypter::encrypt(serialize(serialize($attributes)))): EncryptedStore memakai encrypt() yang ikut men-serialize. serial = serialize($attributes).',
            ]),
            'kasus' => $cases,
            'password_hash_web' => $hashCases,
        ];
    }

    /**
     * Store::readFromHandler memakai unserialize tanpa allowed_classes: payload dari berkas verifikasi
     * hanya boleh memuat objek ViewErrorBag/MessageBag, tanpa C: (dicek sebelum Laravel membacanya).
     */
    private static function assertSafeSessionPayload(string $payload): void
    {
        $outer = unserialize(app('encrypter')->decrypt(base64_decode($payload), false), ['allowed_classes' => false]);
        if (! is_string($outer) || preg_match('/C:\d+:"/', $outer)) {
            throw new RuntimeException('Payload sesi ditolak: bukan string serial atau memuat C:');
        }
        preg_match_all('/O:\d+:"([^"]*)"/', $outer, $classes);
        foreach ($classes[1] as $class) {
            if (! in_array($class, [ViewErrorBag::class, MessageBag::class], true)) {
                throw new RuntimeException("Payload sesi ditolak: kelas {$class}");
            }
        }
    }

    /** Ubah objek menjadi penanda agar bisa ditulis sebagai JSON. */
    private static function jsonable(mixed $value): mixed
    {
        if (is_object($value)) {
            return ['__objek' => $value::class];
        }

        return is_array($value) ? array_map(self::jsonable(...), $value) : $value;
    }

    /** Periksa keluaran TypeScript dengan kelas Laravel asli; keluaran JSON {lulus, gagal}. */
    private function verify(string $file): int
    {
        $input = json_decode(File::get($file), true, flags: JSON_THROW_ON_ERROR);
        $passed = 0;
        $failed = [];
        $assert = function (bool $ok, string $what) use (&$passed, &$failed) {
            $ok ? $passed++ : $failed[] = $what;
        };
        $try = function (string $what, callable $fn) use (&$failed) {
            try {
                $fn();
            } catch (Throwable $e) {
                $failed[] = "{$what}: ".$e::class.': '.$e->getMessage();
            }
        };
        $crypt = app('encrypter');

        foreach ($input['enkripsi'] ?? [] as $i => $case) {
            $try("enkripsi[{$i}]", fn () => $assert($crypt->decryptString($case['payload']) === $case['plaintext'], "enkripsi[{$i}] plaintext beda"));
        }

        foreach ($input['cookie'] ?? [] as $i => $case) {
            $try("cookie[{$i}]", fn () => $assert($this->decryptCookie($case['nama'], $case['terenkripsi']) === $case['nilai'], "cookie[{$i}] {$case['nama']} beda"));
        }

        foreach ($input['sandi'] ?? [] as $i => $case) {
            $try("sandi[{$i}]", function () use ($case, $i, $assert) {
                $assert(str_starts_with($case['hash'], '$2y$12$'), "sandi[{$i}] bukan \$2y\$12\$");
                $assert(Hash::check($case['sandi'], $case['hash']), "sandi[{$i}] Hash::check benar gagal");
                $assert(! Hash::check('x'.$case['sandi'], $case['hash']), "sandi[{$i}] Hash::check salah lolos");
                $assert(! Hash::needsRehash($case['hash']), "sandi[{$i}] perlu rehash");
            });
        }

        foreach ($input['serial'] ?? [] as $i => $case) {
            $try("serial[{$i}]", function () use ($case, $i, $assert) {
                $value = unserialize($case['serial'], ['allowed_classes' => false]);
                $assert($value !== false || $case['serial'] === 'b:0;', "serial[{$i}] gagal unserialize");
                $assert(serialize($value) === $case['serial'], "serial[{$i}] serialize ulang beda");
            });
        }

        foreach ($input['sesi'] ?? [] as $i => $case) {
            $try("sesi[{$i}]", function () use ($case, $i, $assert) {
                self::assertSafeSessionPayload($case['payload']);
                DB::connection(self::CONNECTION)->table('sessions')->updateOrInsert(['id' => $case['id']], ['payload' => $case['payload'], 'last_activity' => Carbon::now()->getTimestamp()]);
                $s = $this->freshSession();
                $s->setId($this->decryptCookie(self::SESSION_COOKIE, $case['cookie']));
                $assert($s->getId() === $case['id'], "sesi[{$i}] cookie tidak menunjuk id sesi");
                $s->start();
                $assert(serialize($s->all()) === $case['serial'], "sesi[{$i}] isi beda dengan serial TS");
                if (isset($case['user_hash'])) {
                    Auth::guard('web')->setUser((new User)->setRawAttributes(['id' => $case['user_id'], 'password' => $case['user_hash']], true));
                    $assert(hash_equals(Auth::guard('web')->hashPasswordForCookie($case['user_hash']), (string) $s->get('password_hash_web')), "sesi[{$i}] password_hash_web tidak cocok");
                    $assert($s->get(Auth::guard('web')->getName()) === $case['user_id'], "sesi[{$i}] user id beda");
                }
                foreach ($case['flash'] ?? [] as $key => $value) {
                    $assert($s->get($key) === $value, "sesi[{$i}] flash {$key} tidak terbaca");
                }
                // Request berikutnya di Laravel membuang flash yang ditulis TS.
                $s->save();
                $s = $this->freshSession();
                $s->setId($case['id']);
                $s->start();
                foreach (array_keys($case['flash'] ?? []) as $key) {
                    $assert(! $s->has($key), "sesi[{$i}] flash {$key} tidak dibuang");
                }
            });
        }

        $this->line(json_encode(['lulus' => $passed, 'gagal' => $failed], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

        return $failed === [] ? self::SUCCESS : self::FAILURE;
    }
}
