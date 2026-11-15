<?php

namespace App\Console\Commands\Cc;

use App\Support\Nik;
use Illuminate\Console\Command;
use Illuminate\Encryption\Encrypter;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/**
 * Rewrite Next.js (S0-B): ekspor vektor enkripsi, NIK, dan bcrypt dari kelas Laravel ASLI ke
 * `parity/fixtures/kripto/*.json`, dan `--verifikasi=<berkas>` untuk memeriksa ciphertext/bcrypt
 * yang ditulis TypeScript dengan kelas yang sama. Hanya alat bantu; tidak mengubah fitur.
 *
 * Semua kunci di sini KUNCI UJI yang diturunkan dari teks tetap, BUKAN kunci produksi.
 * Menolak berjalan di lingkungan production (tanpa .env Laravel menganggap production):
 * jalankan dengan `php artisan cc:ekspor-fixture-kripto --env=testing`.
 */
class EksporFixtureKripto extends Command
{
    protected $signature = 'cc:ekspor-fixture-kripto
        {--dir= : Folder tujuan (bawaan: ../parity/fixtures/kripto)}
        {--verifikasi= : Berkas JSON tulisan TypeScript yang diperiksa dengan kelas Laravel asli}';

    protected $description = 'Ekspor vektor enkripsi, NIK, dan bcrypt Laravel ke parity/fixtures/kripto (rewrite Next.js)';

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

        if ($file = $this->option('verifikasi')) {
            return $this->verify($file);
        }

        $dir = $this->option('dir') ?: base_path('../parity/fixtures/kripto');
        File::ensureDirectoryExists($dir);

        $files = [
            'enkripsi.json' => $this->encryption(),
            'nik.json' => $this->nik(),
            'sandi.json' => $this->passwords(),
        ];

        foreach ($files as $name => $data) {
            File::put($dir.'/'.$name, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n");
            $this->line("{$name}: ".count($data['kasus']).' kasus');
        }

        return self::SUCCESS;
    }

    /** Konfigurasi = produksi (AES-256-CBC, bcrypt 12, HASH_VERIFY) dengan kunci uji. */
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
        ]);
        foreach (['encrypter', 'hash', 'hash.driver'] as $id) {
            app()->forgetInstance($id);
        }
        Crypt::clearResolvedInstance('encrypter');
        Hash::clearResolvedInstance('hash');
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
            ...$this->header(['Illuminate\Hashing\BcryptHasher (rounds 12, verify true)'], [
                'galat_make_nul' => self::caught(fn () => Hash::make("a\0b")),
            ]),
            'kasus' => $cases,
            'negatif' => $negative,
        ];
    }

    /** Periksa ciphertext & bcrypt tulisan TypeScript dengan kelas Laravel asli; keluaran JSON {lulus, gagal}. */
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

        foreach ($input['sandi'] ?? [] as $i => $case) {
            $try("sandi[{$i}]", function () use ($case, $i, $assert) {
                $assert(str_starts_with($case['hash'], '$2y$12$'), "sandi[{$i}] bukan \$2y\$12\$");
                $assert(Hash::check($case['sandi'], $case['hash']), "sandi[{$i}] Hash::check benar gagal");
                $assert(! Hash::check('x'.$case['sandi'], $case['hash']), "sandi[{$i}] Hash::check salah lolos");
                $assert(! Hash::needsRehash($case['hash']), "sandi[{$i}] perlu rehash");
            });
        }

        $this->line(json_encode(['lulus' => $passed, 'gagal' => $failed], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

        return $failed === [] ? self::SUCCESS : self::FAILURE;
    }
}
