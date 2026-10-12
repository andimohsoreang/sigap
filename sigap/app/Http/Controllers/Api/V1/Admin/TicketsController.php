<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\TicketStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateTicketStatusRequest;
use App\Http\Resources\V1\TicketAdminResource;
use App\Http\Resources\V1\TicketResource;
use App\Models\Ticket;
use App\Services\TicketService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class TicketsController extends Controller
{
    public function __construct(private readonly TicketService $tickets) {}

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
            $term = '%'.$request->string('q').'%';
            $query->where(fn ($q) => $q->where('title', 'like', $term)->orWhere('description', 'like', $term));
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
    public function show(string $ticketNo): TicketResource|JsonResponse
    {
        $ticket = $this->findScoped($ticketNo);

        if (! $ticket) {
            return response()->json(['error' => 'Tiket tidak ditemukan.'], 404);
        }

        $this->authorize('view', $ticket);

        $ticket->load(['category', 'region', 'channel', 'assignee', 'histories.actor', 'replies.author']);

        return new TicketResource($ticket);
    }

    /** POST /api/v1/admin/tickets/{ticket_no}/status */
    public function updateStatus(UpdateTicketStatusRequest $request, string $ticketNo): TicketResource|JsonResponse
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

        $ticket->load(['category', 'region', 'assignee', 'histories', 'replies.author']);

        return new TicketResource($ticket);
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

        return response()->json($reply, 201);
    }

    /** GET /api/v1/admin/tiket-internal */
    public function internal(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Ticket::class);

        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        $paginator = Ticket::query()->internal()->latest()->paginate($perPage);

        $resolved = Ticket::query()->internal()->where('status', TicketStatus::Selesai);
        $avgHours = $resolved->clone()
            ->whereNotNull('resolved_at')
            ->get()
            ->avg(fn ($t) => $t->created_at->diffInHours($t->resolved_at));

        return response()->json([
            'data' => $paginator->getCollection()->map(fn (Ticket $t) => [
                'id' => $t->ticket_no,
                'nama' => $t->reporter_name,
                'unit' => null,
                'kategori' => $t->category?->name,
                'lokasi' => null,
                'urgensi' => $t->impact?->label(),
                'status' => $t->status?->value,
                'created_at' => $t->created_at?->toIso8601String(),
            ])->values(),
            'stats' => [
                'today' => Ticket::query()->internal()->whereDate('created_at', today())->count(),
                'this_month' => Ticket::query()->internal()->whereMonth('created_at', now()->month)->count(),
                'top_category' => 'Internet / Jaringan',
                'avg_resolution_hours' => round((float) $avgHours, 1),
            ],
            'meta' => [
                'total' => $paginator->total(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
            ],
        ]);
    }

    /** Batasi query sesuai peran (SEC-07). */
    private function scoped($query)
    {
        $user = Auth::user();

        if ($user->isAdmin() && ! $user->isSuperAdmin()) {
            $query->where('region_id', $user->region_id);
        }

        return $query;
    }

    private function findScoped(string $ticketNo): ?Ticket
    {
        return $this->scoped(Ticket::query())->where('ticket_no', strtoupper($ticketNo))->first();
    }
}