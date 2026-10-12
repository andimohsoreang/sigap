<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Ticket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class DashboardController extends Controller
{
    /**
     * GET /api/v1/admin/rekap — rekapitulasi matriks.
     *
     * Memperbaiki bug B3: `sla_pct` sebelumnya selalu 0. Rumus diperbaiki:
     * persentase tiket SELESAI yang diselesaikan tidak melewati tenggat SLA.
     */
    public function rekap(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Ticket::class);

        $query = $this->scoped(Ticket::query());

        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->date('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->date('to'));
        }
        if ($request->filled('region_id')) {
            $query->where('region_id', $request->integer('region_id'));
        }
        if ($request->filled('category_id')) {
            $query->where('category_id', $request->integer('category_id'));
        }

        $total = (clone $query)->count();

        $byStatus = [];
        foreach (TicketStatus::cases() as $status) {
            $byStatus[$status->value] = (clone $query)->where('status', $status->value)->count();
        }

        // EWS: tiket masih berjalan & melewati tenggat.
        $ews = (clone $query)
            ->whereIn('status', [TicketStatus::Baru->value, TicketStatus::Verifikasi->value, TicketStatus::Diproses->value])
            ->whereNotNull('sla_due_at')
            ->where('sla_due_at', '<', now())
            ->count();

        // SLA: dari tiket selesai yang punya tenggat.
        $finished = (clone $query)
            ->where('status', TicketStatus::Selesai->value)
            ->whereNotNull('sla_due_at')
            ->get(['sla_due_at', 'resolved_at']);

        $met = $finished->filter(fn ($t) => $t->resolved_at && $t->resolved_at->lessThanOrEqualTo($t->sla_due_at))->count();
        $slaPct = $finished->count() > 0 ? round($met / $finished->count() * 100, 1) : 100.0;

        return response()->json([
            'total' => $total,
            'byStatus' => $byStatus,
            'ews' => $ews,
            'sla_pct' => $slaPct,
        ]);
    }

    private function scoped($query)
    {
        $user = Auth::user();

        if ($user->role === UserRole::AdminKawasan) {
            $query->where('region_id', $user->region_id);
        }

        return $query;
    }
}