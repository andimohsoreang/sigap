<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\V1\TicketResource;
use App\Models\Ticket;
use App\Services\TicketService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TiketController extends Controller
{
    public function __construct(private readonly TicketService $tickets) {}

    /**
     * GET /api/v1/tiket/{ticket_no} — pelacakan publik.
     *
     * SEC-11 (B4): tiket internal tidak pernah dikembalikan. A-02: identitas
     * disamarkan; tiket rahasia hanya untuk pelapor/admin yang berwenang.
     */
    public function show(Request $request, string $ticketNo): JsonResponse|TicketResource
    {
        if (! Ticket::isValidNo($ticketNo)) {
            return response()->json(['error' => 'Format nomor tiket tidak valid.'], 400);
        }

        $ticket = $this->tickets->findForPublicLookup(
            $ticketNo,
            $request->user('sanctum'),
            ['category', 'region', 'channel', 'histories', 'replies'],
            // Nomor format lama: tamu wajib menyertakan ?kode=<kode akses>.
            mb_substr($request->string('kode')->trim()->toString(), 0, 16),
        );

        if (! $ticket) {
            return response()->json(['error' => 'Tiket tidak ditemukan.'], 404);
        }

        return new TicketResource($ticket);
    }
}
