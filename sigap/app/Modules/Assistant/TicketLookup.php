<?php

namespace App\Modules\Assistant;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\User;
use App\Services\TicketService;

/** Nomor tiket di pesan warga dijawab langsung dengan statusnya (tanpa model). */
final class TicketLookup
{
    public function __construct(
        private readonly TicketService $tickets,
        private readonly ReplyComposer $composer,
    ) {}

    public function numberIn(string $text): ?string
    {
        return preg_match('/\bTKT-(?:\d{6}-[A-Z0-9]{6}|\d{1,10})\b/i', $text, $m) ? strtoupper($m[0]) : null;
    }

    public function reply(ChatConversation $conversation, string $ticketNo, ?User $viewer): ChatMessage
    {
        $ticket = $this->tickets->findForPublicLookup($ticketNo, $viewer, ['category', 'region']);

        if ($ticket === null) {
            return $this->composer->say($conversation, AssistantText::get('tiket_tidak_ditemukan', ['nomor' => $ticketNo]), ['kind' => 'info']);
        }

        return $this->composer->say($conversation, AssistantText::get('tiket_status', ['nomor' => $ticket->ticket_no, 'status' => (string) $ticket->status?->label()]), [
            'kind' => 'status_tiket',
            'tiket' => [
                'nomor' => $ticket->ticket_no,
                'status' => $ticket->status?->value,
                'status_label' => $ticket->status?->label(),
                'kategori' => $ticket->category?->name,
                'kawasan' => $ticket->region?->name,
                'tenggat' => $ticket->sla_due_at?->toIso8601String(),
                'diperbarui' => $ticket->updated_at?->toIso8601String(),
                'url' => '/lacak/'.$ticket->ticket_no,
            ],
        ]);
    }
}
