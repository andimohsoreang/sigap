<?php

namespace Database\Seeders;

use App\Models\KnowledgeArticle;
use Illuminate\Database\Seeder;

/**
 * Artikel awal Basis Pengetahuan: HANYA tentang cara memakai layanan SIGAP
 * (sesuai perilaku aplikasi). Informasi program transmigrasi (syarat,
 * pertanahan, bantuan) wajib diisi Biro dari dokumen resmi.
 *
 * Hanya berjalan bila tabel masih kosong, agar suntingan petugas tidak
 * tertimpa saat seeder dijalankan ulang.
 */
class KnowledgeSeeder extends Seeder
{
    private const SOURCE = 'Panduan Layanan SIGAP';

    public function run(): void
    {
        if (KnowledgeArticle::query()->exists()) {
            return;
        }

        foreach ($this->articles() as [$title, $body, $category]) {
            KnowledgeArticle::create([
                'title' => $title,
                'body' => $body,
                'category' => $category,
                'source' => self::SOURCE,
                'status' => KnowledgeArticle::STATUS_PUBLISHED,
                'review_at' => now()->addMonths(6)->toDateString(),
            ]);
        }
    }

    /** @return list<array{0: string, 1: string, 2: string}> */
    private function articles(): array
    {
        return [
            [
                'Bagaimana cara membuat pengaduan di SIGAP?',
                "1. Buka menu Buat Pengaduan.\n2. Pilih kategori dan kawasan, lalu tulis uraian masalah.\n3. Lampirkan foto atau dokumen bila ada, dan tandai titik lokasi.\n4. Kirim. Anda akan menerima nomor tiket berformat TKT-YYMMDD-XXXXXX untuk melacak perkembangannya.",
                'Layanan SIGAP',
            ],
            [
                'Bagaimana cara melacak tiket pengaduan?',
                'Buka menu Lacak Tiket, lalu masukkan nomor tiket Anda (contoh: TKT-261012-7KQ4MZ). Anda juga dapat mengetik nomor tiket langsung di chat Asisten SIGAP. Nama pelapor selalu ditampilkan tersamar demi privasi.',
                'Layanan SIGAP',
            ],
            [
                'Apa arti status tiket?',
                "Menunggu: tiket baru diterima.\nDiverifikasi: petugas memeriksa kelengkapan dan kebenaran laporan.\nDiproses: laporan sedang ditindaklanjuti.\nSelesai: penanganan selesai; Anda dapat mengisi survei kepuasan.\nDitolak: laporan tidak dapat diproses, misalnya karena data tidak lengkap. Alasannya dapat dilihat di halaman lacak.",
                'Layanan SIGAP',
            ],
            [
                'Berapa lama pengaduan ditangani?',
                'Batas waktu penanganan ditentukan oleh tingkat dampak laporan: dampak kritis 3 hari kerja, dampak tinggi 7 hari kerja, dampak sedang dan rendah 14 hari kerja. Batas waktu tiket Anda tercantum di halaman lacak.',
                'Layanan SIGAP',
            ],
            [
                'Apakah saya bisa mengadu tanpa menyebutkan identitas?',
                'Bisa. Saat membuat pengaduan, pilih klasifikasi Anonim agar nama Anda tidak ditampilkan, atau Rahasia agar laporan hanya dapat dilihat oleh Anda dan petugas yang berwenang.',
                'Layanan SIGAP',
            ],
            [
                'Kapan sebaiknya melapor ke SP4N-LAPOR! atau WBS?',
                'Gunakan SP4N-LAPOR! (lapor.go.id) bila masalah Anda juga menyangkut instansi lain, misalnya pemerintah daerah atau ATR/BPN. Gunakan Whistleblowing System (WBS) untuk dugaan pungutan liar, korupsi, atau pelanggaran oleh pegawai; identitas pelapor dilindungi.',
                'Rujukan',
            ],
            [
                'Bagaimana cara masuk sebagai warga?',
                'Belum punya akun? Pilih menu Masuk lalu klik "Daftar di sini", isi NIK, nama, email, dan kata sandi, kemudian klik tautan verifikasi yang dikirim ke email Anda. Setelah itu masuk dengan NIK dan kata sandi. Tidak punya email? Tulis di chat ini dan minta dibantu petugas; petugas dapat membuatkan akun untuk Anda cukup dengan NIK dan nama sesuai KTP. Lupa kata sandi? Klik "Lupa kata sandi?" di halaman Masuk untuk menerima tautan atur ulang lewat email. Hak akses admin hanya diberikan kepada pegawai yang terdaftar.',
                'Layanan SIGAP',
            ],
            [
                'Saya lupa kata sandi dan tidak punya email, bagaimana?',
                'Tekan "Bicara dengan petugas" di chat ini. Petugas akan menanyakan NIK dan nomor HP yang dulu Anda daftarkan. Bila cocok, Anda menerima tombol "Buat kata sandi baru" di chat; tekan tombol itu, buat kata sandi baru, dan Anda langsung masuk. Petugas tidak akan pernah menanyakan kata sandi Anda. Bila akun Anda punya email aktif, Anda juga bisa memakai menu "Lupa kata sandi?" di halaman Masuk.',
                'Layanan SIGAP',
            ],
            [
                'Bagaimana cara menghapus dokumen yang sudah diunggah?',
                'Demi akuntabilitas, dokumen yang sudah dikirim tidak dapat dihapus sendiri. Silakan hubungi petugas melalui chat dengan menyebutkan nomor tiket Anda.',
                'Layanan SIGAP',
            ],
        ];
    }
}
