<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\V1\TicketResource;
use App\Models\Ticket;
use Illuminate\Http\JsonResponse;

class TiketController extends Controller
{
    /**
     * GET /api/v1/tiket/{ticket_no} — pelacakan publik.
     *
     * SEC-11 (memperbaiki B4): tiket internal tidak pernah dikembalikan.
     */
    public function show(string $ticketNo): JsonResponse|TicketResource
    {
        if (! preg_match('/^TKT-\d+$/i', $ticketNo)) {
            return response()->json(['error' => 'Format nomor tiket tidak valid.'], 400);
        }

        $ticket = Ticket::query()
            ->public()
            ->with(['category', 'region', 'channel', 'assignee', 'histories', 'replies.author'])
            ->where('ticket_no', strtoupper($ticketNo))
            ->first();

        if (! $ticket) {
            return response()->json(['error' => 'Tiket tidak ditemukan.'], 404);
        }

        return new TicketResource($ticket);
    }
}