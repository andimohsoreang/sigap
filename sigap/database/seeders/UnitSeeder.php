<?php

namespace Database\Seeders;

use App\Models\Unit;
use Illuminate\Database\Seeder;

/**
 * Master Unit Kerja awal (PRD-UNIT-KERJA §9).
 *
 * Sumber satu-satunya: Permentrans 11/2025 tentang Renstra Kementerian
 * Transmigrasi 2025–2029, Tabel 16 "Detail Struktur Organisasi Kementerian
 * Transmigrasi" (hal. 79–81), yang merujuk Perpres 172/2024, dan bagan
 * struktur organisasi kementerian (tanpa nama pejabat). Staf Ahli Menteri
 * tidak dimasukkan karena tidak menangani pengaduan; unit di luar tabel itu
 * ditambahkan Super Admin lewat halaman Unit Kerja.
 *
 * Aman dijalankan ulang: unit yang kodenya sudah ada tidak disentuh, sehingga
 * suntingan Super Admin tidak tertimpa.
 */
class UnitSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->units() as $i => $unit) {
            $this->plant($unit, null, $i + 1);
        }
    }

    /** @param array{code: string, name: string, short_name?: string, level: string, children?: list<array<string, mixed>>} $data */
    private function plant(array $data, ?Unit $parent, int $sort): void
    {
        $unit = Unit::query()->firstOrCreate(['code' => $data['code']], [
            'name' => $data['name'],
            'short_name' => $data['short_name'] ?? null,
            'level' => $data['level'],
            'parent_id' => $parent?->id,
            'sort' => $sort,
        ]);

        foreach ($data['children'] ?? [] as $i => $child) {
            $this->plant($child, $unit, $i + 1);
        }
    }

    /** @return list<array<string, mixed>> */
    public function units(): array
    {
        $e2 = Unit::LEVEL_ESELON_2;

        return [
            [
                'code' => 'SETJEN',
                'name' => 'Sekretariat Jenderal',
                'short_name' => 'Setjen',
                'level' => Unit::LEVEL_ESELON_1,
                'children' => [
                    ['code' => 'SETJEN-RENKERMAS', 'name' => 'Biro Perencanaan, Kerja Sama, dan Hubungan Masyarakat', 'short_name' => 'Biro Renkermas', 'level' => $e2],
                    ['code' => 'SETJEN-KEUBMN', 'name' => 'Biro Keuangan dan Barang Milik Negara', 'short_name' => 'Biro Keuangan & BMN', 'level' => $e2],
                    ['code' => 'SETJEN-OSDMRB', 'name' => 'Biro Organisasi, Sumber Daya Manusia, dan Reformasi Birokrasi', 'short_name' => 'Biro OSDM & RB', 'level' => $e2],
                    ['code' => 'SETJEN-HUKUM', 'name' => 'Biro Hukum', 'level' => $e2],
                    ['code' => 'SETJEN-UMUM', 'name' => 'Biro Umum dan Layanan Pengadaan', 'short_name' => 'Biro Umum & Pengadaan', 'level' => $e2],
                ],
            ],
            [
                'code' => 'DITJEN-PPKT',
                'name' => 'Direktorat Jenderal Pembangunan dan Pengembangan Kawasan Transmigrasi',
                'short_name' => 'Ditjen PPKTrans',
                'level' => Unit::LEVEL_ESELON_1,
                'children' => [
                    ['code' => 'PPKT-SET', 'name' => 'Sekretariat Direktorat Jenderal Pembangunan dan Pengembangan Kawasan Transmigrasi', 'short_name' => 'Setditjen PPKTrans', 'level' => $e2],
                    ['code' => 'PPKT-RENWUJUD', 'name' => 'Direktorat Perencanaan Perwujudan Kawasan Transmigrasi', 'level' => $e2],
                    ['code' => 'PPKT-BANGKAWASAN', 'name' => 'Direktorat Pembangunan Kawasan Transmigrasi', 'level' => $e2],
                    ['code' => 'PPKT-PERSEBARAN', 'name' => 'Direktorat Fasilitasi Penataan Persebaran Penduduk di Kawasan Transmigrasi', 'level' => $e2],
                    ['code' => 'PPKT-SPPSKP', 'name' => 'Direktorat Pengembangan Satuan Permukiman dan Pusat Satuan Kawasan Pengembangan', 'level' => $e2],
                    ['code' => 'PPKT-KEMBANGKAWASAN', 'name' => 'Direktorat Pengembangan Kawasan Transmigrasi', 'level' => $e2],
                ],
            ],
            [
                'code' => 'DITJEN-PEPMT',
                'name' => 'Direktorat Jenderal Pengembangan Ekonomi dan Pemberdayaan Masyarakat Transmigrasi',
                'short_name' => 'Ditjen PEPMTrans',
                'level' => Unit::LEVEL_ESELON_1,
                'children' => [
                    ['code' => 'PEPMT-SET', 'name' => 'Sekretariat Direktorat Jenderal Pengembangan Ekonomi dan Pemberdayaan Masyarakat Transmigrasi', 'short_name' => 'Setditjen PEPMTrans', 'level' => $e2],
                    ['code' => 'PEPMT-RENTEK', 'name' => 'Direktorat Perencanaan Teknis Pengembangan Ekonomi dan Pemberdayaan Masyarakat Transmigrasi', 'level' => $e2],
                    ['code' => 'PEPMT-KELEMBAGAAN', 'name' => 'Direktorat Pengembangan Kelembagaan Ekonomi Transmigrasi', 'level' => $e2],
                    ['code' => 'PEPMT-PRODUK', 'name' => 'Direktorat Pengembangan Produk Unggulan Transmigrasi', 'level' => $e2],
                    ['code' => 'PEPMT-PROMOSI', 'name' => 'Direktorat Promosi dan Pemasaran Produk Unggulan Transmigrasi', 'level' => $e2],
                    ['code' => 'PEPMT-PEMBERDAYAAN', 'name' => 'Direktorat Pemberdayaan Masyarakat Transmigrasi', 'level' => $e2],
                ],
            ],
            [
                'code' => 'ITJEN',
                'name' => 'Inspektorat Jenderal',
                'short_name' => 'Itjen',
                'level' => Unit::LEVEL_ESELON_1,
                'children' => [
                    ['code' => 'ITJEN-SET', 'name' => 'Sekretariat Inspektorat Jenderal', 'level' => $e2],
                    ['code' => 'ITJEN-IR1', 'name' => 'Inspektorat I', 'level' => $e2],
                    ['code' => 'ITJEN-IR2', 'name' => 'Inspektorat II', 'level' => $e2],
                ],
            ],
            // Tiga Pusat bergaris komando langsung ke Menteri; ke Sekjen hanya pembinaan administratif.
            ['code' => 'PUS-STRAJAK', 'name' => 'Pusat Strategi Kebijakan Transmigrasi', 'short_name' => 'Pusstrajak', 'level' => $e2],
            [
                'code' => 'PUS-BANGSDM',
                'name' => 'Pusat Pengembangan Sumber Daya Manusia Transmigrasi',
                'short_name' => 'Pusbang SDM',
                'level' => $e2,
                'children' => [
                    ['code' => 'UPT-BBPPMT-YOGYA', 'name' => 'Balai Besar Pelatihan dan Pemberdayaan Masyarakat Transmigrasi Yogyakarta', 'short_name' => 'BBPPMT Yogyakarta', 'level' => Unit::LEVEL_UPT],
                    ['code' => 'UPT-BPPMT-PEKANBARU', 'name' => 'Balai Pelatihan dan Pemberdayaan Masyarakat Transmigrasi Pekanbaru', 'short_name' => 'BPPMT Pekanbaru', 'level' => Unit::LEVEL_UPT],
                    ['code' => 'UPT-BPPMT-BANJARMASIN', 'name' => 'Balai Pelatihan dan Pemberdayaan Masyarakat Transmigrasi Banjarmasin', 'short_name' => 'BPPMT Banjarmasin', 'level' => Unit::LEVEL_UPT],
                    ['code' => 'UPT-BPPMT-DENPASAR', 'name' => 'Balai Pelatihan dan Pemberdayaan Masyarakat Transmigrasi Denpasar', 'short_name' => 'BPPMT Denpasar', 'level' => Unit::LEVEL_UPT],
                ],
            ],
            ['code' => 'PUS-DATIN', 'name' => 'Pusat Data dan Informasi Transmigrasi', 'short_name' => 'Pusdatin', 'level' => $e2],
        ];
    }
}
