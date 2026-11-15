<?php

namespace App\Console\Commands\Cc;

use App\Enums\TicketImpact;
use App\Enums\TicketPriority;
use App\Enums\TicketStatus;
use App\Enums\TicketVisibility;
use App\Enums\UserRole;
use App\Http\Controllers\Web\PublicController;
use App\Http\Middleware\HandleInertiaRequests;
use App\Models\Ticket;
use App\Models\TicketHistory;
use App\Models\Unit;
use App\Models\User;
use App\Services\SlaCalculator;
use App\Services\SurveyService;
use App\Services\TicketService;
use App\Support\SurveyQuestionnaire;
use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiter;
use Illuminate\Console\Command;
use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Queue;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * Rewrite Next.js (S0-C): ekspor vektor uji dari kelas Laravel ASLI ke
 * `parity/fixtures/*.json`. Hanya alat bantu; tidak mengubah fitur.
 *
 * Semua dijalankan di skema PostgreSQL sementara `cc_fixture` (dibuat lalu
 * dihapus) pada database lokal --db, jam dibekukan, tanpa acak di berkas.
 */
class EksporFixture extends Command
{
    protected $signature = 'cc:ekspor-fixture
        {--dir= : Folder tujuan (bawaan: ../parity/fixtures)}
        {--db=cc_paritas : Database PostgreSQL lokal untuk skema sementara cc_fixture}
        {--db-user=cc_migrate : Pengguna PostgreSQL lokal}';

    protected $description = 'Ekspor vektor uji SLA, status, nomor tiket, lacak, dan SKM ke parity/fixtures (rewrite Next.js)';

    /** APP_TIMEZONE produksi app2 (dicek di server 13 Nov 2026, parity/PRODUKSI.md). */
    private const PRODUCTION_TIMEZONE = 'Asia/Jakarta';

    private const SCHEMA = 'cc_fixture';

    /** Jam beku semua kasus yang memakai Carbon::now(). */
    private const NOW = '2026-11-13 10:00:00';

    /** Waktu "sebelumnya" untuk kolom tiket yang sudah terisi. */
    private const EARLIER = '2026-11-10 09:00:00';

    private string $commit;

    public function handle(): int
    {
        // Keluaran tidak bergantung pada .env lokal: zona waktu aplikasi = produksi.
        config(['app.timezone' => self::PRODUCTION_TIMEZONE]);
        date_default_timezone_set(self::PRODUCTION_TIMEZONE);

        $rev = Process::path(base_path())->run(['git', 'rev-parse', 'laravel-baseline^{commit}']);
        if (! $rev->successful()) {
            throw new RuntimeException('Tag laravel-baseline tidak ditemukan (git fetch --tags).');
        }
        $this->commit = trim($rev->output());

        $dir = $this->option('dir') ?: base_path('../parity/fixtures');
        File::ensureDirectoryExists($dir);

        $files = $this->withScratchDatabase(fn () => [
            'sla.json' => $this->sla(app(SlaCalculator::class)),
            'status-tiket.json' => $this->statuses(),
            'nomor-tiket.json' => $this->ticketNumbers(),
            'lacak-tiket.json' => $this->lookups(),
            'survei-skm.json' => $this->survey(),
        ]);

        foreach ($files as $name => $data) {
            File::put($dir.'/'.$name, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n");
            $this->line("{$name}: ".count($data['kasus']).' kasus');
        }

        return self::SUCCESS;
    }

    /** @param list<string> $sources */
    private function header(array $sources, array $extra = []): array
    {
        return ['sumber' => $sources, 'commit' => $this->commit, 'tag' => 'laravel-baseline', 'perintah' => 'php artisan cc:ekspor-fixture', ...$extra];
    }

    private static function iso(?\DateTimeInterface $t): ?string
    {
        return $t?->format('Y-m-d\TH:i:s.uP');
    }

    private function sla(SlaCalculator $sla): array
    {
        $categoryDays = [null, -1, 0, 1, 2, 3, 5, 7, 10, 14, 20];
        // Lokal tanpa offset; ditafsirkan di zona waktu kasus.
        $starts = [
            '2026-11-09 09:00:00', // Senin
            '2026-11-11 14:30:00', // Rabu
            '2026-11-12 23:59:59', // Kamis menjelang tengah malam
            '2026-11-12 23:59:59.999999', // Kamis, pecahan detik
            '2026-11-13 00:00:00', // Jumat tengah malam
            '2026-11-13 15:00:00', // Jumat sore
            '2026-11-13 23:30:00', // Jumat malam
            '2026-11-13 23:59:59.999999', // Jumat, pecahan detik
            '2026-11-14 10:00:00', // Sabtu
            '2026-11-15 20:00:00', // Minggu
            '2026-11-15 23:59:59.500000', // Minggu, pecahan detik
            '2026-01-30 16:00:00', // Jumat, akhir Januari
            '2026-02-27 13:00:00', // Jumat, akhir Februari (bukan kabisat)
            '2028-02-28 10:00:00', // Senin, kabisat
            '2026-04-30 11:00:00', // Kamis, akhir bulan
            '2026-12-31 08:00:00', // Kamis, akhir tahun
            '2026-12-31 23:59:59.999999', // Kamis, akhir tahun, pecahan detik
            '2027-12-31 17:00:00', // Jumat, akhir tahun
            '2028-12-30 09:00:00', // Sabtu, akhir tahun
        ];

        $vectors = function (string $tz) use ($sla, $starts, $categoryDays): array {
            $cases = [];
            foreach ($starts as $start) {
                $from = CarbonImmutable::parse($start, $tz);
                foreach (TicketImpact::cases() as $impact) {
                    foreach ($categoryDays as $days) {
                        $due = $sla->dueAt($impact, $from, $days);
                        // Persis seperti Eloquent menulis kolom sla_due_at (format tanggal grammar, tanpa konversi zona).
                        $ticket = new Ticket;
                        $ticket->sla_due_at = $due;
                        $cases[] = [
                            'zona' => $tz,
                            'mulai' => self::iso($from),
                            'hari_mulai' => $from->englishDayOfWeek,
                            'dampak' => $impact->value,
                            'sla_days_kategori' => $days,
                            'prioritas' => $sla->priorityFor($impact)->value,
                            'hari_kerja' => $sla->resolveDays($impact, $days),
                            'respons_paling_lambat' => self::iso($sla->respondAt($impact, $from)),
                            'tenggat_selesai' => self::iso($due),
                            'tersimpan_db' => $ticket->getAttributes()['sla_due_at'],
                        ];
                    }
                }
            }

            return $cases;
        };

        $due = CarbonImmutable::parse('2026-11-18 15:00:00', self::PRODUCTION_TIMEZONE);
        $before = $due->subSecond();
        $after = $due->addSecond();
        $status = [];
        foreach ([
            ['terbuka' => true, 'tenggat' => null, 'sekarang' => $after, 'selesai' => null],
            ['terbuka' => false, 'tenggat' => null, 'sekarang' => $after, 'selesai' => $before],
            ['terbuka' => true, 'tenggat' => $due, 'sekarang' => $before, 'selesai' => null],
            ['terbuka' => true, 'tenggat' => $due, 'sekarang' => $due, 'selesai' => null],
            ['terbuka' => true, 'tenggat' => $due, 'sekarang' => $due->addMicrosecond(), 'selesai' => null],
            ['terbuka' => true, 'tenggat' => $due, 'sekarang' => $after, 'selesai' => null],
            ['terbuka' => false, 'tenggat' => $due, 'sekarang' => $after, 'selesai' => null],
            ['terbuka' => false, 'tenggat' => $due, 'sekarang' => $after, 'selesai' => $before],
            ['terbuka' => false, 'tenggat' => $due, 'sekarang' => $after, 'selesai' => $due],
            ['terbuka' => false, 'tenggat' => $due, 'sekarang' => $after, 'selesai' => $due->addMicrosecond()],
            ['terbuka' => false, 'tenggat' => $due, 'sekarang' => $before, 'selesai' => $after],
            ['terbuka' => true, 'tenggat' => $due, 'sekarang' => $after, 'selesai' => $before],
        ] as $c) {
            $status[] = [
                'terbuka' => $c['terbuka'],
                'tenggat' => self::iso($c['tenggat']),
                'sekarang' => self::iso($c['sekarang']),
                'selesai_pada' => self::iso($c['selesai']),
                'status' => $sla->status($c['terbuka'], $c['tenggat'], $c['sekarang'], $c['selesai']),
            ];
        }

        return [
            ...$this->header([SlaCalculator::class, TicketImpact::class, TicketPriority::class, Ticket::class.' (sla_due_at)'], [
                'zona_waktu_aplikasi' => config('app.timezone'),
                'zona_waktu_produksi' => self::PRODUCTION_TIMEZONE,
                'catatan' => 'TicketService::create memanggil dueAt(dampak, Carbon::now(), kategori.sla_days) di zona waktu aplikasi; hari kerja = Senin–Jumat di zona waktu nilai mulai; mikrodetik ikut terbawa. tersimpan_db = nilai yang ditulis Eloquent ke kolom (Y-m-d H:i:s, mikrodetik dibuang, tanpa konversi zona). Hanya Asia/Jakarta (zona produksi).',
            ]),
            'kasus' => $vectors(self::PRODUCTION_TIMEZONE),
            'status' => $status,
        ];
    }

    private function statuses(): array
    {
        $matrix = [];
        foreach (TicketStatus::cases() as $from) {
            foreach (TicketStatus::cases() as $to) {
                $matrix[] = ['dari' => $from->value, 'ke' => $to->value, 'boleh' => $from->canTransitionTo($to), 'sama' => $from === $to];
            }
        }

        // Jalankan TicketService::changeStatus sungguhan untuk tiap pasangan & varian keadaan awal.
        $service = app(TicketService::class);
        $admin = $this->user('fixture-aktor', UserRole::SuperAdmin);
        $other = $this->user('fixture-petugas', UserRole::AdminKawasan);
        $unit = Unit::query()->forceCreate(['code' => 'FXT', 'name' => 'Unit Fixture']);
        $label = fn (?int $id) => match ($id) {
            null => null,
            $admin->id => 'aktor',
            $other->id => 'petugas_lain',
            default => "user#{$id}",
        };
        $variants = [
            'dasar' => [],
            'tanpa_aktor' => ['aktor' => null],
            'sudah_ditugaskan' => ['assignee' => $other->id],
            'didisposisikan' => ['unit' => $unit->id],
            'tanpa_tinjau_ulang' => ['tinjau' => false],
        ];

        $cases = [];
        $n = 0;
        foreach (TicketStatus::cases() as $from) {
            foreach (TicketStatus::cases() as $to) {
                foreach ($variants as $variant => $v) {
                    if ($variant !== 'dasar' && ! $from->canTransitionTo($to)) {
                        continue;
                    }
                    if ($variant === 'tanpa_tinjau_ulang' && $from !== TicketStatus::Selesai) {
                        continue;
                    }
                    $actor = array_key_exists('aktor', $v) ? null : $admin;
                    $review = $from === TicketStatus::Selesai && ($v['tinjau'] ?? true);
                    $initial = [
                        'status' => $from->value,
                        'responded_at' => $from === TicketStatus::Baru ? null : self::EARLIER,
                        'resolved_at' => $from === TicketStatus::Selesai ? self::EARLIER : null,
                        'review_requested_at' => $review ? self::EARLIER : null,
                        'review_reason' => $review ? Ticket::REVIEW_LOW_SCORE : null,
                        'reviewed_at' => null,
                        'reviewed_by' => null,
                        'ews_notified_at' => self::EARLIER,
                        'assignee_id' => $v['assignee'] ?? null,
                        'unit_id' => $v['unit'] ?? null,
                    ];

                    DB::beginTransaction();
                    try {
                        $ticket = $this->ticket(sprintf('TKT-%d', ++$n), $initial);
                        $error = null;
                        try {
                            $service->changeStatus($ticket, $to, $actor, 'catatan uji');
                        } catch (ValidationException $e) {
                            $error = $e->errors();
                        }
                        $after = $ticket->fresh()->getAttributes();
                        $history = TicketHistory::query()->where('ticket_id', $ticket->id)->orderBy('id')->get()
                            ->map(fn (TicketHistory $h) => ['dari' => $h->from_status, 'ke' => $h->to_status, 'aktor' => $label($h->actor_id), 'catatan' => $h->note])->all();
                    } finally {
                        DB::rollBack();
                    }

                    $fields = fn (array $row) => [
                        'status' => $row['status'],
                        'responded_at' => $row['responded_at'],
                        'resolved_at' => $row['resolved_at'],
                        'reviewed_at' => $row['reviewed_at'],
                        'reviewed_by' => $label($row['reviewed_by']),
                        'ews_notified_at' => $row['ews_notified_at'],
                        'assignee_id' => $label($row['assignee_id']),
                        'unit_id' => $row['unit_id'] === null ? null : 'unit',
                    ];
                    $cases[] = [
                        'dari' => $from->value,
                        'ke' => $to->value,
                        'varian' => $variant,
                        'aktor' => $actor ? 'aktor' : null,
                        'awal' => $fields($initial),
                        'hasil' => $fields($after),
                        'riwayat_baru' => $history,
                        'galat' => $error,
                    ];
                }
            }
        }

        return [
            ...$this->header([TicketStatus::class, TicketService::class.'::changeStatus'], [
                'jam' => self::NOW.' '.self::PRODUCTION_TIMEZONE,
                'catatan' => 'kasus = changeStatus sungguhan (PostgreSQL, Carbon::now() dibekukan pada `jam`); nilai waktu = string kolom DB. Varian: dasar (aktor super admin, belum ditugaskan, tinjau ulang diminta bila dari selesai), tanpa_aktor, sudah_ditugaskan (assignee lain), didisposisikan (unit_id terisi), tanpa_tinjau_ulang.',
            ]),
            'status' => array_map(fn (TicketStatus $s) => [
                'nilai' => $s->value,
                'label' => $s->label(),
                'terbuka' => $s->isOpen(),
                'transisi' => array_map(fn (TicketStatus $t) => $t->value, $s->allowedTransitions()),
            ], TicketStatus::cases()),
            'matriks' => $matrix,
            'kasus' => $cases,
        ];
    }

    private function ticketNumbers(): array
    {
        $nbsp = "\u{00A0}";
        $inputs = [
            'TKT-261113-ABCDEF', 'tkt-261113-abcdef', '  TKT-261113-23456Z  ', "\tTKT-261113-HJKMNP\n",
            "{$nbsp}TKT-261113-ABCDEF{$nbsp}", "\0TKT-261113-ABCDEF\0", "\x0BTKT-261113-ABCDEF\x0B", "\rTKT-261113-ABCDEF\r",
            'tkt-261113-abcdeſ', 'TKT-261113-ABCDEſ', "TKT-261113-ABCDEF\u{200B}",
            'TKT-261113-ABCDE0', 'TKT-261113-ABCDEO', 'TKT-261113-ABCDE1', 'TKT-261113-ABCDEI', 'TKT-261113-ABCDEL',
            'TKT-261113-ABCDE', 'TKT-261113-ABCDEFG', 'TKT-26111-ABCDEF', 'TKT-2611133-ABCDEF', 'TKT261113-ABCDEF',
            'TKT_261113_ABCDEF', 'TKT-261113ABCDEF', 'TKT-261113-ABC DEF', 'XYZ-261113-ABCDEF', 'TKT--ABCDEF',
            'TKT-1', 'tkt-42', ' TKT-0000000001 ', 'TKT-1234567890', 'TKT-12345678901', 'TKT-', 'TKT-12a',
            'TKT-00', '', '   ', 'ABCDEF', '261113-ABCDEF', 'TKT-261113-ÀBCDEF', 'TKT-١٢٣',
        ];

        $cases = array_map(fn (string $in) => [
            'masukan' => $in,
            'normal' => Ticket::normalizeNo($in),
            'sah' => Ticket::isValidNo($in),
            'format_lama' => Ticket::isLegacyNo($in),
            'cocok_rute_lacak' => (bool) preg_match('/^[A-Za-z0-9-]{1,32}$/', $in),
        ], $inputs);

        $ticket = new Ticket;
        $ticket->lookup_token = 'ABCD2345';
        $codes = array_map(fn (?string $code) => [
            'kode_tersimpan' => 'ABCD2345',
            'masukan' => $code,
            'cocok' => $ticket->matchesLookupToken($code),
        ], ['ABCD2345', 'abcd2345', ' AbCd2345 ', "\0ABCD2345", "{$nbsp}ABCD2345", 'ſBCD2345', 'ABCD234', 'ABCD23456', '', null, 'ABCD2346']);

        // Prefiks tanggal nomor baru (WIB). Sufiks acak diperiksa terhadap pola, tidak diekspor.
        $tickets = app(TicketService::class);
        $prefixes = [];
        foreach (['2026-11-13T16:59:59Z', '2026-11-13T17:00:00Z', '2026-12-31T17:00:00Z', '2027-01-01T00:00:00+07:00'] as $instant) {
            Carbon::setTestNow(Carbon::parse($instant));
            $no = $tickets->nextTicketNo();
            Carbon::setTestNow(Carbon::parse(self::NOW));
            if (! Ticket::isValidNo($no) || Ticket::isLegacyNo($no)) {
                throw new RuntimeException("nextTicketNo menghasilkan nomor tidak sah: {$no}");
            }
            $prefixes[] = ['waktu' => $instant, 'prefiks' => substr($no, 0, 11), 'panjang' => strlen($no)];
        }

        return [
            ...$this->header([Ticket::class, TicketService::class.'::nextTicketNo']),
            'pola' => Ticket::NUMBER_PATTERN,
            'pola_format_lama' => Ticket::LEGACY_NUMBER_PATTERN,
            'alfabet' => Ticket::NUMBER_ALPHABET,
            'panjang_kode_akses' => Ticket::LOOKUP_TOKEN_LENGTH,
            'pola_rute_lacak' => '[A-Za-z0-9-]{1,32}',
            'catatan' => 'normal = strtoupper(trim(masukan)) PHP (trim hanya " \t\n\r\0\x0B", strtoupper hanya ASCII). Jalur HTTP (middleware TrimStrings + controller) ada di lacak-tiket.json.',
            'nomor_baru' => $prefixes,
            'kode_akses' => $codes,
            'kasus' => $cases,
        ];
    }

    /** findForPublicLookup per jenis tiket & penampil, plus jalur HTTP /lacak (TrimStrings + PublicController::track). */
    private function lookups(): array
    {
        $warga = $this->user('fixture-warga', UserRole::Warga);
        $viewers = [
            'tamu' => null,
            'pelapor' => $warga,
            'warga_lain' => $this->user('fixture-warga-lain', UserRole::Warga),
            'admin_kawasan' => $this->user('fixture-kawasan', UserRole::AdminKawasan),
            'super_admin' => $this->user('fixture-super', UserRole::SuperAdmin),
        ];
        $defs = [
            'publik' => ['ticket_no' => 'TKT-261113-ABCDEF'],
            'publik_milik_warga' => ['ticket_no' => 'TKT-261113-BCDEFG', 'reporter_id' => $warga->id],
            'anonim' => ['ticket_no' => 'TKT-261113-CDEFGH', 'visibility' => TicketVisibility::Anonim->value],
            'rahasia_milik_warga' => ['ticket_no' => 'TKT-261113-DEFGHJ', 'visibility' => TicketVisibility::Rahasia->value, 'reporter_id' => $warga->id],
            'internal' => ['ticket_no' => 'TKT-261113-EFGHJK', 'is_internal' => true],
            'format_lama' => ['ticket_no' => 'TKT-42', 'lookup_token' => 'ABCD2345'],
            'format_lama_milik_warga' => ['ticket_no' => 'TKT-43', 'lookup_token' => 'EFGH6789', 'reporter_id' => $warga->id],
            'dihapus' => ['ticket_no' => 'TKT-261113-FGHJKM', 'deleted_at' => self::EARLIER],
        ];

        DB::beginTransaction();
        try {
            $byNo = [];
            foreach ($defs as $name => $attrs) {
                $byNo[$this->ticket($attrs['ticket_no'], $attrs)->ticket_no] = $name;
            }
            $service = app(TicketService::class);

            $cases = [];
            foreach ($defs as $name => $attrs) {
                $no = $attrs['ticket_no'];
                $inputs = [$no, '  '.strtolower($no).' '];
                $codes = isset($attrs['lookup_token']) ? [null, $attrs['lookup_token'], ' '.strtolower($attrs['lookup_token']).' ', 'SALAH234'] : [null];
                foreach ($inputs as $input) {
                    foreach ($codes as $code) {
                        foreach ($viewers as $viewerName => $viewer) {
                            $found = $service->findForPublicLookup($input, $viewer, [], $code);
                            $cases[] = ['tiket' => $name, 'masukan' => $input, 'kode' => $code, 'penampil' => $viewerName, 'hasil' => $found ? $byNo[$found->ticket_no] : null];
                        }
                    }
                }
            }

            // Jalur HTTP sungguhan (tamu): middleware global (TrimStrings, ConvertEmptyStringsToNull) + PublicController::track.
            $nbsp = "\u{00A0}";
            $http = [];
            $kernel = app(HttpKernel::class);
            $version = (string) app(HandleInertiaRequests::class)->version(Request::create('/'));
            $requests = [
                ['/lacak', ['ticket' => 'TKT-261113-ABCDEF']],
                ['/lacak', ['ticket' => '  tkt-261113-abcdef  ']],
                ['/lacak', ['ticket' => "{$nbsp}TKT-261113-ABCDEF{$nbsp}"]],
                ['/lacak', ['ticket' => "\0TKT-261113-ABCDEF"]],
                ['/lacak', ['ticket' => 'tkt-261113-abcdeſ']],
                ['/lacak', ['ticket' => 'TKT-261113-EFGHJK']],
                ['/lacak', ['ticket' => 'TKT-42']],
                ['/lacak', ['ticket' => 'TKT-42', 'kode' => 'ABCD2345']],
                ['/lacak', ['ticket' => 'tkt-42', 'kode' => ' abcd2345 ']],
                ['/lacak', ['ticket' => 'TKT-42', 'kode' => "{$nbsp}ABCD2345{$nbsp}"]],
                ['/lacak', ['ticket' => 'TKT-42', 'kode' => 'ſBCD2345']],
                ['/lacak', ['ticket' => 'TKT-42', 'kode' => 'ABCD2345XXXXXXXXXXXXXXXX']],
                ['/lacak', ['ticket' => 'TKT-42', 'kode' => '']],
                ['/lacak', ['ticket' => 'TKT-42', 'kode' => 'SALAH234']],
                ['/lacak', ['ticket' => '']],
                ['/lacak', []],
                ['/lacak/tkt-261113-abcdef', []],
                ['/lacak/TKT-42', ['kode' => 'abcd2345']],
                ['/lacak/TKT-43', ['kode' => 'EFGH6789']],
            ];
            foreach ($requests as $i => [$path, $query]) {
                $request = Request::create($path, 'GET', $query, [], [], ['REMOTE_ADDR' => '10.0.0.'.($i + 1)]);
                $request->headers->set('X-Inertia', 'true');
                $request->headers->set('X-Inertia-Version', $version);
                $response = $kernel->handle($request);
                $props = json_decode((string) $response->getContent(), true)['props'] ?? [];
                $http[] = [
                    'jalur' => $path,
                    'query' => $query,
                    'status_http' => $response->getStatusCode(),
                    'query_normal' => $props['query'] ?? null,
                    'kode_normal' => $props['kode'] ?? null,
                    'butuh_kode' => $props['butuh_kode'] ?? null,
                    'hasil' => match (true) {
                        ! array_key_exists('ticket', $props) => '(tidak ada prop)',
                        is_array($props['ticket']) => $byNo[$props['ticket']['ticket_no'] ?? $props['ticket']['nomor'] ?? ''] ?? '(ditemukan)',
                        default => $props['ticket'],
                    },
                ];
                $kernel->terminate($request, $response);
            }
        } finally {
            DB::rollBack();
        }

        return [
            ...$this->header([TicketService::class.'::findForPublicLookup', PublicController::class.'::track']),
            'catatan' => 'hasil = nama tiket yang dikembalikan atau null. http: hasil false = nomor sah tetapi tidak ditemukan/tidak boleh dilihat, null = nomor kosong/tidak sah (tidak dicari).',
            'kasus' => $cases,
            'http' => $http,
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
        $inputs = [];
        $answerSets = ['semua_1' => array_fill(0, 9, 1), 'semua_4' => array_fill(0, 9, 4), 'campur' => [4, 3, 2, 1, 4, 3, 2, 1, 4]];
        foreach ($answerSets as $setName => $values) {
            foreach (['penuh', 'sebagian', 'belum'] as $resolved) {
                foreach ([null, false, true] as $review) {
                    foreach ([1, 2, 3, 4] as $overall) {
                        // Kombinasi jawaban aspek tidak memengaruhi alasan; 'campur' & 'semua_4' cukup untuk indeks.
                        if ($setName !== 'campur' && ($review !== null || $resolved !== 'penuh')) {
                            continue;
                        }
                        $inputs[] = [$fill($values), $overall, $resolved, $review];
                    }
                }
            }
        }
        // Nilai string seperti dari form (validasi 'boolean'/'integer' tidak mengubah tipe).
        foreach ([['sebagian', '1', '3'], ['sebagian', '0', '3'], ['belum', '0', '4'], ['belum', '1', '4'], ['penuh', null, '2'], ['penuh', '0', '3'], ['sebagian', 'true', '3']] as [$resolved, $review, $overall]) {
            $inputs[] = [$fill(array_map('strval', $answerSets['campur'])), $overall, $resolved, $review];
        }

        $service = app(SurveyService::class);
        $submits = [];
        foreach ($inputs as $n => [$answers, $overall, $resolved, $review]) {
            $data = ['jawaban' => $answers, 'keseluruhan' => $overall, 'teratasi' => $resolved, 'kembali' => 3];
            if ($review !== null) {
                $data['tinjau_ulang'] = $review;
            }

            DB::beginTransaction();
            try {
                $ticket = $this->ticket(sprintf('TKT-%d', $n + 1), ['status' => TicketStatus::Selesai->value]);
                $survey = $service->submit($ticket, null, $data);
                $ticket->refresh();
                $submits[] = [
                    'masukan' => $data,
                    'skm_index_tersimpan' => $survey->fresh()->getAttributes()['skm_index'],
                    'alasan_tinjau_ulang' => $ticket->review_reason,
                    'ditandai_tinjau_ulang' => $ticket->review_requested_at !== null,
                ];
            } finally {
                DB::rollBack();
            }
        }

        return [
            ...$this->header([SurveyQuestionnaire::class, SurveyService::class.'::submit'], [
                'versi_kuesioner' => SurveyQuestionnaire::VERSION,
                'aspek' => $aspects,
                'alasan' => Ticket::REVIEW_REASONS,
                'catatan' => 'indeks = round(rata-rata aspek × 25, 2) (round PHP, half away from zero); mutu A ≥ 88.31, B ≥ 76.61, C ≥ 65, selain itu D. skm_index disimpan numeric(5,2) PostgreSQL. tinjau_ulang dibaca (bool): "0" = false, "1"/"true" = true.',
            ]),
            'indeks' => $index,
            'mutu' => $grades,
            'kasus' => $submits,
        ];
    }

    private function user(string $username, UserRole $role): User
    {
        return User::query()->forceCreate([
            'username' => $username,
            'name' => $username,
            'email' => $username.'@example.test',
            'role' => $role,
            'is_active' => true,
            'password' => 'tidak-dipakai',
        ]);
    }

    /** @param array<string, mixed> $attrs */
    private function ticket(string $no, array $attrs = []): Ticket
    {
        return Ticket::query()->forceCreate([
            'title' => 'Fixture',
            'description' => 'Fixture',
            'status' => TicketStatus::Baru->value,
            'priority' => TicketPriority::Umum->value,
            'impact' => TicketImpact::Sedang->value,
            'visibility' => TicketVisibility::Publik->value,
            'is_internal' => false,
            ...$attrs,
            'ticket_no' => $no,
        ]);
    }

    /**
     * Jalankan $fn pada skema PostgreSQL baru `cc_fixture` (dihapus sesudahnya) dengan
     * surel/antrean/notifikasi dipalsukan dan jam dibekukan.
     *
     * @template T
     *
     * @param  callable(): T  $fn
     * @return T
     */
    private function withScratchDatabase(callable $fn): mixed
    {
        config([
            'database.connections.cc_fixture' => [
                ...config('database.connections.pgsql'),
                'url' => null,
                'host' => '127.0.0.1',
                'port' => '5432',
                'database' => $this->option('db'),
                'username' => $this->option('db-user'),
                'password' => '',
                'search_path' => self::SCHEMA,
            ],
            'database.default' => 'cc_fixture',
            'cache.default' => 'array',
            'session.driver' => 'array',
            'broadcasting.default' => 'null',
            'services.recaptcha.site_key' => null,
        ]);
        // RateLimiter sudah dibuat saat boot dengan store cache bawaan .env; ganti ke store array dengan limiter yang sama.
        $limiter = new RateLimiter(app('cache')->store('array'));
        foreach ((fn () => $this->limiters)->call(app(RateLimiter::class)) as $name => $callback) {
            $limiter->for($name, $callback);
        }
        app()->instance(RateLimiter::class, $limiter);
        Mail::fake();
        Notification::fake();
        Queue::fake();
        Carbon::setTestNow(Carbon::parse(self::NOW));

        $db = DB::connection('cc_fixture');
        $db->statement('DROP SCHEMA IF EXISTS '.self::SCHEMA.' CASCADE');
        $db->statement('CREATE SCHEMA '.self::SCHEMA);
        try {
            Artisan::call('migrate', ['--database' => 'cc_fixture', '--force' => true]);

            return $fn();
        } finally {
            Carbon::setTestNow();
            $db->statement('DROP SCHEMA IF EXISTS '.self::SCHEMA.' CASCADE');
        }
    }
}
