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
