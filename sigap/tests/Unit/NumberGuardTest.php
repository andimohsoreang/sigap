<?php

namespace Tests\Unit;

use App\Modules\Ai\NumberGuard;
use PHPUnit\Framework\TestCase;

/** Pengaman angka (PRD-AI FR-AI-12): satu tes per aturan. */
class NumberGuardTest extends TestCase
{
    public function test_numbers_found_in_source_pass_and_others_are_reported(): void
    {
        $source = 'PPID memberi tanggapan paling lambat 10 hari kerja, dapat diperpanjang 7 hari kerja.';

        $this->assertSame([], NumberGuard::unsupported('Paling lambat 10 hari kerja, dapat diperpanjang 7 hari kerja [1].', [$source]));
        $this->assertSame(['14', '30'], NumberGuard::unsupported('Paling lambat 14 hari kerja atau 30 hari kerja [1].', [$source]));
        $this->assertSame([], NumberGuard::unsupported('Tanpa angka sama sekali.', [$source]));
    }

    public function test_citation_markers_are_ignored(): void
    {
        $this->assertSame([], NumberGuard::unsupported('Usia 19 tahun [3]. Lihat juga [1, 2] dan [4;5].', ['usia 19 tahun']));
    }

    public function test_list_markers_at_line_start_are_ignored_but_numbers_in_text_are_not(): void
    {
        $answer = "Langkahnya:\n1. Isi formulir.\n2) Simpan nomor registrasi.\n 3. Tunggu tanggapan tertulis.";
        $this->assertSame([], NumberGuard::unsupported($answer, ['Isi formulir, simpan nomor registrasi.']));

        $this->assertSame(['3'], NumberGuard::unsupported('Diatur dalam Pasal 3.', ['Diatur dalam Pasal 5.']));
    }

    public function test_ranges_match_whatever_the_separator(): void
    {
        foreach (['19–53 tahun', '19 - 53 tahun', '19-53 tahun', '19 sampai 53 tahun', '19 s/d 53 tahun', '19 sampai dengan 53 tahun'] as $answer) {
            foreach (['usia antara 19 - 53 tahun', 'usia antara 19 (sembilan belas) tahun sampai dengan 53 (lima puluh tiga) tahun', 'usia 19–53 tahun'] as $source) {
                $this->assertSame([], NumberGuard::unsupported($answer, [$source]), "{$answer} ⇢ {$source}");
            }
        }

        $this->assertSame(['49'], NumberGuard::unsupported('Usia 19–49 tahun [1].', ['usia antara 19 - 53 tahun']));
    }

    public function test_thousand_separators_times_and_leading_zeros_are_normalised(): void
    {
        $this->assertSame([], NumberGuard::unsupported('Hampir 1300 transmigran lokal.', ['menempatkan hampir 1.300 transmigran lokal.']));
        $this->assertSame([], NumberGuard::unsupported('Hampir 1.300 transmigran lokal.', ['menempatkan hampir 1300 transmigran lokal']));
        $this->assertSame([], NumberGuard::unsupported('Rp2.500.000 per keluarga.', ['bantuan Rp 2.500.000 per keluarga']));
        $this->assertSame([], NumberGuard::unsupported('Senin–Jumat, 08.00–15.00 WIB.', ['Senin - Jumat, 08.00 - 15.00 WIB']));
        $this->assertSame([], NumberGuard::unsupported('Telepon 021-7994372.', ['Telepon: 021-7994372']));
        $this->assertSame(['16'], NumberGuard::unsupported('Pukul 08.00–16.00.', ['08.00 - 15.00']));
    }

    public function test_numbers_from_the_citizen_message_are_allowed(): void
    {
        $basis = ['Saya berumur 50 tahun, masih bisa ikut?', 'usia antara 19 - 53 tahun'];

        $this->assertSame([], NumberGuard::unsupported('Ketentuan umumnya usia 19–53 tahun [1]; usia 50 tahun perlu dipastikan petugas.', $basis));
    }
}
