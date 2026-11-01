<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\AiQualityRun;
use App\Models\KnowledgeArticle;
use App\Models\KnowledgePassage;
use App\Models\User;
use App\Modules\Ai\AiException;
use App\Modules\Assistant\Consultation;
use App\Modules\Assistant\ResponsePolicy;
use App\Modules\Knowledge\Retrieval\KnowledgeRetriever;
use App\Services\NotificationService;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Uji kualitas Asisten Contact Center terhadap paket uji database/data/uji-asisten.php
 * memakai sumber yang SAMA dengan TARA — artikel terbit + kutipan Sumber Resmi
 * (KnowledgeRetriever::sources) — dan model yang sedang dikonfigurasi
 * (AI_DRIVER / AI_MODEL). Tidak menyimpan percakapan apa pun.
 *
 * Yang dinilai per pertanyaan:
 * - Pencarian : frasa fakta `harus_memuat` ada di salah satu dari 3 sumber
 *               teratas — artikel ATAU kutipan Sumber Resmi (atau tidak ada
 *               sumber sama sekali untuk pertanyaan di luar layanan).
 *               Metrik "artikel saja" tetap menilai judul artikel `artikel`
 *               pada pencarian artikel terbit.
 * - Jenis     : klasifikasi model sama dengan harapan.
 * - Sumber    : jawaban informasi selalu menyebut sumber yang benar-benar
 *               dikirim (jawaban tanpa sumber = tebakan, ditolak sistem).
 * - Portal    : kasus bertanda `portal` wajib dirujuk ke portal itu.
 * - Angka     : jawaban yang ditolak pengaman angka (FR-AI-12) dilaporkan per
 *               kasus; jawaban benar tidak boleh ditolak.
 * - Konflik   : kasus bertanda `konflik` mengikuti label dasar hukum sumber
 *               (PRD-AI FR-AI-11): aturan yang berlaku + aturan lama disebut,
 *               atau diteruskan ke petugas bila label belum memutuskan.
 *
 * Jalankan sebelum mengganti model atau setelah menambah banyak artikel.
 *
 * Gerbang kualitas (PRD-AI FR-AI-07): beri ambang, dan perintah keluar dengan
 * kode gagal bila tidak terpenuhi, mis.
 *   sigap:uji-asisten --min-pencarian=95 --min-klasifikasi=85 --maks-tanpa-sumber=0 --maks-p95=12
 * Tanpa ambang, perintah hanya melaporkan (selalu sukses) seperti sebelumnya.
 *
 * `--simpan` menyimpan ringkasan angka ke `ai_quality_runs` (halaman Kesehatan
 * AI); `--laporkan` mengirim ringkasan ke Super Admin — dipakai uji terjadwal
 * mingguan (FR-AI-07/08). Pertanyaan & jawaban tidak pernah disimpan.
 */
class UjiAsistenCommand extends Command
{
    protected $signature = 'sigap:uji-asisten
        {--hanya-pencarian : Lewati model; nilai pencarian saja}
        {--rinci : Tampilkan jawaban model}
        {--min-pencarian= : Ambang minimum % pencarian tepat}
        {--min-klasifikasi= : Ambang minimum % klasifikasi tepat (panggilan gagal dihitung salah)}
        {--maks-tanpa-sumber= : Batas jumlah jawaban informasi tanpa sumber}
        {--maks-p95= : Batas waktu jawab P95 dalam detik}
        {--simpan : Simpan ringkasan angka ke riwayat Kesehatan AI}
        {--laporkan : Kirim ringkasan ke Super Admin}';

    protected $description = 'Uji pencarian dan jawaban Asisten Contact Center dengan paket pertanyaan warga';

    /** @var list<string> ambang yang tidak terpenuhi pada gate() terakhir */
    private array $failures = [];

    /** Jumlah ambang yang diperiksa pada gate() terakhir. */
    private int $checked = 0;

    public function handle(KnowledgeRetriever $retriever, Consultation $consultation, ResponsePolicy $policy): int
    {
        $startedAt = microtime(true);
        $cases = require database_path('data/uji-asisten.php');
        $withModel = ! $this->option('hanya-pencarian');

        if ($withModel) {
            $this->line('Model: '.config('services.ai.driver').' · '.config('services.ai.model'));
        }

        $rows = [];
        $score = ['cari' => [0, 0], 'artikel' => [0, 0], 'jenis' => [0, 0], 'konflik' => [0, 0], 'portal' => [0, 0], 'tebak' => 0, 'gagal' => 0, 'angka' => []];
        $durations = [];

        foreach ($cases as $i => $case) {
            // Sama seperti TARA: artikel terbit + kutipan Sumber Resmi (Assistant::respond).
            $sources = $retriever->sources($case['tanya']);
            $articles = $sources->filter(fn ($s) => $s instanceof KnowledgeArticle)->values();
            $titles = $sources->map(fn ($s) => $s instanceof KnowledgePassage ? $s->displayTitle() : $s->title)->all();

            $found = null;
            if ($case['harus_memuat'] !== false) {
                $found = self::containsFact($case['harus_memuat'], $sources->take(3));
                $score['cari'][0] += (int) $found;
                $score['cari'][1]++;
            }
            $articleFound = null;
            if ($case['artikel'] !== false) {
                // Informasi: pencarian artikel terbit saja (cara lama, tanpa Sumber Resmi).
                $articleFound = $this->hasArticleTitle($case['artikel'], $articles);
                $score['artikel'][0] += (int) $articleFound;
                $score['artikel'][1]++;
            }

            $type = '';
            $typeOk = null;
            $answer = '';
            if ($withModel) {
                $started = microtime(true);
                try {
                    $result = $consultation->consult($case['tanya'], [], $sources);
                    $durations[] = microtime(true) - $started;
                    $type = $result['jenis'].($result['perlu_petugas'] ? '+petugas' : '').($result['kompleks'] ? '+kompleks' : '');
                    $typeOk = $result['jenis'] === $case['jenis'];
                    $score['jenis'][0] += (int) $typeOk;
                    $score['jenis'][1]++;

                    $validSources = array_filter($result['sumber'], fn (int $no) => $no >= 1 && $no <= $sources->count());
                    if ($result['jenis'] === 'informasi' && $result['jawaban'] !== '' && $validSources === []) {
                        $score['tebak']++;
                        $type .= ' ⚠ tanpa sumber';
                    }
                    $answer = $result['jawaban'] !== '' ? $result['jawaban'] : $result['ringkasan'];
                    if ($result['angka_tanpa_dasar'] !== []) {
                        $score['angka'][] = '#'.($i + 1).' ('.implode(', ', $result['angka_tanpa_dasar']).')';
                        $type .= ' ⛔ angka tanpa dasar: '.implode(', ', $result['angka_tanpa_dasar']);
                    }

                    if (isset($case['portal'])) {
                        $portalOk = $result['portal'] === $case['portal'];
                        $score['portal'][0] += (int) $portalOk;
                        $score['portal'][1]++;
                        $type .= ' · portal: '.($result['portal'] ?? '—').($portalOk ? ' ✓' : ' ✗ (harap '.$case['portal'].')');
                    }

                    if (isset($case['konflik'])) {
                        [$ok, $note] = $this->conflictHandled($case['konflik'], $result, $sources, $policy);
                        if ($ok !== null) {
                            $score['konflik'][0] += (int) $ok;
                            $score['konflik'][1]++;
                        }
                        $type .= " · konflik: {$note}".match ($ok) {
                            true => ' ✓',
                            false => ' ✗',
                            null => '',
                        };
                    }
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
                $articleFound === null ? '·' : ($articleFound ? '✓' : '✗'),
                $withModel ? $case['jenis'].' → '.$type.($typeOk ? ' ✓' : ' ✗') : null,
                $withModel && $this->option('rinci') ? Str::limit(str_replace("\n", ' ', $answer), 80) : null,
            ], fn ($v) => $v !== null));
        }

        $headers = array_values(array_filter([
            '#', 'Pertanyaan', 'Sumber teratas', 'Cari', 'Artikel',
            $withModel ? 'Jenis (harap → dapat)' : null,
            $withModel && $this->option('rinci') ? 'Jawaban' : null,
        ]));
        $this->table($headers, $rows);

        $pct = fn (array $pair) => $pair[1] === 0 ? '—' : round($pair[0] / $pair[1] * 100).'% ('.$pair[0].'/'.$pair[1].')';
        $this->newLine();
        $this->line('Pencarian tepat     : '.$pct($score['cari']).'  (fakta ada di 3 sumber teratas TARA: artikel + Sumber Resmi)');
        $this->line('  artikel saja      : '.$pct($score['artikel']).'  (judul artikel di pencarian artikel terbit, tanpa Sumber Resmi)');
        if ($withModel) {
            $this->line('Klasifikasi tepat   : '.$pct($score['jenis']));
            $this->line('Portal tepat        : '.$pct($score['portal']).'  (kasus bertanda portal)');
            $this->line('Sumber berbeda tepat: '.$pct($score['konflik']).'  (aturan berlaku + lama, atau ke petugas bila label belum memutuskan)');
            $this->line('Jawaban tanpa sumber: '.$score['tebak'].' (ditolak sistem, warga melihat "belum menemukan informasi resmi")');
            $this->line('Panggilan gagal     : '.$score['gagal']);
            $this->line('Ditolak pengaman angka: '.count($score['angka']).($score['angka'] === [] ? '' : ' — '.implode('; ', $score['angka'])));
            if ($durations !== []) {
                sort($durations);
                $this->line('Waktu jawab median  : '.round($durations[intdiv(count($durations), 2)], 1).' detik');
                $this->line('Waktu jawab P95     : '.round($this->p95($durations), 1).' detik');
            }
        }

        $code = $this->gate($score, $durations, $withModel);

        if ($this->option('simpan') || $this->option('laporkan')) {
            $run = $this->summary($score, $durations, $withModel, $startedAt);
            if ($this->option('simpan')) {
                $run->save();
            }
            if ($this->option('laporkan')) {
                $this->report($run);
            }
        }

        return $code;
    }

    /**
     * Ringkasan angka untuk riwayat Kesehatan AI (tanpa teks pertanyaan/jawaban).
     *
     * @param  array{cari: array{int, int}, jenis: array{int, int}, tebak: int, gagal: int, angka: list<string>}  $score
     * @param  list<float>  $durations  sudah terurut naik
     */
    private function summary(array $score, array $durations, bool $withModel, float $startedAt): AiQualityRun
    {
        return new AiQualityRun([
            'model' => $withModel ? Str::limit(config('services.ai.driver').' · '.config('services.ai.model'), 120, '') : null,
            'with_model' => $withModel,
            'passed' => $this->checked === 0 ? null : $this->failures === [],
            'retrieval_hits' => $score['cari'][0],
            'retrieval_total' => $score['cari'][1],
            'classification_hits' => $score['jenis'][0],
            'classification_total' => $score['jenis'][1],
            'unsourced' => $score['tebak'],
            'failed_calls' => $score['gagal'],
            'number_rejections' => count($score['angka']),
            'median_ms' => $durations === [] ? null : (int) round($durations[intdiv(count($durations), 2)] * 1000),
            'p95_ms' => $durations === [] ? null : (int) round($this->p95($durations) * 1000),
            'failures' => $this->failures === [] ? null : Str::limit(implode('; ', $this->failures), 255, ''),
            'duration_s' => (int) round(microtime(true) - $startedAt),
        ]);
    }

    /** Kirim ringkasan uji ke Super Admin aktif (lonceng + surel). */
    private function report(AiQualityRun $run): void
    {
        $verdict = match ($run->passed) {
            true => 'LULUS',
            false => 'GAGAL',
            null => 'selesai',
        };
        $pct = fn (int $hits, int $total) => $total === 0 ? '—' : round($hits / $total * 100).'% ('.$hits.'/'.$total.')';
        $seconds = fn (?int $ms) => $ms === null ? '—' : number_format($ms / 1000, 1, ',', '.').' dtk';

        $meta = ['Pencarian tepat' => $pct($run->retrieval_hits, $run->retrieval_total)];
        if ($run->with_model) {
            $meta += [
                'Klasifikasi tepat' => $pct($run->classification_hits, $run->classification_total),
                'Jawaban tanpa sumber' => (string) $run->unsourced,
                'Panggilan gagal' => (string) $run->failed_calls,
                'Ditolak pengaman angka' => (string) $run->number_rejections,
                'Waktu jawab P95' => $seconds($run->p95_ms),
                'Model' => (string) $run->model,
            ];
        }

        $body = "Uji kualitas TARA {$verdict}: pencarian {$meta['Pencarian tepat']}"
            .($run->with_model ? ", klasifikasi {$meta['Klasifikasi tepat']}, {$run->unsourced} jawaban tanpa sumber, P95 {$meta['Waktu jawab P95']}." : '.')
            .($run->failures ? " Tidak memenuhi ambang: {$run->failures}." : '');

        app(NotificationService::class)->notify([
            'event' => 'ai_uji',
            'subject' => "[Contact Center] Uji kualitas TARA: {$verdict}",
            'title' => "Uji kualitas TARA: {$verdict}",
            'body' => $body,
            'message' => $body,
            'cta_url' => '/admin/kesehatan-ai',
            'cta_label' => 'Buka Kesehatan AI',
            'meta' => $meta,
        ], User::query()->where('is_active', true)->where('role', UserRole::SuperAdmin->value)->orderBy('id')->get());
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
        $this->failures = [];
        $this->checked = 0;
        $percent = fn (array $pair) => $pair[1] === 0 ? 0.0 : $pair[0] / $pair[1] * 100;

        if (($min = $this->threshold('min-pencarian')) !== null) {
            $this->checked++;
            if ($percent($score['cari']) < $min) {
                $this->failures[] = sprintf('pencarian %.0f%% < %s%%', $percent($score['cari']), $min);
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
                $this->checked++;
                if ($percent($score['jenis']) < $min) {
                    $this->failures[] = sprintf('klasifikasi %.0f%% < %s%%', $percent($score['jenis']), $min);
                }
            }
            if (($max = $this->threshold('maks-tanpa-sumber')) !== null) {
                $this->checked++;
                if ($score['tebak'] > $max) {
                    $this->failures[] = "jawaban tanpa sumber {$score['tebak']} > {$max}";
                }
            }
            if (($max = $this->threshold('maks-p95')) !== null) {
                $this->checked++;
                $p95 = $durations === [] ? INF : $this->p95($durations);
                if ($p95 > $max) {
                    $this->failures[] = $durations === [] ? 'P95 tidak terukur (semua panggilan gagal)' : sprintf('P95 %.1f dtk > %s dtk', $p95, $max);
                }
            }
        }

        if ($this->checked === 0) {
            return self::SUCCESS;
        }

        $this->newLine();
        if ($this->failures !== []) {
            $this->error('Gerbang kualitas GAGAL: '.implode('; ', $this->failures));

            return self::FAILURE;
        }
        $this->info('Gerbang kualitas LULUS.');

        return self::SUCCESS;
    }

    /**
     * Apakah salah satu sumber memuat frasa fakta `harus_memuat`? Dicari di
     * judul & isi artikel atau kutipan Sumber Resmi, tanpa membedakan huruf
     * besar/kecil, spasi, dan jenis tanda hubung ("19 - 53" = "19–53"). `null` = pertanyaan di luar layanan (tidak boleh
     * ada sumber). Dipakai juga oleh RetrievalQualityTest.
     *
     * @param  Collection<int, KnowledgeArticle|KnowledgePassage>  $sources
     */
    public static function containsFact(?string $fact, Collection $sources): bool
    {
        if ($fact === null) {
            return $sources->isEmpty();
        }

        $normalize = fn (string $text) => preg_replace(['/\s*[-‐‑‒–—]\s*/u', '/\s+/u'], ['-', ' '], mb_strtolower($text));
        $needle = $normalize($fact);

        return $sources->contains(fn ($s) => str_contains($normalize(
            ($s instanceof KnowledgePassage ? $s->displayTitle() : $s->title).' '.$s->body
        ), $needle));
    }

    /**
     * Kasus sumber bertentangan (PRD-AI FR-AI-11). Sumber yang memuat salah
     * satu angka menentukan apakah label dasar hukum memutuskan.
     *
     * @param  array{berlaku: string, lama: string}  $conflict
     * @param  array<string, mixed>  $result  hasil Consultation::consult()
     * @param  Collection<int, KnowledgeArticle|KnowledgePassage>  $sources
     * @return array{0: bool|null, 1: string} null = tidak dinilai (sumber lama tidak ikut terambil)
     */
    private function conflictHandled(array $conflict, array $result, Collection $sources, ResponsePolicy $policy): array
    {
        $number = fn (string $n) => '/(?<!\d)'.preg_quote($n, '/').'(?!\d)/u';
        $relevant = $sources->filter(fn ($s) => preg_match($number($conflict['berlaku']), $s->body) === 1 || preg_match($number($conflict['lama']), $s->body) === 1);
        if (! $relevant->contains(fn ($s) => preg_match($number($conflict['lama']), $s->body) === 1)) {
            return [null, 'sumber lama tidak terambil'];
        }

        if (ResponsePolicy::basisDecides($relevant)) {
            $ok = preg_match($number($conflict['berlaku']), $result['jawaban']) === 1
                && preg_match($number($conflict['lama']), $result['jawaban']) === 1
                && preg_match('/sudah diganti|aturan lama/iu', $result['jawaban']) === 1
                && ! $result['perlu_petugas'];

            return [$ok, 'label memutuskan'];
        }

        return [$policy->unresolvedConflict($result, ResponsePolicy::cited($result, $sources)), 'label belum memutuskan → petugas'];
    }

    /**
     * Metrik "artikel saja": judul artikel harapan ada di hasil pencarian
     * artikel terbit; `null` = tidak boleh ada artikel.
     *
     * @param  Collection<int, KnowledgeArticle>  $articles
     */
    private function hasArticleTitle(?string $expected, Collection $articles): bool
    {
        if ($expected === null) {
            return $articles->isEmpty();
        }

        return $articles->contains(fn (KnowledgeArticle $a) => str_contains(mb_strtolower($a->title), mb_strtolower($expected)));
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
