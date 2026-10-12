<?php

namespace App\Services;

use App\Enums\TicketStatus;
use App\Models\Category;
use App\Models\Channel;
use App\Models\Ticket;

/**
 * Agregat statistik untuk halaman publik (Beranda, Data SIGAP, Peta).
 * Semua angka dihitung dari tiket PUBLIK nyata — bukan angka dummy (paritas
 * tampilan lama tetap terjaga, tetapi datanya benar).
 */
class StatsService
{
    /**
     * Ringkasan untuk Beranda & Data Terbuka.
     *
     * @return array<string, mixed>
     */
    public function publicOverview(): array
    {
        $public = Ticket::query()->public();

        $total = (clone $public)->count();
        $byStatus = [];
        foreach (TicketStatus::cases() as $status) {
            $byStatus[$status->value] = (clone $public)->where('status', $status->value)->count();
        }

        $today = (clone $public)->whereDate('created_at', today())->count();
        $thisMonth = (clone $public)->whereBetween('created_at', [now()->startOfMonth(), now()])->count();

        // Distribusi per kategori (top 5).
        $byCategory = Category::query()
            ->withCount(['tickets as total' => fn ($q) => $q->public()])
            ->orderByDesc('total')
            ->limit(5)
            ->get()
            ->map(fn ($c) => ['name' => $c->name, 'total' => $c->total])
            ->values();

        // Distribusi per kanal.
        $byChannel = Channel::query()
            ->withCount(['tickets as total' => fn ($q) => $q->public()])
            ->orderByDesc('total')
            ->get()
            ->map(fn ($c) => ['name' => $c->name, 'total' => $c->total])
            ->values();

        $sla = $this->slaPercentage();

        return [
            'total' => $total,
            'by_status' => $byStatus,
            'today' => $today,
            'this_month' => $thisMonth,
            'by_category' => $byCategory,
            'by_channel' => $byChannel,
            'sla_pct' => $sla,
            'ews' => (clone $public)
                ->whereIn('status', [TicketStatus::Baru->value, TicketStatus::Verifikasi->value, TicketStatus::Diproses->value])
                ->whereNotNull('sla_due_at')
                ->where('sla_due_at', '<', now())
                ->count(),
            'kanal_count' => Channel::query()->count(),
        ];
    }

    /** Persentase tiket selesai yang tepat waktu (memperbaiki B3). */
    public function slaPercentage(): float
    {
        $finished = Ticket::query()
            ->public()
            ->where('status', TicketStatus::Selesai->value)
            ->whereNotNull('sla_due_at')
            ->get(['sla_due_at', 'resolved_at']);

        if ($finished->isEmpty()) {
            return 100.0;
        }

        $met = $finished->filter(
            fn ($t) => $t->resolved_at && $t->resolved_at->lessThanOrEqualTo($t->sla_due_at)
        )->count();

        return round($met / $finished->count() * 100, 1);
    }
}