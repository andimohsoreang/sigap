<?php

namespace App\Support;

use App\Models\Survey;

/**
 * Survei Kepuasan Pasca-Penanganan Pengaduan Contact Center Kementerian
 * Transmigrasi. Skala 1–4 mengikuti Permenpan RB 14/2017 agar hasilnya dapat
 * disandingkan dengan SKM tahunan. Teks pertanyaan dan pilihan di sini adalah
 * satu-satunya sumber: halaman survei, validasi, dan rekap memakainya.
 */
final class SurveyQuestionnaire
{
    public const VERSION = 2;

    /** Pertanyaan 1–9: penilaian per aspek penanganan (dirata-rata untuk SKM). */
    public const ASPECTS = [
        'kemudahan' => [
            'aspek' => 'Kemudahan menyampaikan',
            'pertanyaan' => 'Bagaimana pendapat Anda tentang kemudahan menyampaikan pengaduan melalui website Contact Center?',
            'pilihan' => ['Tidak mudah', 'Kurang mudah', 'Mudah', 'Sangat mudah'],
        ],
        'konfirmasi' => [
            'aspek' => 'Konfirmasi penerimaan',
            'pertanyaan' => 'Apakah Anda menerima konfirmasi/nomor tiket setelah pengaduan dikirim?',
            'pilihan' => ['Tidak menerima', 'Menerima, tetapi tidak jelas', 'Menerima dan jelas', 'Menerima, jelas, dan bisa dilacak'],
        ],
        'respons' => [
            'aspek' => 'Kecepatan respons awal',
            'pertanyaan' => 'Bagaimana pendapat Anda tentang kecepatan tanggapan pertama atas pengaduan Anda?',
            'pilihan' => ['Tidak cepat', 'Kurang cepat', 'Cepat', 'Sangat cepat'],
        ],
        'penyelesaian' => [
            'aspek' => 'Waktu penyelesaian',
            'pertanyaan' => 'Bagaimana pendapat Anda tentang lamanya waktu sampai pengaduan dinyatakan selesai?',
            'pilihan' => ['Tidak cepat', 'Kurang cepat', 'Cepat', 'Sangat cepat'],
        ],
        'informasi' => [
            'aspek' => 'Kejelasan informasi',
            'pertanyaan' => 'Seberapa jelas informasi yang Anda terima tentang perkembangan dan tindak lanjut pengaduan?',
            'pilihan' => ['Tidak jelas', 'Kurang jelas', 'Jelas', 'Sangat jelas'],
        ],
        'kesesuaian' => [
            'aspek' => 'Kesesuaian hasil',
            'pertanyaan' => 'Apakah penyelesaian yang diberikan sesuai dengan permasalahan yang Anda adukan?',
            'pilihan' => ['Tidak sesuai', 'Kurang sesuai', 'Sesuai', 'Sangat sesuai'],
        ],
        'sikap' => [
            'aspek' => 'Sikap petugas',
            'pertanyaan' => 'Bagaimana pendapat Anda tentang kesopanan dan keramahan petugas yang menanggapi Anda?',
            'pilihan' => ['Tidak sopan dan ramah', 'Kurang sopan dan ramah', 'Sopan dan ramah', 'Sangat sopan dan ramah'],
        ],
        'kompetensi' => [
            'aspek' => 'Kompetensi petugas',
            'pertanyaan' => 'Bagaimana pendapat Anda tentang kemampuan petugas dalam memahami dan menyelesaikan masalah Anda?',
            'pilihan' => ['Tidak kompeten', 'Kurang kompeten', 'Kompeten', 'Sangat kompeten'],
        ],
        'kerahasiaan' => [
            'aspek' => 'Kerahasiaan',
            'pertanyaan' => 'Apakah Anda merasa aman dan terjaga kerahasiaan identitas Anda saat mengadu?',
            'pilihan' => ['Tidak aman', 'Kurang aman', 'Aman', 'Sangat aman'],
        ],
    ];

    /** Pertanyaan 10. */
    public const OVERALL = [
        'pertanyaan' => 'Secara keseluruhan, seberapa puas Anda dengan penanganan pengaduan ini?',
        'pilihan' => ['Sangat tidak puas', 'Tidak puas', 'Puas', 'Sangat puas'],
    ];

    /** Pertanyaan 11. Nilai "belum" dan "sebagian" membuka pilihan tinjau ulang. */
    public const RESOLVED = [
        'pertanyaan' => 'Apakah masalah Anda benar-benar teratasi?',
        'pilihan' => ['belum' => 'Belum teratasi', 'sebagian' => 'Sebagian teratasi', 'penuh' => 'Teratasi sepenuhnya'],
    ];

    public const UNRESOLVED = ['belum', 'sebagian'];

    /** Pertanyaan 12. */
    public const REUSE = [
        'pertanyaan' => 'Seberapa besar kemungkinan Anda menggunakan kembali Contact Center ini bila ada masalah layanan lagi?',
        'pilihan' => ['Tidak mungkin', 'Kurang mungkin', 'Mungkin', 'Sangat mungkin'],
    ];

    /** Pertanyaan 13–14 (opsional). */
    public const OPEN = [
        'good_feedback' => 'Apa yang sudah baik dari penanganan pengaduan Anda?',
        'improve_feedback' => 'Apa yang perlu kami perbaiki?',
    ];

    /** Profil tambahan (opsional, boleh dikosongkan). */
    public const PROFILE = [
        'age_group' => [
            'label' => 'Kelompok usia',
            'pilihan' => ['<20' => 'Di bawah 20 tahun', '20-29' => '20–29 tahun', '30-39' => '30–39 tahun', '40-49' => '40–49 tahun', '50-59' => '50–59 tahun', '60+' => '60 tahun ke atas'],
        ],
        'education' => [
            'label' => 'Pendidikan terakhir',
            'pilihan' => ['sd' => 'SD/sederajat', 'smp' => 'SMP/sederajat', 'sma' => 'SMA/SMK/sederajat', 'diploma' => 'D1–D3', 's1' => 'D4/S1', 'pascasarjana' => 'S2/S3'],
        ],
        'occupation' => [
            'label' => 'Pekerjaan',
            'pilihan' => [
                'pns' => 'PNS/TNI/Polri',
                'swasta' => 'Pegawai swasta',
                'wiraswasta' => 'Wiraswasta/usahawan',
                'petani' => 'Petani/pekebun/peternak',
                'nelayan' => 'Nelayan',
                'pelajar' => 'Pelajar/mahasiswa',
                'rumah-tangga' => 'Mengurus rumah tangga',
                'lainnya' => 'Lainnya',
            ],
        ],
    ];

    /** Kategori mutu pedoman SKM: [batas bawah indeks, huruf, keterangan]. */
    private const GRADES = [
        [88.31, 'A', 'Sangat baik'],
        [76.61, 'B', 'Baik'],
        [65.00, 'C', 'Kurang baik'],
        [25.00, 'D', 'Tidak baik'],
    ];

    /**
     * Indeks ringkas 25–100: rata-rata jawaban aspek (1–4) dikali 25.
     *
     * @param  array<string, int|string>  $answers
     */
    public static function index(array $answers): ?float
    {
        $values = array_map('intval', array_values(array_intersect_key($answers, self::ASPECTS)));

        return $values === [] ? null : round(array_sum($values) / count($values) * 25, 2);
    }

    /** @return array{huruf: string, mutu: string}|null */
    public static function grade(?float $index): ?array
    {
        if ($index === null) {
            return null;
        }

        foreach (self::GRADES as [$min, $letter, $label]) {
            if ($index >= $min) {
                return ['huruf' => $letter, 'mutu' => $label];
            }
        }

        return ['huruf' => 'D', 'mutu' => 'Tidak baik'];
    }

    /** Definisi untuk halaman survei (Inertia). @return array<string, mixed> */
    public static function forPage(): array
    {
        $choices = fn (array $labels) => array_map(fn (string $label, int $i) => ['value' => $i + 1, 'label' => $label], $labels, array_keys($labels));
        $keyed = fn (array $labels) => array_map(fn (string $value, string $label) => ['value' => $value, 'label' => $label], array_keys($labels), $labels);

        return [
            'aspek' => array_map(
                fn (string $key, array $q) => ['key' => $key, 'aspek' => $q['aspek'], 'pertanyaan' => $q['pertanyaan'], 'pilihan' => $choices($q['pilihan'])],
                array_keys(self::ASPECTS),
                self::ASPECTS,
            ),
            'keseluruhan' => ['pertanyaan' => self::OVERALL['pertanyaan'], 'pilihan' => $choices(self::OVERALL['pilihan'])],
            'teratasi' => ['pertanyaan' => self::RESOLVED['pertanyaan'], 'pilihan' => $keyed(self::RESOLVED['pilihan'])],
            'kembali' => ['pertanyaan' => self::REUSE['pertanyaan'], 'pilihan' => $choices(self::REUSE['pilihan'])],
            'terbuka' => array_map(fn (string $key, string $q) => ['key' => $key, 'pertanyaan' => $q], array_keys(self::OPEN), self::OPEN),
            'profil' => array_map(
                fn (string $key, array $p) => ['key' => $key, 'label' => $p['label'], 'pilihan' => $keyed($p['pilihan'])],
                array_keys(self::PROFILE),
                self::PROFILE,
            ),
        ];
    }

    /** Label jawaban survei untuk detail tiket admin. @return array<string, mixed> */
    public static function describe(Survey $survey): array
    {
        if ($survey->version < self::VERSION) {
            return ['versi' => 1, 'rating' => $survey->rating, 'komentar' => $survey->comment, 'dikirim' => $survey->created_at?->toIso8601String()];
        }

        $answers = $survey->answers ?? [];
        $label = fn (array $labels, ?int $value) => $value !== null ? ($labels[$value - 1] ?? null) : null;

        return [
            'versi' => self::VERSION,
            'indeks' => $survey->skm_index !== null ? (float) $survey->skm_index : null,
            'mutu' => self::grade($survey->skm_index !== null ? (float) $survey->skm_index : null),
            'aspek' => array_map(
                fn (string $key, array $q) => ['aspek' => $q['aspek'], 'nilai' => $answers[$key] ?? null, 'jawaban' => $label($q['pilihan'], $answers[$key] ?? null)],
                array_keys(self::ASPECTS),
                self::ASPECTS,
            ),
            'keseluruhan' => ['nilai' => $survey->overall, 'jawaban' => $label(self::OVERALL['pilihan'], $survey->overall)],
            'teratasi' => self::RESOLVED['pilihan'][$survey->resolved] ?? null,
            'kembali' => ['nilai' => $survey->reuse, 'jawaban' => $label(self::REUSE['pilihan'], $survey->reuse)],
            'baik' => $survey->good_feedback,
            'perbaikan' => $survey->improve_feedback,
            'profil' => array_filter([
                self::PROFILE['age_group']['label'] => self::PROFILE['age_group']['pilihan'][$survey->age_group] ?? null,
                self::PROFILE['education']['label'] => self::PROFILE['education']['pilihan'][$survey->education] ?? null,
                self::PROFILE['occupation']['label'] => self::PROFILE['occupation']['pilihan'][$survey->occupation] ?? null,
            ]),
            'dikirim' => $survey->created_at?->toIso8601String(),
        ];
    }
}
