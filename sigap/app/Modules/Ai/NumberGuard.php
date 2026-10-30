<?php

namespace App\Modules\Ai;

/**
 * Pengaman angka (PRD-AI FR-AI-12): setiap angka di jawaban model harus ada
 * di teks sumber yang dikutip atau di pesan warga. Model kerap menulis
 * ketentuan dari pengetahuannya sendiri (mis. batas usia aturan lama) sambil
 * mengutip sumber yang tidak memuatnya; jawaban seperti itu tidak dikirim.
 *
 * Angka dibandingkan per deret digit, jadi rentang setara apa pun tanda
 * hubungnya ("19–53" = "19 - 53" = "19 sampai 53"). Rujukan "[3]" dan
 * penanda daftar "1." di awal baris diabaikan; pemisah ribuan ("1.300") dan
 * nol di depan ("08") dinormalkan.
 */
final class NumberGuard
{
    /**
     * Angka di jawaban yang tidak ditemukan di teks dasar (urut kemunculan, unik).
     *
     * @param  list<string>  $basis  teks sumber yang dikutip dan pesan warga
     * @return list<string>
     */
    public static function unsupported(string $answer, array $basis): array
    {
        $allowed = array_flip(self::numbers(implode("\n", $basis)));

        return array_values(array_unique(array_filter(
            self::numbers(self::stripMarkers($answer)),
            fn (string $n) => ! isset($allowed[$n]),
        )));
    }

    /** Buang rujukan sumber "[3]", "[1, 2]" dan penanda daftar "1." / "2)" di awal baris. */
    private static function stripMarkers(string $text): string
    {
        $text = preg_replace('/\[\s*\d+(?:\s*[,;]\s*\d+)*\s*\]/u', ' ', $text) ?? $text;

        return preg_replace('/^[ \t]*\d{1,2}[.)](?=\s)/mu', ' ', $text) ?? $text;
    }

    /**
     * Deret angka yang dinormalkan.
     *
     * @return list<string>
     */
    private static function numbers(string $text): array
    {
        // "1.300" / "2.500.000" → satu bilangan; "08.00" (jam) tetap dua angka.
        $text = preg_replace_callback('/(?<![\d.])\d{1,3}(?:\.\d{3})+(?!\d|\.\d)/u', fn (array $m) => str_replace('.', '', $m[0]), $text) ?? $text;
        preg_match_all('/\d+/u', $text, $matches);

        return array_map(fn (string $n) => ltrim($n, '0') === '' ? '0' : ltrim($n, '0'), $matches[0]);
    }
}
