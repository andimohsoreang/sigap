<?php

namespace App\Support;

use RuntimeException;

/**
 * Utilitas NIK (D-01).
 *
 * NIK disimpan terenkripsi (cast `encrypted`) sehingga tidak dapat dicari
 * langsung. Untuk login/pencarian dipakai *blind index*: HMAC-SHA256 dari NIK
 * dengan kunci khusus `NIK_HASH_KEY` (config `app.nik_hash_key`) — TERPISAH
 * dari APP_KEY sehingga rotasi APP_KEY tidak merusak login NIK. Nilai hash
 * deterministik namun tidak dapat dibalik tanpa kunci.
 *
 * Bila kunci kosong: lokal/testing memakai APP_KEY; lingkungan lain melempar
 * {@see RuntimeException} yang jelas. Mengganti kunci WAJIB diikuti
 * `php artisan sigap:rehash-nik`.
 */
final class Nik
{
    /** Blind index NIK; null bila NIK kosong. */
    public static function hash(?string $nik): ?string
    {
        $nik = self::normalize($nik);

        if ($nik === null) {
            return null;
        }

        return hash_hmac('sha256', $nik, self::key());
    }

    /** NIK tersamar untuk tampilan: 4 digit awal + 8 bintang + 4 digit akhir. */
    public static function mask(?string $nik): ?string
    {
        $nik = self::normalize($nik);

        if ($nik === null) {
            return null;
        }

        if (strlen($nik) < 8) {
            return str_repeat('*', strlen($nik));
        }

        return substr($nik, 0, 4).str_repeat('*', 8).substr($nik, -4);
    }

    /** Apakah identifier berbentuk NIK (16 digit angka). */
    public static function looksLikeNik(string $value): bool
    {
        return (bool) preg_match('/^\d{16}$/', trim($value));
    }

    private static function normalize(?string $nik): ?string
    {
        if ($nik === null) {
            return null;
        }

        $nik = trim($nik);

        return $nik === '' ? null : $nik;
    }

    /** Apakah kunci blind index khusus sudah dikonfigurasi. */
    public static function hasDedicatedKey(): bool
    {
        return trim((string) config('app.nik_hash_key')) !== '';
    }

    /**
     * Pastikan kunci tersedia; lempar exception yang jelas bila tidak.
     *
     * @throws RuntimeException
     */
    public static function assertKeyConfigured(): void
    {
        if (! self::hasDedicatedKey() && ! app()->environment('local', 'testing')) {
            throw new RuntimeException(
                'NIK_HASH_KEY belum diatur. Isi NIK_HASH_KEY di .env (mis. hasil `php -r "echo \'base64:\'.base64_encode(random_bytes(32));"`) '
                .'dan JANGAN mengubahnya tanpa menjalankan `php artisan sigap:rehash-nik`.'
            );
        }
    }

    private static function key(): string
    {
        self::assertKeyConfigured();

        $key = self::hasDedicatedKey()
            ? trim((string) config('app.nik_hash_key'))
            : (string) config('app.key');

        if (str_starts_with($key, 'base64:')) {
            $decoded = base64_decode(substr($key, 7), true);

            if ($decoded !== false) {
                return $decoded;
            }
        }

        return $key;
    }
}
