import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Kredensial akun uji yang ditulis `php artisan sigap:e2e-setup` (target memakai snapshot data yang sama). */
export const CREDENTIALS = process.env.CREDENTIALS ?? path.join(root, '../sigap/storage/app/e2e/credentials.json');

/** storageState hasil login.setup.ts (tidak di-commit). */
export const AUTH = { warga: path.join(root, '.auth/warga.json'), admin: path.join(root, '.auth/admin.json') } as const;

/** Halaman & redirect slice S1 (docs/RENCANA-PER-FITUR.md §4 S1; sumber: sigap/routes/web.php). */
export const S1_PAGES = [
    {
        path: '/panduan',
        title: 'Panduan Lengkap — Contact Center',
        description: 'Panduan visual seluruh fitur Contact Center untuk masyarakat dan petugas.',
        h1: 'Panduan Lengkap Contact Center',
        h2: [
            ' Daftar Fitur — Masyarakat',
            'Beranda',
            'Chat TARA',
            'Formulir Pengaduan',
            'Nomor Tiket & Lacak Status',
            'Survei Kepuasan',
            'Masuk & Daftar Akun Warga',
            'Portal Warga',
            'Katalog Pengaduan',
            'Peta Wilayah & Data Terbuka',
        ],
    },
    {
        path: '/tentang',
        title: 'Data Terbuka — Contact Center',
        description:
            'Data terbuka pelayanan pengaduan Kementerian Transmigrasi: laporan harian, status penanganan, kategori, kanal, dan provinsi asal pengaduan.',
        h1: 'Data Terbuka Contact Center',
        h2: [
            'Status penanganan',
            'Top kategori keluhan',
            'Distribusi kanal pengaduan',
            'Provinsi dengan pengaduan terbanyak',
            'Keterbukaan data ini dijalankan berdasarkan',
        ],
    },
    {
        path: '/tentang-kami',
        title: 'Tentang Kami — Contact Center',
        description: 'Mengenal Contact Center dan unit pengelola layanan pengaduan',
        h1: 'Tentang Kami',
        h2: ['Sekilas Contact Center', 'Unit Pengelola', 'Kontak Resmi'],
    },
    {
        path: '/pedoman-layanan',
        title: 'Pedoman Layanan — Contact Center',
        description: 'Panduan resmi alur, kanal, dan standar waktu penanganan pengaduan masyarakat',
        h1: 'Pedoman Layanan Contact Center',
        h2: ['Alur Penanganan Pengaduan', 'Kanal Pengaduan Resmi', 'Standar Waktu Layanan (SLA)', 'Hak Pelapor', 'Kewajiban Pelapor'],
    },
    {
        path: '/syarat-ketentuan',
        title: 'Syarat dan Ketentuan — Contact Center',
        description: 'Ketentuan penggunaan layanan Contact Center bagi seluruh pengguna',
        h1: 'Syarat dan Ketentuan',
        h2: [
            '1. Ketentuan Umum',
            '2. Kewajiban Pengguna',
            '3. Larangan Penggunaan',
            '4. Hak Pengelola',
            '5. Kekayaan Intelektual',
            '6. Perubahan Ketentuan',
            '7. Hukum yang Berlaku',
        ],
    },
    {
        path: '/kebijakan-privasi',
        title: 'Kebijakan Privasi — Contact Center',
        description: 'Bagaimana Contact Center mengumpulkan, menggunakan, dan melindungi data Anda',
        h1: 'Kebijakan Privasi',
        h2: [
            '1. Dasar Hukum',
            '2. Data yang Kami Kumpulkan',
            '3. Tujuan Penggunaan Data',
            '4. Klasifikasi Privasi Laporan',
            '5. Berbagi Data dengan Pihak Ketiga',
            '6. Penyimpanan & Keamanan Data',
            '7. Hak Anda atas Data Pribadi',
        ],
    },
];

/** Route::redirect Laravel: 301, Location relatif, query string DIBUANG, garis miring akhir diterima. */
const REDIRECTS: [from: string, to: string][] = [
    ['/beranda-baru', '/'],
    ['/beranda-lama', '/'],
    ['/beranda-standar', '/'],
    ['/beranda-absol', '/'],
    ['/katalog/kantor-balai', '/katalog'],
    ['/lacak-tiket', '/lacak'],
    ['/pengaduan', '/pengaduan/baru'],
];

export const S1_REDIRECTS: [from: string, to: string][] = [
    ...REDIRECTS,
    ...REDIRECTS.map(([from, to]): [string, string] => [`${from}/`, to]),
    ['/lacak-tiket?ticket=TKT-260101-ABCDEF', '/lacak'],
    ['/lacak-tiket/?ticket=TKT-260101-ABCDEF', '/lacak'],
    ['/pengaduan?utm_source=uji', '/pengaduan/baru'],
];

/** Request luar yang diblokir per halaman S1 (sama untuk semua varian tema/login). */
export const S1_EXTERNAL: Record<string, string[]> = Object.fromEntries(S1_PAGES.map((p) => [p.path, []]));
