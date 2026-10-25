<?php

namespace Database\Seeders;

use App\Models\KnowledgeSource;
use Illuminate\Database\Seeder;

/**
 * Situs resmi Kementerian Transmigrasi untuk Sumber Resmi (diperiksa
 * 25 Okt 2026, semuanya halaman HTML publik). Seeder hanya mendaftarkan;
 * isinya diambil oleh `sigap:sinkron-sumber` atau tombol "Ambil ulang semua
 * situs" — tidak ada akses jaringan saat seeding.
 */
class OfficialSourceSeeder extends Seeder
{
    /** @var list<array{0: string, 1: string, 2: bool}> nama, alamat, ikuti tautan */
    private const SOURCES = [
        ['SIBARDUKTRANS — Tata Cara Bertransmigrasi', 'https://sibarduktrans.transmigrasi.go.id/tataCaraBertransmigrasi', false],
        ['SIBARDUKTRANS — Informasi Lokasi', 'https://sibarduktrans.transmigrasi.go.id/informasiLokasi', true],
        ['Kementrans — Persyaratan Transmigrasi', 'https://www.transmigrasi.go.id/layanan/persyaratan-transmigrasi/', false],
        ['PPID — Tanya Jawab', 'https://ppid.transmigrasi.go.id/faq', false],
        ['PPID — Standar Layanan', 'https://ppid.transmigrasi.go.id/standar-layanan/kanal-layanan', true],
        ['PPID — Tugas dan Fungsi', 'https://ppid.transmigrasi.go.id/kementerian/tugas-fungsi', false],
        ['Kementrans — Cek Fakta', 'https://www.transmigrasi.go.id/publikasi/cek-fakta/', true],
        // Dasar hukum & program (PDF JDIH): definisi, tujuan, jenis, hak & kewajiban transmigran.
        ['JDIH — UU 15/1997 tentang Ketransmigrasian', 'https://jdih.transmigrasi.go.id/public/documents/1624513736__nomor__tahun_1997.pdf', false],
        ['JDIH — UU 29/2009 Perubahan UU Ketransmigrasian', 'https://jdih.transmigrasi.go.id/public/documents/1624513932__nomor__tahun_2009.pdf', false],
        ['JDIH — Permentrans 3/2026 tentang Transmigrasi Patriot', 'https://jdih.transmigrasi.go.id/public/documents/2026peraturan-menteri-transmigrasi3.pdf', false],
        ['PPID — Visi dan Misi', 'https://ppid.transmigrasi.go.id/kementerian/visi-misi', false],
        ['Kementrans — Visi dan Misi', 'https://www.transmigrasi.go.id/profil/visi-misi/', false],
        // Arah & alasan kebijakan (diperiksa 25 Okt 2026, semuanya berteks): untuk pertanyaan
        // kebijakan — relevansi transmigrasi, ukuran keberhasilan, sukarela, masyarakat lokal.
        ['JDIH — Permentrans 11/2025 tentang Renstra Kementrans 2025–2029', 'https://jdih.transmigrasi.go.id/public/documents//d909885b-d591-4d37-95b2-5021d6c8a9e1Peraturan_Menteri_Transmigrasi_Nomor_11_Tahun_2025_tentang_Renstra_Kementrans_tahun_2025_2029.pdf', false],
        ['Kementrans — Laporan Kinerja Tahun 2025', 'https://www.transmigrasi.go.id/wp-content/uploads/2026/08/Laporan-Kinerja-Kementerian-Transmigrasi-Tahun-2025.pdf', false],
        ['JDIH — Permentrans 8/2025 tentang Transformasi Transmigrasi', 'https://jdih.transmigrasi.go.id/public/documents//e88aaee4-aadd-4bd2-b302-7e327b412088Permentrans_No_8_th_2025_-_Transformasi_Transmigrasi.pdf', false],
        ['JDIH — Permentrans 13/2025 Perubahan Permentrans 8/2025', 'https://jdih.transmigrasi.go.id/public/documents/2025peraturan-menteri-transmigrasi13.pdf', false],
        ['Kementrans — Renstra Ditjen PPKTrans 2025–2029', 'https://www.transmigrasi.go.id/wp-content/uploads/2026/09/Rencana-Strategis-Ditjen-PPKTrans-2025-2029.pdf', false],
        ['Kementrans — Program Unggulan 5T', 'https://www.transmigrasi.go.id/programunggulan/', false],
        ['Kementrans — Program dan Kebijakan', 'https://www.transmigrasi.go.id/program-dan-kebijakan/', false],
        ['Kementrans — Transmigrasi Kini Diukur dari Lapangan Kerja', 'https://www.transmigrasi.go.id/mentrans-transmigrasi-kini-diukur-dari-lapangan-kerja-bukan-lagi-jumlah-penduduk-yang-dipindahkan/', false],
        ['Kementrans — Transmigrasi Hari Ini: dari Miskin Menjadi Sejahtera', 'https://www.transmigrasi.go.id/transmigrasi-hari-ini-perpindahan-penduduk-dari-miskin-menjadi-sejahtera/', false],
        ['Kementrans — Menteri Dialog dengan Warga Setempat atas Usulan Pemda', 'https://www.transmigrasi.go.id/tak-perlu-gelisah-menteri-iftitah-akan-dialog-langsung-dengan-warga-setempat-jika-ada-usulan-transmigrasi-dari-pemda/', false],
        ['Kementrans — Pusat Pertumbuhan Ekonomi Tak Cukup dengan Infrastruktur', 'https://www.transmigrasi.go.id/di-peking-university-iftitah-bangun-pusat-pertumbuhan-ekonomi-tak-cukup-hanya-dengan-infrastruktur/', false],
        ['Kementrans — Berdayakan Masyarakat Setempat lewat Transmigran Lokal', 'https://www.transmigrasi.go.id/fokus-berdayakan-masyarakat-setempat-kementrans-tempatkan-hampir-1-300-transmigran-lokal-di-10-lokasi/', false],
    ];

    public function run(): void
    {
        foreach (self::SOURCES as [$name, $url, $follow]) {
            KnowledgeSource::query()->firstOrCreate(
                ['kind' => KnowledgeSource::KIND_SITE, 'url' => $url],
                ['name' => $name, 'follow_links' => $follow, 'status' => KnowledgeSource::STATUS_QUEUED],
            );
        }
    }
}
