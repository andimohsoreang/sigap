<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSurveyRequest;
use App\Models\Ticket;
use App\Models\Survey;
use Illuminate\Http\JsonResponse;

class SurveiController extends Controller
{
    /** POST /api/v1/survei/{ticket_no} — survei kepuasan. */
    public function store(StoreSurveyRequest $request, string $ticketNo): JsonResponse
    {
        $ticket = Ticket::query()->public()->where('ticket_no', strtoupper($ticketNo))->first();

        if (! $ticket) {
            return response()->json(['error' => 'Tiket tidak ditemukan.'], 404);
        }

        Survey::updateOrCreate(
            ['ticket_id' => $ticket->id],
            [
                'rating' => $request->validated('rating'),
                'comment' => $request->validated('comment'),
            ],
        );

        return response()->json(['ok' => true], 201);
    }
}