<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Channel;
use App\Models\Region;
use App\Models\Setting;
use Illuminate\Database\Seeder;

class MasterSeeder extends Seeder
{
    public function run(): void
    {
        // Kategori aduan (paritas pilihan pada UI lama)
        $categories = [
            ['name' => 'Infrastruktur Dasar', 'slug' => 'infrastruktur-dasar', 'sla_days' => 14],
            ['name' => 'Tata Kelola Lahan', 'slug' => 'tata-kelola-lahan', 'sla_days' => 14],
            ['name' => 'Bantuan Sosial', 'slug' => 'bantuan-sosial', 'sla_days' => 14],
            ['name' => 'Layanan Data / TIK', 'slug' => 'layanan-data-tik', 'sla_days' => 14],
        ];
        foreach ($categories as $c) {
            Category::updateOrCreate(['slug' => $c['slug']], $c + ['is_active' => true]);
        }

        // Kawasan transmigrasi — PRD D9: DATA SPASIAL DUMMY (koordinat contoh)
        $regions = [
            ['code' => 'KWS-001', 'name' => 'SP1 Merauke', 'province' => 'Papua Selatan', 'latitude' => -8.4991, 'longitude' => 140.4011, 'infrastructure_status' => 'Memadai', 'kk_count' => 500],
            ['code' => 'KWS-002', 'name' => 'SP3 Bulungan', 'province' => 'Kalimantan Utara', 'latitude' => 2.8333, 'longitude' => 117.3667, 'infrastructure_status' => 'Berkembang', 'kk_count' => 350],
            ['code' => 'KWS-003', 'name' => 'SP2 Luwu Timur', 'province' => 'Sulawesi Selatan', 'latitude' => -2.5833, 'longitude' => 121.1000, 'infrastructure_status' => 'Berkembang', 'kk_count' => 420],
        ];
        foreach ($regions as $r) {
            Region::updateOrCreate(['code' => $r['code']], $r + ['is_active' => true, 'geometry' => null]);
        }

        // Kanal pengaduan (5 kanal resmi + integrasi nasional)
        $channels = [
            ['type' => 'sosmed', 'name' => '@SIGAP_RI', 'account_name' => '@SIGAP_RI', 'url' => 'https://instagram.com/sigap', 'status' => 'aktif'],
            ['type' => 'kantor', 'name' => 'Kanal Kantor Pemerintahan', 'url' => null, 'status' => 'aktif'],
            ['type' => 'nasional', 'name' => 'SP4N-LAPOR!', 'url' => 'https://api.lapor.go.id/v2/instansi/kemenatrans', 'status' => 'aktif'],
            ['type' => 'nasional', 'name' => 'Whistleblowing System', 'url' => 'https://wbs.kemenatrans.go.id/api/v1/rekap', 'status' => 'aktif'],
            ['type' => 'internal', 'name' => 'Pengaduan Internal Pegawai', 'url' => null, 'status' => 'aktif'],
        ];
        foreach ($channels as $ch) {
            Channel::updateOrCreate(['type' => $ch['type'], 'name' => $ch['name']], $ch);
        }

        // Konfigurasi sistem awal
        Setting::put('sla_response_minutes', 60);
        Setting::put('ews_enabled', true);
        Setting::put('auto_disposition', false);
        Setting::put('notification', [
            'pic_email' => 'biro.umum@kemenatrans.go.id',
            'pic_phone' => '081200000000',
            'whatsapp_enabled' => false, // PRD D10: WA dinonaktifkan
        ]);
    }
}