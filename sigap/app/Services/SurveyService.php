<?php

namespace App\Services;

use App\Enums\TicketStatus;
use App\Models\Survey;
use App\Models\Ticket;
use App\Models\User;
use App\Support\SurveyQuestionnaire;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Survei kepuasan (A-07) — aturan yang SAMA untuk jalur Web & API:
 * - hanya untuk tiket berstatus Selesai;
 * - satu survei per tiket (survei kedua ditolak, tidak menimpa);
 * - tiket milik akun warga hanya boleh dinilai oleh pemiliknya yang login.
 *
 * Kuesioner skala 1–4 (SurveyQuestionnaire). Masalah yang belum/sebagian
 * teratasi dengan permintaan tinjau ulang, atau jawaban "belum teratasi" /
 * kepuasan keseluruhan 1–2, menandai tiket untuk ditinjau petugas; status
 * tiket tetap Selesai sampai petugas memutuskan membukanya kembali.
 */
class SurveyService
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly AuditService $audit,
    ) {}

    /** Survei boleh diisi oleh yang sedang melihat tiket ini? */
    public static function canFill(Ticket $ticket, ?User $viewer): bool
    {
        return $ticket->reporter_id === null || $viewer?->id === $ticket->reporter_id;
    }

    /**
     * @param  array<string, mixed>  $data  isian tervalidasi StoreSurveyRequest
     *
     * @throws ValidationException
     * @throws AuthorizationException
     */
    public function submit(Ticket $ticket, ?User $viewer, array $data): Survey
    {
        if (! self::canFill($ticket, $viewer)) {
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

        $answers = array_map('intval', array_intersect_key($data['jawaban'], SurveyQuestionnaire::ASPECTS));
        $overall = (int) $data['keseluruhan'];
        $resolved = (string) $data['teratasi'];
        $reason = match (true) {
            in_array($resolved, SurveyQuestionnaire::UNRESOLVED, true) && (bool) ($data['tinjau_ulang'] ?? false) => Ticket::REVIEW_REQUESTED,
            $resolved === 'belum' || $overall <= 2 => Ticket::REVIEW_LOW_SCORE,
            default => null,
        };

        try {
            $survey = DB::transaction(function () use ($ticket, $data, $answers, $overall, $resolved, $reason) {
                $survey = Survey::create([
                    'ticket_id' => $ticket->id,
                    'version' => SurveyQuestionnaire::VERSION,
                    'answers' => $answers,
                    'overall' => $overall,
                    'resolved' => $resolved,
                    'reuse' => (int) $data['kembali'],
                    'good_feedback' => self::clean($data['baik'] ?? null),
                    'improve_feedback' => self::clean($data['perbaikan'] ?? null),
                    'age_group' => $data['usia'] ?? null,
                    'education' => $data['pendidikan'] ?? null,
                    'occupation' => $data['pekerjaan'] ?? null,
                    'skm_index' => SurveyQuestionnaire::index($answers),
                ]);

                if ($reason !== null) {
                    $ticket->forceFill(['review_requested_at' => now(), 'review_reason' => $reason, 'reviewed_at' => null, 'reviewed_by' => null])->save();
                }

                return $survey;
            });
        } catch (UniqueConstraintViolationException) {
            throw $this->alreadySubmitted();
        }

        if ($reason !== null) {
            $label = Ticket::REVIEW_REASONS[$reason];
            $this->audit->safe('ticket.review_requested', $ticket, "Tiket {$ticket->ticket_no} ditandai tinjau ulang: {$label}.", ['alasan' => $reason]);
            $this->notifications->notifyTicket($ticket, 'tinjau_ulang', "{$label}. Hasil survei: ".SurveyQuestionnaire::RESOLVED['pilihan'][$resolved].', kepuasan '.$overall.'/4.');
        }

        return $survey;
    }

    private static function clean(mixed $text): ?string
    {
        $text = is_string($text) ? trim($text) : '';

        return $text === '' ? null : $text;
    }

    private function alreadySubmitted(): ValidationException
    {
        return ValidationException::withMessages([
            'ticket' => 'Survei untuk tiket ini sudah pernah diisi.',
        ]);
    }
}
