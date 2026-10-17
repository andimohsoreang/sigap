<?php

namespace App\Console\Commands;

use App\Services\Ai\AiException;
use App\Services\Ai\AssistantService;
use App\Services\Knowledge\KnowledgeRetriever;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Uji kualitas Asisten SIGAP terhadap paket uji database/data/uji-asisten.php
 * memakai Basis Pengetahuan TERBIT dan model yang sedang dikonfigurasi
 * (AI_DRIVER / AI_MODEL). Tidak menyimpan percakapan apa pun.
 *
 * Yang dinilai per pertanyaan:
 * - Pencarian : artikel yang diharapkan masuk 3 besar (atau tidak ada artikel
 *               untuk pertanyaan di luar layanan).
 * - Jenis     : klasifikasi model sama dengan harapan.
 * - Sumber    : jawaban informasi selalu menyebut sumber yang benar-benar
 *               dikirim (jawaban tanpa sumber = tebakan, ditolak sistem).
 *
 * Jalankan sebelum mengganti model atau setelah menambah banyak artikel.
 */
class UjiAsistenCommand extends Command
{
    protected $signature = 'sigap:uji-asisten
        {--hanya-pencarian : Lewati model; nilai pencarian saja}
        {--rinci : Tampilkan jawaban model}';

    protected $description = 'Uji pencarian dan jawaban Asisten SIGAP dengan paket pertanyaan warga';

    public function handle(KnowledgeRetriever $retriever, AssistantService $assistant): int
    {
        $cases = require database_path('data/uji-asisten.php');
        $withModel = ! $this->option('hanya-pencarian');

        if ($withModel) {
            $this->line('Model: '.config('services.ai.driver').' · '.config('services.ai.model'));
        }

        $rows = [];
        $score = ['cari' => [0, 0], 'jenis' => [0, 0], 'tebak' => 0, 'gagal' => 0];
        $durations = [];

        foreach ($cases as $i => $case) {
            $articles = $retriever->search($case['tanya']);
            $titles = $articles->pluck('title')->all();

            $found = null;
            if ($case['artikel'] !== false) {
                $found = $case['artikel'] === null
                    ? $titles === []
                    : collect($titles)->contains(fn (string $t) => str_contains(mb_strtolower($t), mb_strtolower($case['artikel'])));
                $score['cari'][0] += (int) $found;
                $score['cari'][1]++;
            }

            $type = '';
            $typeOk = null;
            $answer = '';
            if ($withModel) {
                $started = microtime(true);
                try {
                    $result = $assistant->consult($case['tanya'], [], $articles);
                    $durations[] = microtime(true) - $started;
                    $type = $result['jenis'].($result['perlu_petugas'] ? '+petugas' : '');
                    $typeOk = $result['jenis'] === $case['jenis'];
                    $score['jenis'][0] += (int) $typeOk;
                    $score['jenis'][1]++;

                    $validSources = array_filter($result['sumber'], fn (int $no) => $no >= 1 && $no <= $articles->count());
                    if ($result['jenis'] === 'informasi' && $result['jawaban'] !== '' && $validSources === []) {
                        $score['tebak']++;
                        $type .= ' ⚠ tanpa sumber';
                    }
                    $answer = $result['jawaban'] !== '' ? $result['jawaban'] : $result['ringkasan'];
                } catch (AiException $e) {
                    $score['gagal']++;
                    $type = 'GAGAL: '.Str::limit($e->getMessage(), 40);
                    $typeOk = false;
                }
            }

            $rows[] = array_values(array_filter([
                $i + 1,
                Str::limit($case['tanya'], 48),
                $titles === [] ? '—' : Str::limit($titles[0], 44),
                $found === null ? '·' : ($found ? '✓' : '✗'),
                $withModel ? $case['jenis'].' → '.$type.($typeOk ? ' ✓' : ' ✗') : null,
                $withModel && $this->option('rinci') ? Str::limit(str_replace("\n", ' ', $answer), 80) : null,
            ], fn ($v) => $v !== null));
        }

        $headers = array_values(array_filter([
            '#', 'Pertanyaan', 'Sumber teratas', 'Cari',
            $withModel ? 'Jenis (harap → dapat)' : null,
            $withModel && $this->option('rinci') ? 'Jawaban' : null,
        ]));
        $this->table($headers, $rows);

        $pct = fn (array $pair) => $pair[1] === 0 ? '—' : round($pair[0] / $pair[1] * 100).'% ('.$pair[0].'/'.$pair[1].')';
        $this->newLine();
        $this->line('Pencarian tepat     : '.$pct($score['cari']));
        if ($withModel) {
            $this->line('Klasifikasi tepat   : '.$pct($score['jenis']));
            $this->line('Jawaban tanpa sumber: '.$score['tebak'].' (ditolak sistem, warga melihat "belum menemukan informasi resmi")');
            $this->line('Panggilan gagal     : '.$score['gagal']);
            if ($durations !== []) {
                sort($durations);
                $this->line('Waktu jawab median  : '.round($durations[intdiv(count($durations), 2)], 1).' detik');
            }
        }

        return self::SUCCESS;
    }
}
