<?php

namespace App\Services;

use App\Enums\TicketStatus;
use App\Models\Category;
use App\Models\Channel;
use App\Models\Ticket;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;

/**
 * Agregat statistik tiket.
 *
 * D-05: semua angka dihitung dengan agregat SQL (COUNT/SUM/AVG) — tidak ada
 * lagi pemuatan seluruh tiket ke memori. Dipakai halaman publik (Beranda, Data
 * SIGAP) maupun panel admin/API (matriks, rekap, tiket internal) dengan
 * query yang sudah dibatasi sesuai peran.
 */
class StatsService
{
    public const PUBLIC_CACHE_KEY = 'stats:public-overview';

    public const PUBLIC_CACHE_TTL = 60;

    /**
     * Ringkasan untuk Beranda & Data Terbuka (cache 60 detik).
     *
     * @return array<string, mixed>
     */
    public function publicOverview(): array
    {
        return Cache::remember(self::PUBLIC_CACHE_KEY, self::PUBLIC_CACHE_TTL, fn () => $this->computePublicOverview());
    }

    /** @return array<string, mixed> */
    private function computePublicOverview(): array
    {
        $public = Ticket::query()->public();

        $byStatus = $this->statusCounts($public);

        // Distribusi per kategori (top 5).
        $byCategory = Category::query()
            ->withCount(['tickets as total' => fn ($q) => $q->public()])
            ->orderByDesc('total')
            ->limit(5)
            ->get()
            ->map(fn ($c) => ['name' => $c->name, 'total' => (int) $c->total])
            ->values();

        // Distribusi per kanal.
        $byChannel = Channel::query()
            ->withCount(['tickets as total' => fn ($q) => $q->public()])
            ->orderByDesc('total')
            ->get()
            ->map(fn ($c) => ['name' => $c->name, 'total' => (int) $c->total])
            ->values();

        return [
            'total' => array_sum($byStatus),
            'by_status' => $byStatus,
            'today' => $this->todayCount($public),
            'this_month' => $this->thisMonthCount($public),
            'by_category' => $byCategory,
            'by_channel' => $byChannel,
            'sla_pct' => $this->slaPercentage($public),
            'ews' => $this->overdueCount($public),
            'kanal_count' => Channel::query()->count(),
        ];
    }

    /**
     * Jumlah tiket per status (satu query GROUP BY). Semua status selalu ada.
     *
     * @return array<string, int>
     */
    public function statusCounts(Builder $query): array
    {
        $rows = (clone $query)
            ->reorder()
            ->toBase()
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        $counts = [];
        foreach (TicketStatus::cases() as $status) {
            $counts[$status->value] = (int) ($rows[$status->value] ?? 0);
        }

        return $counts;
    }

    /**
     * Persentase tiket selesai yang tepat waktu (B3, TECH-SPEC §3.3):
     * resolved_at <= sla_due_at dibanding semua tiket selesai ber-SLA.
     * 100 bila belum ada tiket selesai.
     */
    public function slaPercentage(?Builder $query = null): float
    {
        $query ??= Ticket::query()->public();

        $row = (clone $query)
            ->reorder()
            ->where('status', TicketStatus::Selesai->value)
            ->whereNotNull('sla_due_at')
            ->toBase()
            ->selectRaw('COUNT(*) as finished, SUM(CASE WHEN resolved_at IS NOT NULL AND resolved_at <= sla_due_at THEN 1 ELSE 0 END) as met')
            ->first();

        $finished = (int) ($row->finished ?? 0);

        if ($finished === 0) {
            return 100.0;
        }

        return round(((int) $row->met) / $finished * 100, 1);
    }

    /** Tiket berjalan yang melewati tenggat SLA (EWS). */
    public function overdueCount(Builder $query): int
    {
        return (clone $query)
            ->reorder()
            ->whereIn('status', [TicketStatus::Baru->value, TicketStatus::Verifikasi->value, TicketStatus::Diproses->value])
            ->whereNotNull('sla_due_at')
            ->where('sla_due_at', '<', now())
            ->count();
    }

    public function todayCount(Builder $query): int
    {
        return (clone $query)
            ->reorder()
            ->whereBetween('created_at', [now()->startOfDay(), now()->endOfDay()])
            ->count();
    }

    /** D-08: bulan berjalan pada TAHUN berjalan (bukan bulan yang sama tiap tahun). */
    public function thisMonthCount(Builder $query): int
    {
        return (clone $query)
            ->reorder()
            ->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->count();
    }

    /** Rata-rata durasi penyelesaian (jam) tiket selesai, dihitung di SQL. */
    public function averageResolutionHours(Builder $query): float
    {
        $driver = (clone $query)->getConnection()->getDriverName();

        $expression = match ($driver) {
            'pgsql' => 'AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600.0)',
            'mysql', 'mariadb' => 'AVG(TIMESTAMPDIFF(SECOND, created_at, resolved_at) / 3600.0)',
            'sqlsrv' => 'AVG(DATEDIFF(SECOND, created_at, resolved_at) / 3600.0)',
            default => 'AVG((julianday(resolved_at) - julianday(created_at)) * 24.0)',
        };

        $value = (clone $query)
            ->reorder()
            ->where('status', TicketStatus::Selesai->value)
            ->whereNotNull('resolved_at')
            ->toBase()
            ->selectRaw($expression.' as hours')
            ->value('hours');

        return round((float) $value, 1);
    }
}
