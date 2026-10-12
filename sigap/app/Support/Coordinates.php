<?php

namespace App\Support;

use Closure;

/**
 * Parsing & validasi koordinat "lat, lng" dari formulir pengaduan (A-15).
 * Nilai di luar rentang (lat -90..90, lng -180..180) ditolak sebagai error
 * validasi, bukan menyebabkan error 500 saat disimpan.
 */
final class Coordinates
{
    /** Rule validasi Laravel untuk field koordinat. */
    public static function rule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if ($value === null || trim((string) $value) === '') {
                return;
            }

            if (self::parse((string) $value) === [null, null]) {
                $fail('Format koordinat harus "lintang, bujur" dengan lintang -90..90 dan bujur -180..180.');
            }
        };
    }

    /**
     * Pecah "lat, lng" menjadi dua angka; [null, null] bila kosong/tidak sah.
     *
     * @return array{0: float|null, 1: float|null}
     */
    public static function parse(?string $value): array
    {
        if ($value === null || ! str_contains($value, ',')) {
            return [null, null];
        }

        [$lat, $lng] = array_map('trim', explode(',', $value, 2));

        if (! is_numeric($lat) || ! is_numeric($lng)) {
            return [null, null];
        }

        $lat = (float) $lat;
        $lng = (float) $lng;

        if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
            return [null, null];
        }

        return [round($lat, 6), round($lng, 6)];
    }
}
