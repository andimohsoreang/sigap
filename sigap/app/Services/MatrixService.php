<?php

namespace App\Services;

use App\Enums\TicketImpact;
use App\Enums\TicketStatus;
use App\Models\Category;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\Referral;
use App\Models\Survey;
use App\Models\Ticket;
use App\Models\User;
use App\Support\TicketFilters;
use App\Support\TicketIntake;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Agregat halaman Matriks Rekapitulasi (panel admin).
 *
 * D-05: setiap angka dihitung dengan agregat SQL (COUNT/SUM/AVG + GROUP BY);
 * hanya daftar "Perlu tindakan" (maks. 8 baris) yang memuat model. Query
 * masukan SUDAH dibatasi peran (scopedTickets) dan saringan kawasan; periode
 * diterapkan di sini. Ekspresi SQL kompatibel SQLite & PostgreSQL.
 */
class MatrixService
{
    /** Sumbu baris matriks yang didukung. */
    public const SUMBU = [
        'kategori' => 'Kategori',
        'kawasan' => 'Provinsi',
        'kanal' => 'Kanal',
        'petugas' => 'Petugas',
    ];

    /** Batas baris kartu "Perlu tindakan". */
    public const OVERDUE_LIMIT = 8;

    /** Batas pilihan bulan pada pemilih periode. */
    private const MONTH_OPTIONS = 24;

    public function __construct(private readonly StatsService $stats) {}

    /**
     * Wilayah = provinsi yang dipilih pelapor (tickets.province) + lokasi bebas
     * (tickets.location), bukan master kawasan (31-10-2026).
     *
     * @param  Builder  $scope  tiket dalam cakupan peran + saringan provinsi (tanpa periode)
     * @param  array{0: CarbonInterface, 1: CarbonInterface}|null  $range  periode, null = semua waktu
     * @return array<string, mixed>
     */
    public function build(Builder $scope, ?array $range, string $sumbu): array
    {
        $now = now();
        $period = (clone $scope)->when($range, fn (Builder $q) => $q->whereBetween('created_at', $range));

        $all = $this->aggregate($period, null, $now)->first() ?? $this->emptyMetrics();
        $byKanal = $this->aggregate($period, TicketIntake::kanalSql(), $now);
        $byProvince = $this->aggregate($period, 'tickets.province', $now);
        $counts = $all['counts'];
        $selesai = (clone $period)->where('status', TicketStatus::Selesai->value);
        $resolutionHours = $this->stats->averageHours($selesai, 'created_at', 'resolved_at');

        return [
            'total' => $all['total'],
            'alur' => [
                'pintu' => $this->pintu($byKanal),
                'tahap' => $this->stages($period, $all, $now),
                'tanpa_tiket' => $this->withoutTicket($range),
            ],
            'layanan' => $this->serviceFunnel($range),
            'petugas' => $this->staffPerformance($period, $now),
            'kpi' => [
                'berjalan' => $counts['baru'] + $counts['verifikasi'] + $counts['diproses'],
                'ews' => $all['ews'],
                // Tiket lewat tenggat yang masuk di luar periode (tetap perlu ditindak).
                'ews_luar_periode' => $range ? max(0, $this->stats->overdueCount($scope) - $all['ews']) : 0,
                'sla_pct' => $all['sla_pct'],
                'sla_tepat' => $all['tepat'],
                'sla_selesai' => $all['selesai_sla'],
                'respons_jam' => $this->stats->averageResponseHours($period),
                'penyelesaian_hari' => $resolutionHours === null ? null : round($resolutionHours / 24, 1),
            ],
            'matriks' => [
                'sumbu' => $sumbu,
                'rows' => $this->matrixRows($period, $sumbu, $now, $byKanal, $byProvince),
                'total' => $all,
            ],
            'dampak' => $this->impactRows($period, $now),
            'kanal' => $this->kanalRows($byKanal),
            'kawasan' => $this->provinceCards($byProvince),
            'provinsi' => $this->provinceRows($byProvince, $this->locations($period)),
            'kategori' => $this->categoryRows($this->aggregate($period, 'tickets.category_id', $now)),
            'tren' => $this->trend($scope, $range),
            'survei' => $this->survey($period, $counts['selesai']),
            'perlu_tindakan' => [
                'total' => $all['ews'],
                'items' => $this->overdueItems($period, $now),
            ],
        ];
    }

    /**
     * Pilihan bulan untuk pemilih periode: bulan berjalan mundur sampai bulan
     * tiket pertama dalam cakupan (maks. 24 bulan).
     *
     * @return list<array{value: string, label: string}>
     */
    public function months(Builder $scope, string $selected = ''): array
    {
        $first = (clone $scope)->reorder()->min('created_at');
        $cursor = CarbonImmutable::now()->startOfMonth();
        $start = $first ? CarbonImmutable::parse($first)->startOfMonth() : $cursor;

        $months = [];
        while ($cursor->greaterThanOrEqualTo($start) && count($months) < self::MONTH_OPTIONS) {
            $months[] = ['value' => $cursor->format('Y-m'), 'label' => TicketFilters::monthLabel($cursor)];
            $cursor = $cursor->subMonth();
        }

        // Periode dari tautan lama/di luar rentang tetap bisa dipilih ulang.
        if (($range = TicketFilters::range($selected)) && ! in_array($selected, array_column($months, 'value'), true)) {
            $months[] = ['value' => $selected, 'label' => TicketFilters::monthLabel(CarbonImmutable::parse($range[0]))];
        }

        return $months;
    }

    /* ----------------------------- Agregat ----------------------------- */

    /**
     * Satu query agregat: jumlah per status, EWS, dan SLA (tepat/selesai),
     * opsional dikelompokkan per ekspresi (dikunci string; null → '').
     *
     * @return Collection<string, array<string, mixed>>
     */
    private function aggregate(Builder $query, ?string $group, CarbonInterface $now): Collection
    {
        $open = "'".implode("', '", TicketFilters::openStatuses())."'";
        $done = TicketStatus::Selesai->value;

        $columns = [];
        foreach (TicketStatus::cases() as $status) {
            $columns[] = "SUM(CASE WHEN tickets.status = '{$status->value}' THEN 1 ELSE 0 END) as {$status->value}";
        }
        $columns[] = "SUM(CASE WHEN tickets.status IN ({$open}) AND tickets.sla_due_at IS NOT NULL AND tickets.sla_due_at < ? THEN 1 ELSE 0 END) as ews";
        $columns[] = "SUM(CASE WHEN tickets.status = '{$done}' AND tickets.sla_due_at IS NOT NULL THEN 1 ELSE 0 END) as finished";
        $columns[] = "SUM(CASE WHEN tickets.status = '{$done}' AND tickets.sla_due_at IS NOT NULL AND tickets.resolved_at IS NOT NULL AND tickets.resolved_at <= tickets.sla_due_at THEN 1 ELSE 0 END) as met";
        $columns[] = 'COUNT(*) as total';

        $select = implode(', ', $columns);
        $base = (clone $query)->reorder()->toBase();

        if ($group !== null) {
            $select = "{$group} as grp, {$select}";
            $base->groupBy('grp');
        }

        return $base->selectRaw($select, [$now])->get()
            ->mapWithKeys(fn (object $row) => [(string) ($row->grp ?? '') => $this->metrics($row)]);
    }

    /** @return array<string, mixed> */
    private function metrics(object $row): array
    {
        $counts = [];
        foreach (TicketStatus::cases() as $status) {
            $counts[$status->value] = (int) ($row->{$status->value} ?? 0);
        }

        $finished = (int) ($row->finished ?? 0);
        $met = (int) ($row->met ?? 0);

        return [
            'counts' => $counts,
            'total' => (int) ($row->total ?? 0),
            'ews' => (int) ($row->ews ?? 0),
            'selesai_sla' => $finished,
            'tepat' => $met,
            // Null = belum ada tiket selesai ber-SLA (ditampilkan "—", bukan 100%).
            'sla_pct' => $finished > 0 ? round($met / $finished * 100, 1) : null,
        ];
    }

    /** @return array<string, mixed> */
    private function emptyMetrics(): array
    {
        return $this->metrics((object) []);
    }

    /* --------------------------- Alur & KPI ---------------------------- */

    /** @return list<array{key: string, label: string, total: int}> */
    private function pintu(Collection $byKanal): array
    {
        $totals = array_fill_keys(array_keys(TicketIntake::PINTU), 0);
        foreach ($byKanal as $kanal => $metrics) {
            $totals[TicketIntake::KANAL_PINTU[$kanal] ?? TicketIntake::PINTU_WEB] += $metrics['total'];
        }

        return collect(TicketIntake::PINTU)
            ->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label, 'total' => $totals[$key]])
            ->values()
            ->all();
    }

    /** @return array<string, array<string, int>> */
    private function stages(Builder $period, array $all, CarbonInterface $now): array
    {
        $overdue = (clone $period)
            ->reorder()
            ->whereIn('status', TicketFilters::openStatuses())
            ->whereNotNull('sla_due_at')
            ->where('sla_due_at', '<', $now)
            ->toBase()
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        $stages = [];
        foreach (TicketStatus::cases() as $status) {
            $stages[$status->value] = [
                'jumlah' => $all['counts'][$status->value],
                'ews' => (int) ($overdue[$status->value] ?? 0),
            ];
        }
        $stages[TicketStatus::Selesai->value]['tepat_waktu'] = $all['tepat'];

        return $stages;
    }

    /**
     * Ditangani tanpa tiket (percakapan & rujukan TIDAK terikat kawasan —
     * semua admin melihat semua percakapan, lihat AdminController::chat).
     *
     * @return array<string, int>
     */
    private function withoutTicket(?array $range): array
    {
        $answered = ChatConversation::query()
            ->whereNull('ticket_id')
            ->when($range, fn ($q) => $q->whereBetween('created_at', $range))
            ->whereExists(fn ($q) => $q->selectRaw('1')
                ->from('chat_messages')
                ->whereColumn('chat_messages.conversation_id', 'chat_conversations.id')
                ->where('chat_messages.sender_type', 'ai')
                ->where('chat_messages.meta->kind', 'jawaban'))
            ->count();

        $referrals = Referral::query()
            ->when($range, fn ($q) => $q->whereBetween('created_at', $range))
            ->toBase()
            ->selectRaw("COUNT(*) as total, SUM(CASE WHEN status = '".Referral::STATUS_DONE."' THEN 1 ELSE 0 END) as berhasil")
            ->first();

        $ppid = ChatMessage::query()
            ->where('sender_type', 'ai')
            ->where('meta->kebijakan', true)
            ->when($range, fn ($q) => $q->whereBetween('created_at', $range))
            ->distinct()
            ->count('conversation_id');

        return [
            'dijawab_tara' => $answered,
            'rujukan' => (int) ($referrals->total ?? 0),
            'rujukan_berhasil' => (int) ($referrals->berhasil ?? 0),
            'ppid' => $ppid,
        ];
    }

    /**
     * Corong layanan Contact Center: semua percakapan dalam periode dibagi
     * habis menjadi selesai oleh TARA / ditangani petugas / tanpa jawaban,
     * lalu yang ditangani petugas dibagi habis menurut hasil akhirnya.
     * Definisi "selesai oleh TARA" sama dengan ContactCenterStats. Tidak
     * terikat kawasan (sama seperti {@see withoutTicket()}).
     *
     * @return array{percakapan: int, tahap: list<array{key: string, label: string, total: int}>, hasil_petugas: list<array{key: string, label: string, total: int}>}
     */
    private function serviceFunnel(?array $range): array
    {
        $conversations = ChatConversation::query()
            ->when($range, fn ($q) => $q->whereBetween('created_at', $range))
            ->get(['id', 'handled_by', 'handoff_at', 'outcome', 'ticket_id', 'closed_at']);

        $answered = ChatMessage::query()
            ->whereIn('conversation_id', $conversations->pluck('id'))
            ->where('sender_type', 'ai')
            ->where('meta->kind', 'jawaban')
            ->distinct()
            ->pluck('conversation_id')
            ->flip();

        $staff = $conversations->filter(fn (ChatConversation $c) => $c->handoff_at !== null || $c->handled_by === ChatConversation::HANDLED_STAFF);
        $byAi = $conversations->diffKeys($staff)->filter(fn (ChatConversation $c) => $answered->has($c->id));

        $result = fn (ChatConversation $c): string => match (true) {
            $c->ticket_id !== null || $c->outcome === 'tiket' => 'tiket',
            $c->outcome === 'rujuk_portal' => 'rujuk_portal',
            in_array($c->outcome, ['lapor', 'wbs'], true) => 'diarahkan',
            $c->outcome === 'terjawab_petugas' => 'terjawab_petugas',
            $c->closed_at === null => 'berjalan',
            default => 'lainnya',
        };
        $results = $staff->countBy($result);

        $item = fn (string $key, string $label, int $total) => compact('key', 'label', 'total');

        return [
            'percakapan' => $conversations->count(),
            'tahap' => [
                $item('tara', 'Selesai oleh TARA', $byAi->count()),
                $item('petugas', 'Ditangani petugas', $staff->count()),
                $item('tanpa_jawaban', 'Tanpa jawaban / ditinggalkan', $conversations->count() - $byAi->count() - $staff->count()),
            ],
            'hasil_petugas' => [
                $item('tiket', 'Jadi tiket', $results['tiket'] ?? 0),
                $item('rujuk_portal', 'Dirujuk ke portal', $results['rujuk_portal'] ?? 0),
                $item('diarahkan', 'Diarahkan ke LAPOR! / Inspektorat', $results['diarahkan'] ?? 0),
                $item('terjawab_petugas', 'Dijawab petugas', $results['terjawab_petugas'] ?? 0),
                $item('berjalan', 'Masih ditangani', $results['berjalan'] ?? 0),
                $item('lainnya', 'Tidak selesai / diakhiri warga', $results['lainnya'] ?? 0),
            ],
        ];
    }

    /**
     * Kinerja petugas atas tiket dalam periode & cakupan: tiket dibagi habis
     * menjadi selesai tepat waktu / terlambat, berjalan sesuai jadwal / lewat
     * tenggat, dan ditolak; ditambah rata-rata respons awal per petugas.
     *
     * @return list<array<string, mixed>>
     */
    private function staffPerformance(Builder $period, CarbonInterface $now): array
    {
        $data = $this->aggregate($period, 'tickets.assignee_id', $now);
        $response = $this->stats->averageHoursBy($period, 'created_at', 'responded_at', 'tickets.assignee_id');
        $names = User::query()
            ->whereKey($data->keys()->filter()->map(fn ($id) => (int) $id)->all())
            ->pluck('name', 'id');

        return $data
            ->map(function (array $m, string $id) use ($names, $response) {
                $c = $m['counts'];
                $berjalan = $c['baru'] + $c['verifikasi'] + $c['diproses'];

                return [
                    'key' => $id === '' ? 'none' : $id,
                    'label' => $id === '' ? 'Belum ditugaskan' : ($names[(int) $id] ?? 'Petugas #'.$id),
                    'total' => $m['total'],
                    'nilai' => [
                        // Selesai tanpa tenggat SLA dihitung tepat waktu.
                        'selesai_tepat' => $c['selesai'] - ($m['selesai_sla'] - $m['tepat']),
                        'selesai_lambat' => $m['selesai_sla'] - $m['tepat'],
                        'berjalan' => $berjalan - $m['ews'],
                        'lewat' => $m['ews'],
                        'ditolak' => $c['ditolak'],
                    ],
                    'sla_pct' => $m['sla_pct'],
                    'respons_jam' => $response[$id] ?? null,
                ];
            })
            // Petugas dengan tiket terbanyak di atas; "Belum ditugaskan" paling bawah.
            ->sortBy([fn ($a, $b) => ($a['key'] === 'none') <=> ($b['key'] === 'none'), fn ($a, $b) => $b['total'] <=> $a['total']])
            ->values()
            ->all();
    }

    /* ----------------------------- Matriks ----------------------------- */

    /** @return list<array<string, mixed>> */
    private function matrixRows(Builder $period, string $sumbu, CarbonInterface $now, Collection $byKanal, Collection $byProvince): array
    {
        return match ($sumbu) {
            // Sumbu "kawasan" (nama lama di URL) kini berisi provinsi pengaduan.
            'kawasan' => $this->provinceMatrix($byProvince),
            'kanal' => $this->kanalMatrix($byKanal),
            'petugas' => $this->assigneeMatrix($this->aggregate($period, 'tickets.assignee_id', $now)),
            default => $this->categoryMatrix($this->aggregate($period, 'tickets.category_id', $now)),
        };
    }

    /** @return array<string, mixed> */
    private function row(string $key, string $label, ?array $param, array $metrics, ?string $icon = null): array
    {
        return ['key' => $key, 'label' => $label, 'ikon' => $icon, 'param' => $param] + $metrics;
    }

    private function categoryMatrix(Collection $data): array
    {
        $ids = $data->keys()->filter()->map(fn ($id) => (int) $id)->values()->all();

        $rows = Category::query()
            ->where(fn ($q) => $q->where('is_active', true)->orWhereIn('id', $ids))
            ->orderBy('id')
            ->get(['id', 'name', 'slug'])
            ->map(fn (Category $c) => $this->row((string) $c->id, $c->name, ['category_id' => (string) $c->id], $data[(string) $c->id] ?? $this->emptyMetrics(), $c->slug))
            ->all();

        if ($data->has('')) {
            $rows[] = $this->row('', 'Tanpa kategori', null, $data['']);
        }

        return $rows;
    }

    private function provinceMatrix(Collection $data): array
    {
        return $data
            ->sortByDesc('total')
            ->map(fn (array $metrics, string $province) => $province === ''
                ? $this->row('', 'Internal / tanpa provinsi', null, $metrics, 'kawasan')
                : $this->row($province, $province, ['provinsi' => $province], $metrics, 'kawasan'))
            ->values()
            ->all();
    }

    private function kanalMatrix(Collection $data): array
    {
        $rows = [];
        foreach (TicketIntake::KANAL as $key => $label) {
            if (in_array($key, TicketIntake::KANAL_UTAMA, true) || $data->has($key)) {
                // Tiket internal tidak tampil di Manajemen Tiket, jadi barisnya tidak ditautkan.
                $param = $key === 'internal' ? null : ['kanal' => $key];
                $rows[] = $this->row($key, $label, $param, $data[$key] ?? $this->emptyMetrics(), $key);
            }
        }

        return $rows;
    }

    private function assigneeMatrix(Collection $data): array
    {
        $names = User::query()
            ->whereKey($data->keys()->filter()->map(fn ($id) => (int) $id)->all())
            ->pluck('name', 'id');

        return $data
            ->sortByDesc('total')
            ->map(fn (array $metrics, string $id) => $id === ''
                ? $this->row('', 'Belum ditugaskan', ['petugas' => 'none'], $metrics, 'belum')
                : $this->row($id, $names[(int) $id] ?? 'Petugas #'.$id, ['petugas' => $id], $metrics, 'petugas'))
            ->values()
            ->all();
    }

    /* ------------------------------ Kartu ------------------------------ */

    /** @return list<array<string, mixed>> */
    private function impactRows(Builder $period, CarbonInterface $now): array
    {
        $data = $this->aggregate($period, 'tickets.impact', $now);

        return collect([TicketImpact::Kritis, TicketImpact::Tinggi, TicketImpact::Sedang, TicketImpact::Rendah])
            ->map(function (TicketImpact $impact) use ($data) {
                $m = $data[$impact->value] ?? $this->emptyMetrics();

                return [
                    'value' => $impact->value,
                    'label' => $impact->label(),
                    'target' => 'Respons '.$this->responseLabel($impact->responseHours()).' · selesai '.$impact->resolveDays().' hari kerja',
                    'respons_jam' => $impact->responseHours(),
                    'selesai_hari' => $impact->resolveDays(),
                    'tiket' => $m['total'],
                    'berjalan' => $m['counts']['baru'] + $m['counts']['verifikasi'] + $m['counts']['diproses'],
                    'lewat' => $m['ews'],
                    'tepat' => $m['tepat'],
                    'selesai' => $m['selesai_sla'],
                ];
            })
            ->all();
    }

    /** 24 → "1×24 jam", 72 → "3×24 jam", 120 → "5 hari". */
    private function responseLabel(int $hours): string
    {
        $days = intdiv($hours, 24);

        if ($hours % 24 !== 0) {
            return "{$hours} jam";
        }

        return $days <= 3 ? "{$days}×24 jam" : "{$days} hari";
    }

    /** @return list<array{key: string, label: string, total: int}> */
    private function kanalRows(Collection $byKanal): array
    {
        return collect(TicketIntake::KANAL)
            ->filter(fn (string $label, string $key) => in_array($key, TicketIntake::KANAL_UTAMA, true) || $byKanal->has($key))
            ->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label, 'total' => $byKanal[$key]['total'] ?? 0])
            ->sortByDesc('total')
            ->values()
            ->all();
    }

    /** @return list<array{provinsi: string|null, label: string, total: int, ews: int}> */
    private function provinceCards(Collection $byProvince): array
    {
        return $byProvince
            ->map(fn (array $m, string $province) => [
                'provinsi' => $province === '' ? null : $province,
                // Tiket internal pegawai tidak berprovinsi.
                'label' => $province === '' ? 'Internal / tanpa provinsi' : $province,
                'total' => $m['total'],
                'ews' => $m['ews'],
            ])
            ->sortByDesc('total')
            ->values()
            ->all();
    }

    /**
     * Lokasi (kabupaten/kawasan/desa) yang ditulis pelapor, per provinsi.
     *
     * @return Collection<string, list<array{nama: string, total: int}>>
     */
    private function locations(Builder $period): Collection
    {
        return (clone $period)->reorder()->toBase()
            ->whereNotNull('tickets.province')
            ->whereNotNull('tickets.location')
            ->where('tickets.location', '!=', '')
            ->selectRaw('tickets.province as provinsi, tickets.location as lokasi, COUNT(*) as total')
            ->groupBy('tickets.province', 'tickets.location')
            ->get()
            ->groupBy('provinsi')
            ->map(fn (Collection $rows) => $rows->sortByDesc('total')->take(5)
                ->map(fn (object $r) => ['nama' => (string) $r->lokasi, 'total' => (int) $r->total])->values()->all());
    }

    /**
     * Sebaran per provinsi untuk peta. Tiket tanpa provinsi dikumpulkan di
     * "Tanpa provinsi" (tidak tampil di peta).
     *
     * @param  Collection<string, array<string, mixed>>  $byProvince
     * @param  Collection<string, list<array{nama: string, total: int}>>  $locations
     * @return list<array{provinsi: string, total: int, counts: array<string, int>, ews: int, sla_pct: float|null, kawasan: list<array{nama: string, total: int}>}>
     */
    private function provinceRows(Collection $byProvince, Collection $locations): array
    {
        return $byProvince
            ->map(fn (array $m, string $province) => [
                'provinsi' => $province === '' ? 'Tanpa provinsi' : $province,
                'total' => $m['total'],
                'counts' => $m['counts'],
                'ews' => $m['ews'],
                'sla_pct' => $m['sla_pct'],
                // Lokasi teratas yang ditulis pelapor (nama kunci lama dipertahankan untuk peta).
                'kawasan' => $locations[$province] ?? [],
            ])
            ->sortByDesc('total')
            ->values()
            ->all();
    }

    /**
     * Jumlah tiket per kategori (diagram batang).
     *
     * @param  Collection<string, array<string, mixed>>  $byCategory
     * @return list<array{key: string, label: string, total: int}>
     */
    private function categoryRows(Collection $byCategory): array
    {
        $names = Category::query()->whereKey($byCategory->keys()->filter()->map(fn ($id) => (int) $id)->all())->pluck('name', 'id');

        return $byCategory
            ->map(fn (array $m, string $id) => ['key' => $id, 'label' => $id === '' ? 'Tanpa kategori' : (string) ($names[(int) $id] ?? '—'), 'total' => $m['total']])
            ->sortByDesc('total')
            ->values()
            ->all();
    }

    /**
     * Tren tiket masuk vs selesai: per hari untuk satu bulan, per bulan untuk
     * "semua waktu" (maks. {@see MONTH_OPTIONS} bulan). Selesai dihitung dari
     * `resolved_at` di dalam rentang, termasuk tiket yang masuk sebelumnya.
     * Dikelompokkan di PHP agar sama di SQLite dan PostgreSQL.
     *
     * @param  array{0: CarbonImmutable, 1: CarbonImmutable}|null  $range
     * @return array{satuan: string, titik: list<array{key: string, label: string, masuk: int, selesai: int}>}
     */
    private function trend(Builder $scope, ?array $range): array
    {
        $today = CarbonImmutable::now()->endOfDay();
        if ($range) {
            [$from, $to] = [$range[0]->startOfDay(), $range[1]->min($today)];
            $unit = 'hari';
            $format = 'Y-m-d';
        } else {
            $first = (clone $scope)->reorder()->min('created_at');
            $from = CarbonImmutable::parse($first ?? $today)->startOfMonth()->max($today->subMonths(self::MONTH_OPTIONS - 1)->startOfMonth());
            $to = $today;
            $unit = 'bulan';
            $format = 'Y-m';
        }

        $points = [];
        for ($d = $from; $d <= $to; $d = $unit === 'hari' ? $d->addDay() : $d->addMonth()) {
            $points[$d->format($format)] = [
                'key' => $d->format($format),
                'label' => $unit === 'hari' ? $d->format('j') : TicketFilters::monthLabel($d),
                'masuk' => 0,
                'selesai' => 0,
            ];
        }

        $count = function (string $column, string $field) use ($scope, $from, $to, $format, &$points): void {
            (clone $scope)->reorder()->whereNotNull($column)->whereBetween($column, [$from, $to])->pluck($column)
                ->each(function ($at) use ($field, $format, &$points) {
                    $key = CarbonImmutable::parse($at)->format($format);
                    if (isset($points[$key])) {
                        $points[$key][$field]++;
                    }
                });
        };
        $count('created_at', 'masuk');
        $count('resolved_at', 'selesai');

        return ['satuan' => $unit, 'titik' => array_values($points)];
    }

    /** @return array{rata: float|null, responden: int, selesai: int} */
    private function survey(Builder $period, int $finished): array
    {
        $row = Survey::query()
            ->whereIn('ticket_id', (clone $period)->reorder()->select('tickets.id'))
            ->toBase()
            ->selectRaw('AVG(rating) as rata, COUNT(*) as jumlah')
            ->first();

        $count = (int) ($row->jumlah ?? 0);

        return [
            'rata' => $count > 0 ? round((float) $row->rata, 1) : null,
            'responden' => $count,
            'selesai' => $finished,
        ];
    }

    /** @return list<array<string, mixed>> */
    private function overdueItems(Builder $period, CarbonInterface $now): array
    {
        return (clone $period)
            ->reorder()
            ->whereIn('status', TicketFilters::openStatuses())
            ->whereNotNull('sla_due_at')
            ->where('sla_due_at', '<', $now)
            ->with(['category:id,name', 'region:id,name', 'assignee:id,name'])
            ->orderBy('sla_due_at')
            ->limit(self::OVERDUE_LIMIT)
            ->get()
            ->map(fn (Ticket $t) => [
                'nomor' => $t->ticket_no,
                'judul' => $t->title,
                'kategori' => $t->category?->name,
                'kawasan' => $t->wilayahLabel(),
                'impact' => $t->impact?->value,
                'impact_label' => $t->impact?->label(),
                'status' => $t->status?->value,
                'status_label' => $t->status?->label(),
                'petugas' => $t->assignee?->name,
                'lewat_menit' => (int) floor(abs($now->diffInMinutes($t->sla_due_at))),
            ])
            ->all();
    }
}
