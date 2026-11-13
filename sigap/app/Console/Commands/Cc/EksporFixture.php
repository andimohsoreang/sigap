<?php

namespace App\Console\Commands\Cc;

use App\Enums\TicketImpact;
use App\Enums\TicketPriority;
use App\Enums\TicketStatus;
use App\Enums\TicketVisibility;
use App\Models\Ticket;
use App\Services\SlaCalculator;
use App\Services\SurveyService;
use App\Services\TicketService;
use App\Support\SurveyQuestionnaire;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use RuntimeException;

/**
 * Rewrite Next.js (S0-C): ekspor vektor uji dari kelas Laravel ASLI ke
 * `parity/fixtures/*.json`. Hanya alat bantu; tidak mengubah fitur.
 *
 * Keluaran deterministik: tanpa acak di berkas, jam dibekukan, tanpa cap waktu
 * pembuatan. Survei dijalankan lewat SurveyService::submit pada SQLite
 * in-memory terpisah (database aplikasi tidak disentuh).
 */
class EksporFixture extends Command
{
    protected $signature = 'cc:ekspor-fixture {--dir= : Folder tujuan (bawaan: ../parity/fixtures)}';

    protected $description = 'Ekspor vektor uji SLA, status, nomor tiket, dan SKM ke parity/fixtures (rewrite Next.js)';

    private const COMMIT = 'laravel-baseline';

    public function handle(SlaCalculator $sla): int
    {
        $dir = $this->option('dir') ?: base_path('../parity/fixtures');
        File::ensureDirectoryExists($dir);

        $files = [
            'sla.json' => $this->sla($sla),
            'status-tiket.json' => $this->statuses(),
            'nomor-tiket.json' => $this->ticketNumbers(),
            'survei-skm.json' => $this->survey(),
        ];

        foreach ($files as $name => $data) {
            File::put($dir.'/'.$name, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n");
            $this->line("{$name}: ".count($data['kasus']).' kasus');
        }

        return self::SUCCESS;
    }

    /** @param list<string> $sources */
    private function header(array $sources, array $extra = []): array
    {
        return ['sumber' => $sources, 'commit' => self::COMMIT, 'perintah' => 'php artisan cc:ekspor-fixture', ...$extra];
    }

    private function sla(SlaCalculator $sla): array
    {
        $categoryDays = [null, -1, 0, 1, 2, 3, 5, 7, 10, 14, 20];
        // Lokal tanpa offset; ditafsirkan di zona waktu kasus.
        $starts = [
            '2026-11-09 09:00:00', // Senin
            '2026-11-11 14:30:00', // Rabu
            '2026-11-12 23:59:59', // Kamis menjelang tengah malam
            '2026-11-13 00:00:00', // Jumat tengah malam
            '2026-11-13 15:00:00', // Jumat sore
            '2026-11-13 23:30:00', // Jumat malam
            '2026-11-14 10:00:00', // Sabtu
            '2026-11-15 20:00:00', // Minggu
            '2026-01-30 16:00:00', // Jumat, akhir Januari
            '2026-02-27 13:00:00', // Jumat, akhir Februari (bukan kabisat)
            '2028-02-28 10:00:00', // Senin, kabisat
            '2026-04-30 11:00:00', // Kamis, akhir bulan
            '2026-12-31 08:00:00', // Kamis, akhir tahun
            '2027-12-31 17:00:00', // Jumat, akhir tahun
            '2028-12-30 09:00:00', // Sabtu, akhir tahun
        ];
        // Zona produksi belum dipastikan (docs/REWRITE-NEXTJS.md §1): ekspor keduanya.
        $zones = ['UTC', 'Asia/Jakarta'];

        $cases = [];
        foreach ($zones as $tz) {
            foreach ($starts as $start) {
                $from = CarbonImmutable::parse($start, $tz);
                foreach (TicketImpact::cases() as $impact) {
                    foreach ($categoryDays as $days) {
                        $cases[] = [
                            'zona' => $tz,
                            'mulai' => $from->toIso8601String(),
                            'hari_mulai' => $from->englishDayOfWeek,
                            'dampak' => $impact->value,
                            'sla_days_kategori' => $days,
                            'prioritas' => $sla->priorityFor($impact)->value,
                            'hari_kerja' => $sla->resolveDays($impact, $days),
                            'respons_paling_lambat' => $sla->respondAt($impact, $from)->toIso8601String(),
                            'tenggat_selesai' => $sla->dueAt($impact, $from, $days)->toIso8601String(),
                        ];
                    }
                }
            }
        }

        $due = CarbonImmutable::parse('2026-11-18 15:00:00', 'UTC');
        $before = $due->subSecond();
        $after = $due->addSecond();
        $status = [];
        foreach ([
            ['terbuka' => true, 'tenggat' => null, 'sekarang' => $after, 'selesai' => null],
            ['terbuka' => false, 'tenggat' => null, 'sekarang' => $after, 'selesai' => $before],
            ['terbuka' => true, 'tenggat' => $due, 'sekarang' => $before, 'selesai' => null],
            ['terbuka' => true, 'tenggat' => $due, 'sekarang' => $due, 'selesai' => null],
            ['terbuka' => true, 'tenggat' => $due, 'sekarang' => $after, 'selesai' => null],
            ['terbuka' => false, 'tenggat' => $due, 'sekarang' => $after, 'selesai' => null],
            ['terbuka' => false, 'tenggat' => $due, 'sekarang' => $after, 'selesai' => $before],
            ['terbuka' => false, 'tenggat' => $due, 'sekarang' => $after, 'selesai' => $due],
            ['terbuka' => false, 'tenggat' => $due, 'sekarang' => $before, 'selesai' => $after],
            ['terbuka' => true, 'tenggat' => $due, 'sekarang' => $after, 'selesai' => $before],
        ] as $c) {
            $status[] = [
                'terbuka' => $c['terbuka'],
                'tenggat' => $c['tenggat']?->toIso8601String(),
                'sekarang' => $c['sekarang']->toIso8601String(),
                'selesai_pada' => $c['selesai']?->toIso8601String(),
                'status' => $sla->status($c['terbuka'], $c['tenggat'], $c['sekarang'], $c['selesai']),
            ];
        }

        return [
            ...$this->header([SlaCalculator::class, TicketImpact::class, TicketPriority::class], [
                'zona_waktu_aplikasi' => config('app.timezone'),
                'catatan' => 'TicketService::create memanggil dueAt(dampak, Carbon::now(), kategori.sla_days) di zona_waktu_aplikasi; hari kerja = Senin–Jumat di zona waktu nilai mulai. Kasus diekspor untuk UTC dan Asia/Jakarta.',
            ]),
            'kasus' => $cases,
            'status' => $status,
        ];
    }

    private function statuses(): array
    {
        $cases = [];
        foreach (TicketStatus::cases() as $from) {
            foreach (TicketStatus::cases() as $to) {
                $cases[] = [
                    'dari' => $from->value,
                    'ke' => $to->value,
                    'boleh' => $from->canTransitionTo($to),
                    // TicketService::changeStatus: status sama = tanpa perubahan, bukan galat.
                    'sama' => $from === $to,
                ];
            }
        }

        return [
            ...$this->header([TicketStatus::class, TicketService::class.'::changeStatus']),
            'status' => array_map(fn (TicketStatus $s) => [
                'nilai' => $s->value,
                'label' => $s->label(),
                'terbuka' => $s->isOpen(),
                'transisi' => array_map(fn (TicketStatus $t) => $t->value, $s->allowedTransitions()),
            ], TicketStatus::cases()),
            'kasus' => $cases,
        ];
    }

    private function ticketNumbers(): array
    {
        $inputs = [
            'TKT-261113-ABCDEF', 'tkt-261113-abcdef', '  TKT-261113-23456Z  ', "\tTKT-261113-HJKMNP\n",
            'TKT-261113-ABCDE0', 'TKT-261113-ABCDEO', 'TKT-261113-ABCDE1', 'TKT-261113-ABCDEI', 'TKT-261113-ABCDEL',
            'TKT-261113-ABCDE', 'TKT-261113-ABCDEFG', 'TKT-26111-ABCDEF', 'TKT-2611133-ABCDEF', 'TKT261113-ABCDEF',
            'TKT_261113_ABCDEF', 'TKT-261113ABCDEF', 'TKT-261113-ABC DEF', 'XYZ-261113-ABCDEF', 'TKT--ABCDEF',
            'TKT-1', 'tkt-42', ' TKT-0000000001 ', 'TKT-1234567890', 'TKT-12345678901', 'TKT-', 'TKT-12a',
            'TKT-00', '', '   ', 'ABCDEF', '261113-ABCDEF', 'TKT-261113-ÀBCDEF',
        ];

        $cases = array_map(fn (string $in) => [
            'masukan' => $in,
            'normal' => Ticket::normalizeNo($in),
            'sah' => Ticket::isValidNo($in),
            'format_lama' => Ticket::isLegacyNo($in),
        ], $inputs);

        $ticket = new Ticket;
        $ticket->lookup_token = 'ABCD2345';
        $codes = array_map(fn (?string $code) => [
            'kode_tersimpan' => 'ABCD2345',
            'masukan' => $code,
            'cocok' => $ticket->matchesLookupToken($code),
        ], ['ABCD2345', 'abcd2345', ' AbCd2345 ', 'ABCD234', 'ABCD23456', '', null, 'ABCD2346']);

        // Prefiks tanggal nomor baru (WIB). Sufiks acak diperiksa terhadap pola, tidak diekspor.
        $tickets = app(TicketService::class);
        $prefixes = [];
        foreach (['2026-11-13T16:59:59Z', '2026-11-13T17:00:00Z', '2026-12-31T17:00:00Z', '2027-01-01T00:00:00+07:00'] as $instant) {
            Carbon::setTestNow(Carbon::parse($instant));
            $no = $tickets->nextTicketNo();
            Carbon::setTestNow();
            if (! Ticket::isValidNo($no) || Ticket::isLegacyNo($no)) {
                throw new RuntimeException("nextTicketNo menghasilkan nomor tidak sah: {$no}");
            }
            $prefixes[] = ['waktu' => $instant, 'prefiks' => substr($no, 0, 11), 'panjang' => strlen($no)];
        }

        return [
            ...$this->header([Ticket::class, TicketService::class.'::nextTicketNo', TicketService::class.'::findForPublicLookup']),
            'pola' => Ticket::NUMBER_PATTERN,
            'pola_format_lama' => Ticket::LEGACY_NUMBER_PATTERN,
            'alfabet' => Ticket::NUMBER_ALPHABET,
            'panjang_kode_akses' => Ticket::LOOKUP_TOKEN_LENGTH,
            'pola_rute_lacak' => '[A-Za-z0-9-]{1,32}',
            'catatan' => 'Pencarian publik: normal = strtoupper(trim(masukan)); nomor tidak sah → tidak dicari; format lama butuh kode akses bagi tamu (perbandingan constant-time, kode di-trim & huruf besar). PublicController memotong ?kode= ke 16 karakter setelah trim+upper.',
            'nomor_baru' => $prefixes,
            'kode_akses' => $codes,
            'kasus' => $cases,
        ];
    }

    private function survey(): array
    {
        $aspects = array_keys(SurveyQuestionnaire::ASPECTS);
        $fill = fn (array $values) => array_combine($aspects, $values);

        // Semua jumlah 9..36: nilai 1..4 dibagi rata, sisa ke aspek awal.
        $indexCases = [];
        for ($sum = 9; $sum <= 36; $sum++) {
            $values = array_fill(0, 9, intdiv($sum, 9));
            for ($i = 0; $i < $sum % 9; $i++) {
                $values[$i]++;
            }
            $indexCases[] = ['jawaban' => $fill($values)];
        }
        // Pembulatan & masukan tak lengkap (index() merata-rata aspek yang ada, kunci asing diabaikan).
        $indexCases[] = ['jawaban' => array_combine(array_slice($aspects, 0, 8), [1, 1, 1, 1, 1, 1, 1, 2])];
        $indexCases[] = ['jawaban' => array_combine(array_slice($aspects, 0, 8), [1, 1, 1, 1, 1, 1, 2, 2])];
        $indexCases[] = ['jawaban' => array_combine(array_slice($aspects, 0, 7), [1, 2, 3, 4, 1, 2, 4])];
        $indexCases[] = ['jawaban' => array_combine(array_slice($aspects, 0, 3), [4, 4, 3])];
        $indexCases[] = ['jawaban' => ['kemudahan' => '3', 'konfirmasi' => '4', 'lain' => 1]];
        $indexCases[] = ['jawaban' => ['lain' => 4]];
        $indexCases[] = ['jawaban' => []];

        $index = array_map(function (array $c) {
            $value = SurveyQuestionnaire::index($c['jawaban']);

            return [...$c, 'indeks' => $value, 'mutu' => SurveyQuestionnaire::grade($value)];
        }, $indexCases);

        $grades = array_map(fn (?float $v) => ['indeks' => $v, 'mutu' => SurveyQuestionnaire::grade($v)],
            [null, 100.0, 88.31, 88.3, 88.309, 76.61, 76.6, 65.0, 64.99, 25.0, 24.99, 0.0]);

        // Alasan tinjau ulang: lewat SurveyService::submit asli.
        $submits = [];
        $answerSets = ['semua_1' => array_fill(0, 9, 1), 'semua_4' => array_fill(0, 9, 4), 'campur' => [4, 3, 2, 1, 4, 3, 2, 1, 4]];
        $this->withScratchDatabase(function () use (&$submits, $answerSets, $fill) {
            $service = app(SurveyService::class);
            $n = 0;
            foreach ($answerSets as $setName => $values) {
                foreach (['penuh', 'sebagian', 'belum'] as $resolved) {
                    foreach ([null, false, true] as $review) {
                        foreach ([1, 2, 3, 4] as $overall) {
                            // Kombinasi jawaban aspek tidak memengaruhi alasan; 'campur' & 'semua_4' cukup untuk indeks.
                            if ($setName !== 'campur' && ($review !== null || $resolved !== 'penuh')) {
                                continue;
                            }
                            $data = ['jawaban' => $fill($values), 'keseluruhan' => $overall, 'teratasi' => $resolved, 'kembali' => 3];
                            if ($review !== null) {
                                $data['tinjau_ulang'] = $review;
                            }

                            DB::beginTransaction();
                            try {
                                $ticket = Ticket::query()->forceCreate([
                                    'ticket_no' => sprintf('TKT-%d', ++$n),
                                    'title' => 'Fixture',
                                    'description' => 'Fixture',
                                    'status' => TicketStatus::Selesai,
                                    'priority' => TicketPriority::Umum,
                                    'impact' => TicketImpact::Sedang,
                                    'visibility' => TicketVisibility::Publik,
                                    'is_internal' => false,
                                ]);
                                $survey = $service->submit($ticket, null, $data);
                                $ticket->refresh();
                                $submits[] = [
                                    'masukan' => $data,
                                    'skm_index_tersimpan' => $survey->fresh()->skm_index,
                                    'alasan_tinjau_ulang' => $ticket->review_reason,
                                    'ditandai_tinjau_ulang' => $ticket->review_requested_at !== null,
                                ];
                            } finally {
                                DB::rollBack();
                            }
                        }
                    }
                }
            }
        });

        return [
            ...$this->header([SurveyQuestionnaire::class, SurveyService::class.'::submit'], [
                'versi_kuesioner' => SurveyQuestionnaire::VERSION,
                'aspek' => $aspects,
                'alasan' => Ticket::REVIEW_REASONS,
                'catatan' => 'indeks = round(rata-rata aspek × 25, 2) (round PHP, half away from zero); mutu A ≥ 88.31, B ≥ 76.61, C ≥ 65, selain itu D. skm_index disimpan decimal(5,2).',
            ]),
            'indeks' => $index,
            'mutu' => $grades,
            'kasus' => $submits,
        ];
    }

    /** Jalankan $fn pada SQLite in-memory baru dengan surel/antrean/notifikasi dipalsukan. */
    private function withScratchDatabase(callable $fn): void
    {
        $previous = [config('database.default'), config('cache.default'), config('broadcasting.default')];
        config([
            'database.connections.cc_fixture' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true],
            'database.default' => 'cc_fixture',
            'cache.default' => 'array',
            'broadcasting.default' => 'null',
        ]);
        Mail::fake();
        Notification::fake();
        Queue::fake();
        Carbon::setTestNow(Carbon::parse('2026-11-13T03:00:00Z'));

        try {
            Artisan::call('migrate', ['--database' => 'cc_fixture', '--force' => true]);
            $fn();
        } finally {
            Carbon::setTestNow();
            DB::purge('cc_fixture');
            config(['database.default' => $previous[0], 'cache.default' => $previous[1], 'broadcasting.default' => $previous[2]]);
        }
    }
}
