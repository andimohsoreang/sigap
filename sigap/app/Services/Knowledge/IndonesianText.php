<?php

namespace App\Services\Knowledge;

/**
 * Pengolah teks Bahasa Indonesia untuk pencarian Basis Pengetahuan.
 *
 * Setiap kata diubah menjadi beberapa "kunci" pencocokan:
 * - kata dasar hasil pemangkasan imbuhan ("pendaftaran" → "daftar",
 *   "ditolak" → "tolak"). Peluluhan me-/pe- menghasilkan beberapa calon
 *   ("mengirim" → "irim", "kirim") karena kata dasarnya tidak dapat
 *   dipastikan tanpa kamus; calon yang salah tidak merugikan karena hanya
 *   cocok dengan calon yang sama salahnya.
 * - awalan 6 huruf untuk kata dasar panjang ("transmigran" ≈ "transmigrasi").
 * - padanan dari daftar sinonim ("tanah" → "lahan", "banding" → "berat").
 *
 * Pertanyaan dan artikel diproses dengan aturan yang sama, jadi kesalahan
 * pemangkasan bersifat simetris.
 */
final class IndonesianText
{
    /** Kata tanya, sapaan, dan pengisi (termasuk bahasa daerah yang umum) yang tidak dicari. */
    private const STOPWORDS = [
        'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'apa', 'apakah', 'bagaimana', 'gimana', 'cara',
        'saya', 'aku', 'kami', 'kita', 'ini', 'itu', 'ada', 'atau', 'tidak', 'bisa', 'sudah', 'akan', 'pada',
        'dalam', 'adalah', 'juga', 'mau', 'ingin', 'tolong', 'mohon', 'pak', 'bu', 'bapak', 'ibu', 'kak', 'min',
        'ya', 'dong', 'sih', 'kah', 'nya', 'kalau', 'kalo', 'jika', 'bila', 'agar', 'supaya', 'bagi', 'oleh',
        'para', 'sebagai', 'kapan', 'dimana', 'mana', 'siapa', 'berapa', 'mengapa', 'kenapa', 'tentang', 'soal',
        'harus', 'perlu', 'boleh', 'saja', 'lagi', 'masih', 'belum', 'sudahkah', 'halo', 'hai', 'terima', 'kasih',
        'admin', 'selamat', 'pagi', 'siang', 'sore', 'malam', 'permisi', 'maaf', 'tanya', 'bertanya', 'mas', 'mbak',
        'nggak', 'gak', 'ga', 'enggak', 'tak', 'dgn', 'yg', 'utk', 'aja', 'deh', 'kok', 'lho', 'nih', 'tuh', 'kan',
        'kalian', 'anda', 'beliau', 'mereka', 'dia', 'jadi', 'menjadi', 'lalu', 'kemudian', 'tersebut', 'secara',
        'seperti', 'antara', 'hal', 'serta', 'telah', 'dapat', 'hanya', 'sangat', 'lebih', 'paling', 'semua',
        'seorang', 'seseorang', 'sebuah', 'suatu', 'sekarang', 'tadi', 'nanti',
        // Jawa & Sunda: kata tanya/sapaan yang sering ditulis warga.
        'nuwun', 'sewu', 'kulo', 'kula', 'badhe', 'bade', 'pripun', 'piye', 'wonten', 'nopo', 'menapa',
        'sampun', 'dereng', 'matur', 'sembah', 'kumaha', 'abdi', 'naon', 'teh', 'mah', 'atuh', 'punten', 'hatur',
    ];

    /**
     * Padanan kata → kunci baku. Kunci baku ditulis dalam bentuk kata dasar
     * (setelah pemangkasan), karena di situlah kata pada artikel bertemu.
     */
    private const SYNONYMS = [
        'tanah' => 'lahan', 'kebun' => 'lahan', 'kavling' => 'lahan', 'kapling' => 'lahan',
        'sertipikat' => 'sertif', 'shm' => 'sertif', 'sertifikasi' => 'sertif',
        'banding' => 'berat', 'sanggah' => 'berat', 'sanggahan' => 'berat', 'protes' => 'berat',
        'aduan' => 'adu', 'keluhan' => 'adu', 'keluh' => 'adu', 'komplain' => 'adu', 'ngadu' => 'adu', 'lapor' => 'adu', 'laporan' => 'adu', 'melapor' => 'adu', 'melaporkan' => 'adu',
        'duit' => 'biaya', 'uang' => 'biaya', 'tarif' => 'biaya', 'bayar' => 'biaya', 'membayar' => 'biaya', 'gratis' => 'biaya', 'cuma' => 'biaya', 'pungut' => 'biaya', 'dipungut' => 'biaya',
        'lama' => 'waktu', 'durasi' => 'waktu', 'jangka' => 'waktu',
        'jatah' => 'bantu', 'bansos' => 'bantu', 'subsidi' => 'bantu',
        'sembako' => 'pangan', 'beras' => 'pangan', 'makan' => 'pangan', 'makanan' => 'pangan',
        'pekerjaan' => 'kerja', 'lowongan' => 'kerja', 'loker' => 'kerja',
        'info' => 'informasi', 'keterangan' => 'informasi',
        'telepon' => 'kontak', 'telpon' => 'kontak', 'telp' => 'kontak', 'whatsapp' => 'kontak', 'wa' => 'kontak', 'hubungi' => 'kontak', 'menghubungi' => 'kontak', 'email' => 'kontak', 'surel' => 'kontak',
        'pungli' => 'wenang', 'suap' => 'wenang', 'sogok' => 'wenang', 'korupsi' => 'wenang', 'gratifikasi' => 'wenang',
        'translok' => 'lokal', 'pindahan' => 'pindah', 'merantau' => 'pindah',
        'registrasi' => 'daftar', 'mendaftar' => 'daftar',
        'kriteria' => 'syarat', 'ketentuan' => 'syarat', 'kualifikasi' => 'syarat',
        // "batas usia", "umur maksimal" = pertanyaan tentang syarat.
        'batas' => 'syarat', 'maksimal' => 'syarat', 'minimal' => 'syarat', 'maks' => 'syarat',
        'umur' => 'usia', 'ikut' => 'daftar', 'gabung' => 'daftar', 'bergabung' => 'daftar',
        'status' => 'lacak', 'cek' => 'lacak', 'pantau' => 'lacak', 'memantau' => 'lacak',
    ];

    private const PARTICLES = ['lah', 'kah', 'tah', 'pun'];

    private const POSSESSIVES = ['nya', 'ku', 'mu'];

    private const SUFFIXES = ['kan', 'an', 'i'];

    /**
     * Kata-kata pertanyaan, masing-masing beserta kunci pencocokannya.
     *
     * @return list<list<string>>
     */
    public static function words(string $text): array
    {
        $raw = preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($text), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        $words = [];
        foreach ($raw as $word) {
            if (self::ignored($word)) {
                continue;
            }
            $keys = self::keys($word);
            if ($keys !== [] && ! in_array($keys, $words, true)) {
                $words[] = $keys;
            }
        }

        return $words;
    }

    /**
     * Frekuensi kunci dalam satu teks (untuk indeks artikel).
     *
     * @return array<string, int>
     */
    public static function frequencies(string $text): array
    {
        $freq = [];
        foreach (preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($text), -1, PREG_SPLIT_NO_EMPTY) ?: [] as $word) {
            if (self::ignored($word)) {
                continue;
            }
            foreach (self::keys($word) as $key) {
                $freq[$key] = ($freq[$key] ?? 0) + 1;
            }
        }

        return $freq;
    }

    /** Kata pengisi, termasuk bentuk berakhiran ("caranya", "bagaimanakah"). */
    private static function ignored(string $word): bool
    {
        if (mb_strlen($word) < 3) {
            return true;
        }

        $base = self::stripEnd(self::stripEnd($word, self::PARTICLES), self::POSSESSIVES);

        return in_array($word, self::STOPWORDS, true) || in_array($base, self::STOPWORDS, true);
    }

    /** @return list<string> */
    public static function keys(string $word): array
    {
        if (is_numeric($word)) {
            return [$word];
        }

        $keys = [$word];
        if (isset(self::SYNONYMS[$word])) {
            $keys[] = self::SYNONYMS[$word];
        }

        foreach (self::stems($word) as $stem) {
            $keys[] = $stem;
            if (isset(self::SYNONYMS[$stem])) {
                $keys[] = self::SYNONYMS[$stem];
            }
            if (mb_strlen($stem) >= 8) {
                $keys[] = mb_substr($stem, 0, 6);
            }
        }
        if (mb_strlen($word) >= 8) {
            $keys[] = mb_substr($word, 0, 6);
        }

        return array_values(array_unique(array_filter($keys, fn (string $k) => mb_strlen($k) >= 3)));
    }

    /**
     * Calon kata dasar (tanpa kamus): partikel → kata ganti milik → akhiran →
     * awalan (paling banyak dua lapis, mis. "memper-", "diper-").
     *
     * @return list<string>
     */
    public static function stems(string $word): array
    {
        // Partikel & kata ganti milik bisa bagian dari kata dasar ("nikah",
        // "masalah", "sekolah"), jadi bentuk utuhnya tetap dipertahankan.
        $heads = array_unique([
            $word,
            self::stripEnd($word, self::PARTICLES),
            self::stripEnd($word, self::POSSESSIVES),
            self::stripEnd(self::stripEnd($word, self::PARTICLES), self::POSSESSIVES),
        ]);

        $bases = [];
        foreach ($heads as $head) {
            $bases[] = $head;
            foreach (self::SUFFIXES as $suffix) {
                if (str_ends_with($head, $suffix) && mb_strlen($head) - mb_strlen($suffix) >= 4) {
                    $bases[] = mb_substr($head, 0, -mb_strlen($suffix));
                    break;
                }
            }
        }

        $stems = [];
        foreach (array_unique($bases) as $base) {
            $stems[] = $base;
            foreach (self::stripPrefix($base) as $once) {
                $stems[] = $once;
                foreach (self::stripPrefix($once) as $twice) {
                    $stems[] = $twice;
                }
            }
        }

        return array_values(array_unique($stems));
    }

    /** @param list<string> $endings */
    private static function stripEnd(string $word, array $endings): string
    {
        foreach ($endings as $end) {
            if (str_ends_with($word, $end) && mb_strlen($word) - mb_strlen($end) >= 4) {
                return mb_substr($word, 0, -mb_strlen($end));
            }
        }

        return $word;
    }

    /**
     * Satu lapis awalan beserta peluluhannya. Sisa kata minimal 3 huruf agar
     * kata dasar pendek ("berat", "beras") tidak ikut terpotong.
     *
     * @return list<string>
     */
    private static function stripPrefix(string $word): array
    {
        $out = [];
        $keep = fn (string $rest) => mb_strlen($rest) >= 3 ? $rest : null;
        $vowel = fn (string $s) => $s !== '' && str_contains('aiueo', $s[0]);

        foreach (['meng', 'peng'] as $p) {
            if (str_starts_with($word, $p)) {
                $rest = substr($word, 4);
                $out[] = $keep($rest);
                if ($vowel($rest)) {
                    $out[] = $keep('k'.$rest);
                }

                return array_values(array_filter($out));
            }
        }
        foreach (['meny', 'peny'] as $p) {
            if (str_starts_with($word, $p) && $vowel(substr($word, 4))) {
                return array_values(array_filter([$keep('s'.substr($word, 4))]));
            }
        }
        foreach (['mem', 'pem'] as $p) {
            if (str_starts_with($word, $p)) {
                $rest = substr($word, 3);
                $out[] = $keep($rest);
                if ($vowel($rest)) {
                    $out[] = $keep('p'.$rest);
                    $out[] = $keep('m'.$rest);
                }

                return array_values(array_filter($out));
            }
        }
        foreach (['men', 'pen'] as $p) {
            if (str_starts_with($word, $p)) {
                $rest = substr($word, 3);
                $out[] = $keep($rest);
                if ($vowel($rest)) {
                    $out[] = $keep('t'.$rest);
                    $out[] = $keep('n'.$rest);
                }

                return array_values(array_filter($out));
            }
        }
        foreach (['ber', 'ter', 'per'] as $p) {
            if (str_starts_with($word, $p)) {
                return array_values(array_filter([$keep(substr($word, 3)), $vowel(substr($word, 3)) ? $keep('r'.substr($word, 3)) : null]));
            }
        }
        foreach (['me', 'pe'] as $p) {
            if (str_starts_with($word, $p) && in_array($word[2] ?? '', ['l', 'r', 'w', 'y', 'm', 'n'], true)) {
                return array_values(array_filter([$keep(substr($word, 2))]));
            }
        }
        foreach (['di', 'ke', 'se'] as $p) {
            if (str_starts_with($word, $p)) {
                return array_values(array_filter([$keep(substr($word, 2))]));
            }
        }

        return [];
    }
}
