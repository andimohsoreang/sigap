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
