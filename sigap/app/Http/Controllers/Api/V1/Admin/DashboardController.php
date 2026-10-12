<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Services\StatsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class DashboardController extends Controller
{
    public function __construct(private readonly StatsService $stats) {}

    /**
     * GET /api/v1/admin/rekap — rekapitulasi matriks.
     *
     * Memperbaiki bug B3: `sla_pct` sebelumnya selalu 0. Rumus diperbaiki:
     * persentase tiket SELESAI yang diselesaikan tidak melewati tenggat SLA.
     * D-05: seluruh angka dihitung dengan agregat SQL.
     */
    public function rekap(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Ticket::class);

        $query = Ticket::query()->visibleTo(Auth::user());

        if ($request->filled('from')) {
            $query->where('created_at', '>=', $request->date('from')->startOfDay());
        }
        if ($request->filled('to')) {
            $query->where('created_at', '<=', $request->date('to')->endOfDay());
        }
        if ($request->filled('region_id')) {
            $query->where('region_id', $request->integer('region_id'));
        }
        if ($request->filled('category_id')) {
            $query->where('category_id', $request->integer('category_id'));
        }

        $byStatus = $this->stats->statusCounts($query);

        return response()->json([
            'total' => array_sum($byStatus),
            'byStatus' => $byStatus,
            'ews' => $this->stats->overdueCount($query),
            'sla_pct' => $this->stats->slaPercentage($query),
        ]);
    }
}
