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
 *
 * Gerbang kualitas (PRD-AI FR-AI-07): beri ambang, dan perintah keluar dengan
 * kode gagal bila tidak terpenuhi, mis.
 *   sigap:uji-asisten --min-pencarian=95 --min-klasifikasi=85 --maks-tanpa-sumber=0 --maks-p95=12
 * Tanpa ambang, perintah hanya melaporkan (selalu sukses) seperti sebelumnya.
 */
class UjiAsistenCommand extends Command
{
    protected $signature = 'sigap:uji-asisten
        {--hanya-pencarian : Lewati model; nilai pencarian saja}
        {--rinci : Tampilkan jawaban model}
        {--min-pencarian= : Ambang minimum % pencarian tepat}
        {--min-klasifikasi= : Ambang minimum % klasifikasi tepat (panggilan gagal dihitung salah)}
        {--maks-tanpa-sumber= : Batas jumlah jawaban informasi tanpa sumber}
        {--maks-p95= : Batas waktu jawab P95 dalam detik}';

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
                    $type = $result['jenis'].($result['perlu_petugas'] ? '+petugas' : '').($result['kompleks'] ? '+kompleks' : '');
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
                    $score['jenis'][1]++;
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
                $this->line('Waktu jawab P95     : '.round($this->p95($durations), 1).' detik');
            }
        }

        return $this->gate($score, $durations, $withModel);
    }

    /**
     * Bandingkan hasil dengan ambang yang diberikan. Ambang untuk model
     * diabaikan pada `--hanya-pencarian` (dicatat di keluaran).
     *
     * @param  array{cari: array{int, int}, jenis: array{int, int}, tebak: int, gagal: int}  $score
     * @param  list<float>  $durations
     */
    private function gate(array $score, array $durations, bool $withModel): int
    {
        $failures = [];
        $checked = 0;
        $percent = fn (array $pair) => $pair[1] === 0 ? 0.0 : $pair[0] / $pair[1] * 100;

        if (($min = $this->threshold('min-pencarian')) !== null) {
            $checked++;
            if ($percent($score['cari']) < $min) {
                $failures[] = sprintf('pencarian %.0f%% < %s%%', $percent($score['cari']), $min);
            }
        }

        $modelOptions = ['min-klasifikasi', 'maks-tanpa-sumber', 'maks-p95'];
        if (! $withModel) {
            $ignored = array_filter($modelOptions, fn (string $o) => $this->option($o) !== null);
            if ($ignored !== []) {
                $this->warn('Ambang model diabaikan pada --hanya-pencarian: --'.implode(', --', $ignored));
            }
        } else {
            if (($min = $this->threshold('min-klasifikasi')) !== null) {
                $checked++;
                if ($percent($score['jenis']) < $min) {
                    $failures[] = sprintf('klasifikasi %.0f%% < %s%%', $percent($score['jenis']), $min);
                }
            }
            if (($max = $this->threshold('maks-tanpa-sumber')) !== null) {
                $checked++;
                if ($score['tebak'] > $max) {
                    $failures[] = "jawaban tanpa sumber {$score['tebak']} > {$max}";
                }
            }
            if (($max = $this->threshold('maks-p95')) !== null) {
                $checked++;
                $p95 = $durations === [] ? INF : $this->p95($durations);
                if ($p95 > $max) {
                    $failures[] = $durations === [] ? 'P95 tidak terukur (semua panggilan gagal)' : sprintf('P95 %.1f dtk > %s dtk', $p95, $max);
                }
            }
        }

        if ($checked === 0) {
            return self::SUCCESS;
        }

        $this->newLine();
        if ($failures !== []) {
            $this->error('Gerbang kualitas GAGAL: '.implode('; ', $failures));

            return self::FAILURE;
        }
        $this->info('Gerbang kualitas LULUS.');

        return self::SUCCESS;
    }

    private function threshold(string $option): ?float
    {
        $value = $this->option($option);
        if ($value === null || $value === '') {
            return null;
        }
        if (! is_numeric($value)) {
            throw new \InvalidArgumentException("--{$option} harus berupa angka.");
        }

        return (float) $value;
    }

    /** @param  list<float>  $sorted  sudah terurut naik */
    private function p95(array $sorted): float
    {
        return $sorted[max(0, (int) ceil(count($sorted) * 0.95) - 1)];
    }
}
