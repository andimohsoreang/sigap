<?php

namespace App\Services\Ai;

use Illuminate\Support\Str;

/**
 * Model tiruan untuk pengembangan lokal & pengujian (tanpa API key).
 *
 * Perilakunya sengaja sederhana dan dapat diramalkan:
 * - JAWAB: kata kunci aduan/pribadi/petugas menentukan jenis; bila ada
 *   sumber, jawaban diambil dari isi sumber pertama.
 * - USUL_ARTIKEL: setiap halaman menjadi satu usulan.
 */
class FakeLlmClient implements LlmClient
{
    private const COMPLAINT_WORDS = ['rusak', 'mengadu', 'aduan', 'lapor', 'melapor', 'keluhan', 'tidak berfungsi', 'mati', 'banjir', 'longsor', 'pungli'];

    private const PERSONAL_WORDS = ['nama saya', 'saya belum', 'saya tidak', 'bantuan saya', 'sertifikat saya', 'lahan saya', 'hak saya', 'saya berhak'];

    private const STAFF_WORDS = ['petugas', 'operator', 'admin', 'manusia', 'orang asli'];

    public function complete(array $messages, bool $json = false): string
    {
        $system = (string) (collect($messages)->firstWhere('role', 'system')['content'] ?? '');
        $input = json_decode((string) (collect($messages)->last()['content'] ?? ''), true) ?: [];

        return match (true) {
            str_starts_with($system, Prompts::TASK_ANSWER) => json_encode($this->answer($input)),
            str_starts_with($system, Prompts::TASK_PROPOSE) => json_encode($this->propose($input)),
            default => 'OK',
        };
    }

    /** @return array<string, mixed> */
    private function answer(array $input): array
    {
        $question = Str::lower((string) ($input['pertanyaan'] ?? ''));
        $sources = $input['sumber'] ?? [];

        $needsStaff = $this->mentions($question, self::STAFF_WORDS);
        $type = match (true) {
            $needsStaff => 'informasi',
            $this->mentions($question, self::COMPLAINT_WORDS) => 'aduan',
            $this->mentions($question, self::PERSONAL_WORDS) => 'pribadi',
            default => 'informasi',
        };

        if ($type !== 'informasi' || $needsStaff || $sources === []) {
            return [
                'jenis' => $type,
                'jawaban' => '',
                'sumber' => [],
                'perlu_petugas' => $needsStaff,
                'ringkasan' => $type === 'informasi' && ! $needsStaff ? '' : 'Warga menyampaikan: '.Str::limit((string) $input['pertanyaan'], 200),
            ];
        }

        $first = $sources[0];

        return [
            'jenis' => 'informasi',
            'jawaban' => Str::limit(trim((string) $first['isi']), 400).' ['.$first['no'].']',
            'sumber' => [$first['no']],
            'perlu_petugas' => false,
            'ringkasan' => '',
        ];
    }

    /** Cocokkan kata/frasa utuh ("aduan" tidak cocok di dalam "pengaduan"). */
    private function mentions(string $text, array $phrases): bool
    {
        foreach ($phrases as $phrase) {
            if (preg_match('/(?<!\p{L})'.preg_quote($phrase, '/').'(?!\p{L})/u', $text) === 1) {
                return true;
            }
        }

        return false;
    }

    /** @return array<string, mixed> */
    private function propose(array $input): array
    {
        $proposals = [];

        foreach ($input['halaman'] ?? [] as $page) {
            $text = trim(preg_replace('/\s+/', ' ', (string) ($page['teks'] ?? '')));
            if (mb_strlen($text) < 40) {
                continue;
            }

            $first = Str::before($text, '.');
            $proposals[] = [
                'judul' => 'Apa yang diatur tentang '.Str::lower(Str::limit($first, 60, '')).'?',
                'jawaban' => Str::limit($text, 400),
                'kategori' => 'Program',
                'halaman' => (int) ($page['no'] ?? 1),
                'cek_angka' => (bool) preg_match('/\d/', $text),
            ];

            if (count($proposals) >= 8) {
                break;
            }
        }

        return ['usulan' => $proposals];
    }
}
