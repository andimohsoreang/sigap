<?php

namespace App\Services\Ai;

/**
 * Menyamarkan data pribadi sebelum teks dikirim ke model AI (UU 27/2022).
 * Teks asli tetap tersimpan di database SIGAP; yang dikirim hanya versi tersamar.
 */
class PiiMasker
{
    public function mask(string $text): string
    {
        $rules = [
            // Surel
            '/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i' => '[SUREL]',
            // NIK: tepat 16 digit
            '/(?<!\d)\d{16}(?!\d)/' => '[NIK]',
            // Nomor HP Indonesia: 08…, 628…, +628…, boleh berpemisah spasi/titik/strip
            '/(?<![\d+])(?:\+?62|0)8(?:[\s.-]?\d){7,11}(?!\d)/' => '[NOMOR HP]',
            // Deret angka panjang lain (rekening, KK, dsb.)
            '/(?<!\d)\d{10,}(?!\d)/' => '[NOMOR]',
        ];

        return (string) preg_replace(array_keys($rules), array_values($rules), $text);
    }
}
