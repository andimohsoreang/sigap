<?php

namespace App\Services;

use App\Enums\TicketImpact;
use App\Enums\TicketStatus;
use App\Models\Category;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\Referral;
use App\Models\Region;
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
        'kawasan' => 'Kawasan',
        'kanal' => 'Kanal',
        'petugas' => 'Petugas',
    ];

    /** Batas baris kartu "Perlu tindakan". */
    public const OVERDUE_LIMIT = 8;

    /** Batas pilihan bulan pada pemilih periode. */
    private const MONTH_OPTIONS = 24;

    public function __construct(private readonly StatsService $stats) {}

    /**
     * @param  Builder  $scope  tiket dalam cakupan peran + saringan kawasan (tanpa periode)
     * @param  array{0: CarbonInterface, 1: CarbonInterface}|null  $range  periode, null = semua waktu
     * @param  list<int>|null  $regionIds  kawasan yang tampil sebagai baris; null = semua kawasan aktif
     * @return array<string, mixed>
     */
    public function build(Builder $scope, ?array $range, string $sumbu, ?array $regionIds = null): array
    {
        $now = now();
        $period = (clone $scope)->when($range, fn (Builder $q) => $q->whereBetween('created_at', $range));

        $all = $this->aggregate($period, null, $now)->first() ?? $this->emptyMetrics();
        $byKanal = $this->aggregate($period, TicketIntake::kanalSql(), $now);
        $byRegion = $this->aggregate($period, 'tickets.region_id', $now);
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
                'rows' => $this->matrixRows($period, $sumbu, $now, $regionIds, $byKanal, $byRegion),
                'total' => $all,
            ],
            'dampak' => $this->impactRows($period, $now),
            'kanal' => $this->kanalRows($byKanal),
            'kawasan' => $this->regionRows($byRegion, $regionIds),
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

    /* ----------------------------- Matriks ----------------------------- */

    /** @return list<array<string, mixed>> */
    private function matrixRows(Builder $period, string $sumbu, CarbonInterface $now, ?array $regionIds, Collection $byKanal, Collection $byRegion): array
    {
        return match ($sumbu) {
            'kawasan' => $this->regionMatrix($byRegion, $regionIds),
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

    private function regionMatrix(Collection $data, ?array $regionIds): array
    {
        $rows = array_map(
            fn (Region $r) => $this->row((string) $r->id, $r->name, ['region_id' => (string) $r->id], $data[(string) $r->id] ?? $this->emptyMetrics(), 'kawasan'),
            $this->regions($data, $regionIds),
        );

        if ($data->has('')) {
            $rows[] = $this->row('', 'Tanpa kawasan', null, $data[''], 'kawasan');
        }

        return $rows;
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

    /** @return list<Region> */
    private function regions(Collection $data, ?array $regionIds): array
    {
        $ids = $data->keys()->filter()->map(fn ($id) => (int) $id)->values()->all();

        return Region::query()
            ->when(
                $regionIds !== null,
                fn ($q) => $q->whereKey($regionIds),
                fn ($q) => $q->where(fn ($w) => $w->where('is_active', true)->orWhereIn('id', $ids)),
            )
            ->orderBy('id')
            ->get(['id', 'name'])
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

    /** @return list<array{id: int|null, label: string, total: int, ews: int}> */
    private function regionRows(Collection $byRegion, ?array $regionIds): array
    {
        $rows = collect($this->regions($byRegion, $regionIds))
            ->map(fn (Region $r) => [
                'id' => $r->id,
                'label' => $r->name,
                'total' => $byRegion[(string) $r->id]['total'] ?? 0,
                'ews' => $byRegion[(string) $r->id]['ews'] ?? 0,
            ]);

        if ($byRegion->has('')) {
            $rows->push(['id' => null, 'label' => 'Tanpa kawasan', 'total' => $byRegion['']['total'], 'ews' => $byRegion['']['ews']]);
        }

        return $rows->sortByDesc('total')->values()->all();
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
                'kawasan' => $t->region?->name,
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
