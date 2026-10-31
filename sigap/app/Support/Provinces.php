<?php

namespace App\Support;

/**
 * 38 provinsi Indonesia. Nama sama persis dengan properti `provinsi` di
 * public/geo/indonesia-provinsi.geojson dan resources/js/lib/provinces.ts
 * (dijaga ProvincesTest) agar sebaran di peta selalu cocok.
 */
final class Provinces
{
    /** @var list<string> */
    public const ALL = [
        'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau', 'Jambi', 'Bengkulu', 'Sumatera Selatan',
        'Kepulauan Bangka Belitung', 'Lampung', 'Banten', 'DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta',
        'Jawa Timur', 'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur', 'Kalimantan Barat', 'Kalimantan Tengah',
        'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara', 'Sulawesi Utara', 'Gorontalo', 'Sulawesi Tengah',
        'Sulawesi Barat', 'Sulawesi Selatan', 'Sulawesi Tenggara', 'Maluku', 'Maluku Utara', 'Papua Barat',
        'Papua Barat Daya', 'Papua', 'Papua Tengah', 'Papua Pegunungan', 'Papua Selatan',
    ];

    private const ALIASES = [
        'jakarta' => 'DKI Jakarta',
        'daerah khusus ibukota jakarta' => 'DKI Jakarta',
        'yogyakarta' => 'DI Yogyakarta',
        'daerah istimewa yogyakarta' => 'DI Yogyakarta',
        'diy' => 'DI Yogyakarta',
        'bangka belitung' => 'Kepulauan Bangka Belitung',
        'babel' => 'Kepulauan Bangka Belitung',
        'kepri' => 'Kepulauan Riau',
        'ntb' => 'Nusa Tenggara Barat',
        'ntt' => 'Nusa Tenggara Timur',
        'nanggroe aceh darussalam' => 'Aceh',
    ];

    /** Nama baku dari masukan bebas ("prov. jawa barat", "NTB"), atau null bila tidak dikenali. */
    public static function normalize(?string $name): ?string
    {
        $key = strtolower(trim(preg_replace('/\s+/u', ' ', preg_replace('/^prov(insi|\.)?\s+/i', '', trim((string) $name)) ?? '') ?? ''));
        if ($key === '') {
            return null;
        }

        foreach (self::ALL as $province) {
            if (strtolower($province) === $key) {
                return $province;
            }
        }

        return self::ALIASES[$key] ?? null;
    }
}
