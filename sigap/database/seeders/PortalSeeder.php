<?php

namespace Database\Seeders;

use App\Models\Portal;
use Illuminate\Database\Seeder;

/**
 * Katalog portal Kementerian Transmigrasi (diperiksa 17 Oktober 2026).
 *
 * Aman dijalankan ulang: portal yang kodenya sudah ada tidak ditimpa, agar
 * suntingan Super Admin (tautan, langkah, status aktif) tetap terjaga.
 */
class PortalSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->portals() as $i => $portal) {
            Portal::query()->firstOrCreate(['code' => $portal['code']], $portal + ['sort' => $i + 1]);
        }
    }

    /** @return list<array<string, mixed>> */
    public function portals(): array
    {
        return [
            [
                'code' => 'trans-tuntas',
                'name' => 'Trans Tuntas',
                'url' => 'https://tuntas-trans.transmigrasi.go.id/',
                'action_url' => 'https://tuntas-trans.transmigrasi.go.id/dashboard/public/lapor/',
                'action_label' => 'Buat pengaduan di Trans Tuntas',
                'audience' => Portal::AUDIENCE_PUBLIC,
                'purpose' => 'Pengaduan masalah lahan transmigrasi: sengketa, penyerobotan, konflik, batas, serta legalitas atau sertifikat lahan',
                'description' => 'Program penyelesaian lahan transmigrasi: layanan aduan cepat, mediasi konflik, validasi dan percepatan legalitas lahan, serta pendampingan masyarakat.',
                'keywords' => 'lahan, tanah, sengketa lahan, diserobot, penyerobotan, konflik agraria, sertifikat, SHM, legalitas, tumpang tindih, batas lahan, mediasi, kebun',
                'steps' => implode("\n", [
                    'Tekan tombol di bawah. Formulir Pengaduan Masyarakat Trans Tuntas terbuka di tab baru.',
                    'Isi nama lengkap, nomor KTP (16 digit), dan nomor HP.',
                    'Pilih Kategori Pengaduan "Lahan", lalu provinsi dan kabupaten/kota.',
                    'Tulis alamat lokasi kejadian dan tandai titiknya di peta bila bisa.',
                    'Salin ringkasan aduan dari halaman ini ke kolom Isi Pengaduan, lalu lengkapi.',
                    'Lampirkan bukti bila ada, lalu tekan Kirim Pengaduan.',
                    'Simpan kode tracking yang muncul, lalu masukkan di halaman ini.',
                ]),
                'prepare' => implode("\n", [
                    'KTP (nomor 16 digit)',
                    'Nomor HP aktif',
                    'Lokasi lahan: provinsi, kabupaten/kota, dan alamat',
                    'Bukti pendukung bila ada (foto, surat, sertifikat): JPG, PNG, PDF, atau DOC, maks. 5 MB',
                ]),
                'proof_label' => 'Kode tracking',
                'track_completion' => true,
                'managed_by' => 'Kementerian Transmigrasi',
                'contact' => 'tuntas@transmigrasi.go.id · 021-7994372 · Senin–Jumat 08.00–16.00 WIB',
            ],
            [
                'code' => 'lapor',
                'name' => 'SP4N-LAPOR!',
                'url' => 'https://sp4n.lapor.go.id/instansi/kementerian-transmigrasi',
                'action_url' => null,
                'action_label' => 'Buka SP4N-LAPOR!',
                'audience' => Portal::AUDIENCE_PUBLIC,
                'purpose' => 'Aduan pelayanan publik yang juga menyangkut instansi lain, misalnya pemerintah daerah atau ATR/BPN',
                'description' => 'Sistem Pengelolaan Pengaduan Pelayanan Publik Nasional; laporan dapat diteruskan lintas instansi.',
                'keywords' => 'instansi lain, pemerintah daerah, pemda, BPN, ATR, lintas instansi, lapor.go.id',
                'steps' => implode("\n", [
                    'Tekan tombol di bawah. Halaman Kementerian Transmigrasi di SP4N-LAPOR! terbuka di tab baru.',
                    'Masuk atau daftar akun LAPOR!.',
                    'Tulis laporan: apa yang terjadi, di mana, kapan, dan pihak yang terlibat. Salin ringkasan dari halaman ini.',
                    'Kirim laporan, simpan nomor tracking yang diberikan, lalu masukkan di halaman ini.',
                ]),
                'prepare' => implode("\n", [
                    'Identitas untuk akun LAPOR!',
                    'Uraian kejadian dan lokasinya',
                    'Bukti pendukung bila ada',
                ]),
                'proof_label' => 'Nomor tracking LAPOR!',
                'track_completion' => true,
                'managed_by' => 'KemenPAN-RB & Ombudsman RI',
                'contact' => null,
            ],
            [
                'code' => 'sibarduktrans',
                'name' => 'SIBARDUKTRANS',
                'url' => 'https://sibarduktrans.transmigrasi.go.id/',
                'action_url' => 'https://sibarduktrans.transmigrasi.go.id/pendaftaran',
                'action_label' => 'Daftar di SIBARDUKTRANS',
                'audience' => Portal::AUDIENCE_PUBLIC,
                'purpose' => 'Pendaftaran calon transmigran secara daring, tata cara bertransmigrasi, data transmigran, dan informasi lokasi tujuan',
                'description' => 'Sistem Informasi Penataan Persebaran Penduduk di Kawasan Transmigrasi.',
                'keywords' => 'daftar transmigrasi, pendaftaran, calon transmigran, ikut transmigrasi, mendaftar, lokasi tujuan, animo, tata cara bertransmigrasi',
                'steps' => implode("\n", [
                    'Tekan tombol di bawah. Halaman Pendaftaran Akun SIBARDUKTRANS terbuka di tab baru.',
                    'Buat akun dengan nomor telepon, email, dan kata sandi.',
                    'Masuk, lalu lengkapi data calon transmigran sesuai panduan.',
                    'Pendaftaran juga dapat dilakukan di kantor desa/kelurahan atau perangkat daerah kabupaten/kota yang menangani transmigrasi sesuai KTP Anda.',
                ]),
                'prepare' => implode("\n", [
                    'KTP-el',
                    'Kartu Keluarga dan surat nikah (bila berkeluarga)',
                    'Nomor HP dan email aktif',
                    'Sertifikat keahlian (bila mendaftar belum berkeluarga)',
                ]),
                'proof_label' => 'Nomor pendaftaran',
                'track_completion' => false,
                'managed_by' => 'Kementerian Transmigrasi',
                'contact' => 'sibarduktrans@transmigrasi.go.id · (021) 7971972',
            ],
            [
                'code' => 'ppid',
                'name' => 'PPID Kementerian Transmigrasi',
                'url' => 'https://ppid.transmigrasi.go.id/',
                'action_url' => 'https://ppid.transmigrasi.go.id/permohonan',
                'action_label' => 'Ajukan permohonan informasi',
                'audience' => Portal::AUDIENCE_PUBLIC,
                'purpose' => 'Permohonan informasi publik dan salinan dokumen resmi, pengajuan keberatan, serta daftar informasi publik',
                'description' => 'Layanan keterbukaan informasi publik sesuai UU 14/2008.',
                'keywords' => 'permohonan informasi, minta data, minta dokumen, salinan dokumen, keterbukaan informasi, keberatan, PPID, laporan kinerja, anggaran',
                'steps' => implode("\n", [
                    'Tekan tombol di bawah. Formulir Permohonan Informasi PPID terbuka di tab baru.',
                    'Isi identitas, rincian informasi yang diminta, tujuan penggunaan, serta cara memperoleh dan pengirimannya.',
                    'Simpan nomor registrasi untuk melacak permohonan di menu Cek Status Pengajuan.',
                ]),
                'prepare' => implode("\n", [
                    'KTP',
                    'Rincian informasi yang diminta dan tujuan penggunaannya',
                    'Email aktif untuk menerima salinan digital',
                ]),
                'proof_label' => 'Nomor registrasi',
                'track_completion' => false,
                'managed_by' => 'PPID Kementerian Transmigrasi',
                'contact' => 'ppid@transmigrasi.go.id · 021-7994372 · Senin–Jumat 08.00–15.00 WIB',
            ],
            [
                'code' => 'sipukat',
                'name' => 'SIPUKAT',
                'url' => 'https://sipukat.transmigrasi.go.id/',
                'action_url' => null,
                'action_label' => 'Buka peta SIPUKAT',
                'audience' => Portal::AUDIENCE_PUBLIC,
                'purpose' => 'Peta terpadu dan data kawasan transmigrasi: kawasan prioritas nasional, komoditas unggulan, HPL, dan potensi investasi',
                'description' => 'Sistem Informasi Peta Terpadu Kawasan Transmigrasi.',
                'keywords' => 'peta kawasan, data kawasan, lokasi kawasan transmigrasi, komoditas unggulan, investasi, HPL, kawasan prioritas, pronas, transpolitan',
                'steps' => null,
                'prepare' => null,
                'proof_label' => null,
                'track_completion' => false,
                'managed_by' => 'Kementerian Transmigrasi',
                'contact' => null,
            ],
            [
                'code' => 'jdih',
                'name' => 'JDIH Kementerian Transmigrasi',
                'url' => 'https://jdih.transmigrasi.go.id/',
                'action_url' => 'https://jdih.transmigrasi.go.id/web/regulations',
                'action_label' => 'Cari peraturan di JDIH',
                'audience' => Portal::AUDIENCE_PUBLIC,
                'purpose' => 'Naskah resmi peraturan transmigrasi: undang-undang, peraturan pemerintah, peraturan menteri, dan keputusan',
                'description' => 'Jaringan Dokumentasi dan Informasi Hukum Kementerian Transmigrasi.',
                'keywords' => 'peraturan, regulasi, undang-undang, peraturan menteri, permentrans, dasar hukum, unduh peraturan, naskah akademik',
                'steps' => null,
                'prepare' => null,
                'proof_label' => null,
                'track_completion' => false,
                'managed_by' => 'Biro Hukum Kementerian Transmigrasi',
                'contact' => 'jdih@transmigrasi.go.id',
            ],
            [
                'code' => 'presensi-rapat',
                'name' => 'Presensi Rapat',
                'url' => 'https://presensi-rapat.transmigrasi.go.id/',
                'action_url' => null,
                'action_label' => 'Buka daftar hadir',
                'audience' => Portal::AUDIENCE_PUBLIC,
                'purpose' => 'Daftar hadir rapat dan kegiatan Kementerian Transmigrasi untuk peserta yang diundang',
                'description' => null,
                'keywords' => 'absen rapat, daftar hadir, presensi, undangan rapat, kehadiran kegiatan',
                'steps' => null,
                'prepare' => null,
                'proof_label' => null,
                'track_completion' => false,
                'managed_by' => 'Kementerian Transmigrasi',
                'contact' => null,
            ],
            [
                'code' => 'tc-more',
                'name' => 'TC-More',
                'url' => 'https://awasi.transmigrasi.go.id/',
                'action_url' => null,
                'action_label' => null,
                'audience' => Portal::AUDIENCE_INTERNAL,
                'purpose' => 'Pemantauan progres kegiatan dan anggaran program kontraktual oleh Inspektorat Jenderal (khusus pegawai)',
                'description' => 'Trans Continuous Monitoring & Reporting.',
                'keywords' => null,
                'steps' => null,
                'prepare' => null,
                'proof_label' => null,
                'track_completion' => false,
                'managed_by' => 'Inspektorat Jenderal',
                'contact' => null,
            ],
            [
                'code' => 'transcloud',
                'name' => 'TransCloud',
                'url' => 'https://www.transmigrasi.go.id/cloud/index.php/login',
                'action_url' => null,
                'action_label' => null,
                'audience' => Portal::AUDIENCE_INTERNAL,
                'purpose' => 'Penyimpanan dan berbagi berkas internal (khusus pegawai)',
                'description' => null,
                'keywords' => null,
                'steps' => null,
                'prepare' => null,
                'proof_label' => null,
                'track_completion' => false,
                'managed_by' => 'Kementerian Transmigrasi',
                'contact' => null,
            ],
        ];
    }
}
