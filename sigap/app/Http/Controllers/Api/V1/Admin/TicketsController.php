<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\TicketStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateTicketStatusRequest;
use App\Http\Resources\V1\TicketAdminDetailResource;
use App\Http\Resources\V1\TicketAdminResource;
use App\Models\Ticket;
use App\Services\AuditService;
use App\Services\StatsService;
use App\Services\TicketService;
use App\Support\Search;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class TicketsController extends Controller
{
    public function __construct(
        private readonly TicketService $tickets,
        private readonly StatsService $stats,
        private readonly AuditService $audit,
    ) {}

    /** GET /api/v1/admin/tickets */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Ticket::class);

        $query = $this->scoped(Ticket::query()->with(['category', 'region']));

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('region_id')) {
            $query->where('region_id', $request->integer('region_id'));
        }
        if ($request->filled('category_id')) {
            $query->where('category_id', $request->integer('category_id'));
        }
        if ($request->filled('impact')) {
            $query->where('impact', $request->string('impact'));
        }
        if ($request->filled('q')) {
            Search::apply($query, ['title', 'description', 'ticket_no'], $request->string('q')->toString());
        }
        if ($request->filled('internal')) {
            $query->where('is_internal', $request->boolean('internal'));
        }

        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        $paginator = $query->latest()->paginate($perPage)->withQueryString();

        return response()->json([
            'data' => TicketAdminResource::collection($paginator->items()),
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    /** GET /api/v1/admin/tickets/{ticket_no} */
    public function show(string $ticketNo): TicketAdminDetailResource|JsonResponse
    {
        $ticket = $this->findScoped($ticketNo);

        if (! $ticket) {
            return response()->json(['error' => 'Tiket tidak ditemukan.'], 404);
        }

        $this->authorize('view', $ticket);

        $ticket->load(['category', 'region', 'channel', 'assignee', 'histories.actor', 'replies.author']);

        return new TicketAdminDetailResource($ticket);
    }

    /** POST /api/v1/admin/tickets/{ticket_no}/status */
    public function updateStatus(UpdateTicketStatusRequest $request, string $ticketNo): TicketAdminDetailResource|JsonResponse
    {
        $ticket = $this->findScoped($ticketNo);

        if (! $ticket) {
            return response()->json(['error' => 'Tiket tidak ditemukan.'], 404);
        }

        $this->authorize('update', $ticket);

        $ticket = $this->tickets->changeStatus(
            $ticket,
            TicketStatus::from($request->validated('status')),
            Auth::user(),
            $request->validated('note'),
        );

        $this->audit->safe('ticket.status_changed', $ticket, "Status tiket {$ticket->ticket_no} diubah (API).", [
            'status' => $request->validated('status'),
        ]);

        $ticket->load(['category', 'region', 'channel', 'assignee', 'histories.actor', 'replies.author']);

        return new TicketAdminDetailResource($ticket);
    }

    /** POST /api/v1/admin/tickets/{ticket_no}/tanggapan */
    public function reply(Request $request, string $ticketNo): JsonResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            'is_public' => ['nullable', 'boolean'],
        ]);

        $ticket = $this->findScoped($ticketNo);

        if (! $ticket) {
            return response()->json(['error' => 'Tiket tidak ditemukan.'], 404);
        }

        $this->authorize('reply', $ticket);

        $reply = $this->tickets->reply($ticket, $data['body'], Auth::user(), $data['is_public'] ?? true);

        $this->audit->safe('ticket.replied', $ticket, "Tanggapan pada tiket {$ticket->ticket_no} (API).");

        return response()->json($reply, 201);
    }

    /** GET /api/v1/admin/tiket-internal — super admin saja (A-05). */
    public function internal(Request $request): JsonResponse
    {
        $this->authorize('viewInternal', Ticket::class);

        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        $paginator = Ticket::query()->internal()->with('category')->latest()->paginate($perPage);

        $base = Ticket::query()->internal();

        $topCategory = (clone $base)
            ->select('category_id', DB::raw('count(*) as total'))
            ->whereNotNull('category_id')
            ->groupBy('category_id')
            ->orderByDesc('total')
            ->with('category')
            ->first();

        return response()->json([
            'data' => $paginator->getCollection()->map(fn (Ticket $t) => [
                'id' => $t->ticket_no,
                'nama' => $t->reporter_name,
                'nip' => $t->reporter_nip,
                'unit' => $t->reporter_unit,
                'kategori' => $t->category?->name,
                'lokasi' => $t->location,
                'urgensi' => $t->impact?->label(),
                'status' => $t->status?->value,
                'created_at' => $t->created_at?->toIso8601String(),
            ])->values(),
            'stats' => [
                'today' => $this->stats->todayCount($base),
                'this_month' => $this->stats->thisMonthCount($base),
                'top_category' => $topCategory?->category?->name ?? '—',
                'avg_resolution_hours' => $this->stats->averageResolutionHours($base),
            ],
            'meta' => [
                'total' => $paginator->total(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
            ],
        ]);
    }

    /** Batasi query sesuai peran (SEC-07) — aturan sama dengan panel web. */
    private function scoped($query)
    {
        return $query->visibleTo(Auth::user());
    }

    private function findScoped(string $ticketNo): ?Ticket
    {
        return $this->scoped(Ticket::query())->where('ticket_no', Ticket::normalizeNo($ticketNo))->first();
    }
}
