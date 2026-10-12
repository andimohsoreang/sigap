<?php

namespace App\Services;

use App\Enums\TicketStatus;
use App\Models\Survey;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Validation\ValidationException;

/**
 * Survei kepuasan (A-07) — aturan yang SAMA untuk jalur Web & API:
 * - hanya untuk tiket berstatus Selesai;
 * - satu survei per tiket (survei kedua ditolak, tidak menimpa);
 * - tiket milik akun warga hanya boleh dinilai oleh pemiliknya yang login.
 */
class SurveyService
{
    /**
     * @param  array{rating: int|string, comment?: string|null}  $data
     *
     * @throws ValidationException
     * @throws AuthorizationException
     */
    public function submit(Ticket $ticket, ?User $viewer, array $data): Survey
    {
        if ($ticket->reporter_id !== null && $viewer?->id !== $ticket->reporter_id) {
            throw new AuthorizationException('Survei hanya dapat diisi oleh pelapor tiket ini. Silakan masuk terlebih dahulu.');
        }

        if ($ticket->status !== TicketStatus::Selesai) {
            throw ValidationException::withMessages([
                'ticket' => 'Survei hanya untuk tiket yang telah selesai.',
            ]);
        }

        if ($ticket->survey()->exists()) {
            throw $this->alreadySubmitted();
        }

        try {
            return Survey::create([
                'ticket_id' => $ticket->id,
                'rating' => (int) $data['rating'],
                'comment' => $data['comment'] ?? null,
            ]);
        } catch (UniqueConstraintViolationException) {
            throw $this->alreadySubmitted();
        }
    }

    private function alreadySubmitted(): ValidationException
    {
        return ValidationException::withMessages([
            'ticket' => 'Survei untuk tiket ini sudah pernah diisi.',
        ]);
    }
}
