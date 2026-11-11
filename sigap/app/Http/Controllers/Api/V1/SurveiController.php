<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSurveyRequest;
use App\Services\SurveyService;
use App\Services\TicketService;
use App\Support\SurveyQuestionnaire;
use Illuminate\Http\JsonResponse;

class SurveiController extends Controller
{
    public function __construct(
        private readonly TicketService $tickets,
        private readonly SurveyService $surveys,
    ) {}

    /** GET /api/v1/survei/kuesioner — pertanyaan & pilihan jawaban survei kepuasan. */
    public function questionnaire(): JsonResponse
    {
        return response()->json(['versi' => SurveyQuestionnaire::VERSION] + SurveyQuestionnaire::forPage());
    }

    /** POST /api/v1/survei/{ticket_no} — survei kepuasan (A-07). */
    public function store(StoreSurveyRequest $request, string $ticketNo): JsonResponse
    {
        $viewer = $request->user('sanctum');
        $ticket = $this->tickets->findForPublicLookup($request->ticketNo(), $viewer, [], $request->accessCode());

        if (! $ticket) {
            return response()->json(['error' => 'Tiket tidak ditemukan.'], 404);
        }

        $this->surveys->submit($ticket, $viewer, $request->validated());

        return response()->json(['ok' => true], 201);
    }
}
