/**
 * 38 provinsi Indonesia, urut barat → timur. Nama sama persis dengan
 * app/Support/Provinces.php dan properti `provinsi` di
 * public/geo/indonesia-provinsi.geojson (dijaga ProvincesTest).
 */
export const PROVINCES = [
    'Aceh',
    'Sumatera Utara',
    'Sumatera Barat',
    'Riau',
    'Kepulauan Riau',
    'Jambi',
    'Bengkulu',
    'Sumatera Selatan',
    'Kepulauan Bangka Belitung',
    'Lampung',
    'Banten',
    'DKI Jakarta',
    'Jawa Barat',
    'Jawa Tengah',
    'DI Yogyakarta',
    'Jawa Timur',
    'Bali',
    'Nusa Tenggara Barat',
    'Nusa Tenggara Timur',
    'Kalimantan Barat',
    'Kalimantan Tengah',
    'Kalimantan Selatan',
    'Kalimantan Timur',
    'Kalimantan Utara',
    'Sulawesi Utara',
    'Gorontalo',
    'Sulawesi Tengah',
    'Sulawesi Barat',
    'Sulawesi Selatan',
    'Sulawesi Tenggara',
    'Maluku',
    'Maluku Utara',
    'Papua Barat',
    'Papua Barat Daya',
    'Papua',
    'Papua Tengah',
    'Papua Pegunungan',
    'Papua Selatan',
] as const;

export type Province = (typeof PROVINCES)[number];

/** Pilihan untuk <select>, urut abjad agar mudah dicari. */
export const PROVINCE_OPTIONS = [...PROVINCES].sort((a, b) => a.localeCompare(b, 'id'));
