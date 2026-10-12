<?php

namespace App\Services;

use App\Enums\TicketImpact;
use App\Enums\TicketStatus;
use App\Events\TicketChanged;
use App\Models\Ticket;
use App\Models\TicketHistory;
use App\Models\TicketReply;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Logika bisnis tiket. Dipakai BERSAMA oleh controller Web (Inertia) dan
 * controller Api/V1 (PRD §4.3) — tidak ada logika bisnis di controller.
 */
class TicketService
{
    public function __construct(
        private readonly SlaCalculator $sla,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * Buat tiket baru. Menghitung prioritas & SLA dari dampak, mencatat
     * riwayat awal, dan mengembalikan model.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Ticket
    {
        $ticket = DB::transaction(function () use ($data) {
            $impact = $data['impact'] instanceof TicketImpact
                ? $data['impact']
                : TicketImpact::from((string) $data['impact']);

            $now = Carbon::now();
            $isInternal = (bool) ($data['is_internal'] ?? false);

            $ticket = new Ticket;

            $ticket->fill([
                'ticket_no' => $this->nextTicketNo(),
                'title' => $data['title'],
                'description' => $data['description'],
                'status' => TicketStatus::Baru,
                'priority' => $this->sla->priorityFor($impact),
                'impact' => $impact,
                'visibility' => $data['visibility'] ?? 'publik',
                'latitude' => $data['latitude'] ?? null,
                'longitude' => $data['longitude'] ?? null,
                'attachment_path' => $data['attachment_path'] ?? null,
                'is_internal' => $isInternal,
                'category_id' => $data['category_id'] ?? null,
                'region_id' => $isInternal ? null : ($data['region_id'] ?? null),
                'channel_id' => $data['channel_id'] ?? null,
                'assignee_id' => $data['assignee_id'] ?? null,
                'reporter_id' => $data['reporter_id'] ?? null,
                'reporter_name' => $data['reporter_name'] ?? null,
                'reporter_nik' => $data['reporter_nik'] ?? null,
                'reporter_email' => $data['reporter_email'] ?? null,
                'reporter_phone' => $data['reporter_phone'] ?? null,
                // SLA: tiket internal mengikuti kebijakan tersendiri (bisa null),
                // tiket publik memakai tenggat dari dampak.
                'sla_due_at' => $isInternal ? null : $this->sla->dueAt($impact, $now),
            ]);

            $ticket->created_at = $now;
            $ticket->updated_at = $now;
            $ticket->save();

            TicketHistory::create([
                'ticket_id' => $ticket->id,
                'from_status' => null,
                'to_status' => TicketStatus::Baru->value,
                'actor_id' => $data['actor_id'] ?? null,
                'note' => $isInternal ? 'Laporan internal dibuat.' : 'Tiket dibuat oleh pelapor.',
            ]);

            return $ticket;
        });

        // Real-time bersifat best-effort: kegagalan Reverb tidak boleh
        // membatalkan tiket yang sudah tersimpan (PRD D5).
        $this->broadcastTicket($ticket, 'created');

        return $ticket;
    }

    /** Ubah status tiket dan catat riwayat. Idempoten jika status sama. */
    public function changeStatus(Ticket $ticket, TicketStatus $status, ?User $actor = null, ?string $note = null): Ticket
    {
        $changed = DB::transaction(function () use ($ticket, $status, $actor, $note) {
            $from = $ticket->status;

            if ($from === $status) {
                return $ticket;
            }

            $ticket->status = $status;

            if ($status !== TicketStatus::Baru && $ticket->responded_at === null) {
                $ticket->responded_at = Carbon::now();
            }

            if ($status === TicketStatus::Selesai && $ticket->resolved_at === null) {
                $ticket->resolved_at = Carbon::now();
            }

            if ($actor !== null && $ticket->assignee_id === null) {
                $ticket->assignee_id = $actor->id;
            }

            $ticket->save();

            TicketHistory::create([
                'ticket_id' => $ticket->id,
                'from_status' => $from instanceof TicketStatus ? $from->value : $from,
                'to_status' => $status->value,
                'actor_id' => $actor?->id,
                'note' => $note,
            ]);

            return $ticket;
        });

        if ($changed->wasChanged()) {
            $this->broadcastTicket($changed, 'status', $note);
        }

        return $changed;
    }

    /**
     * Siarkan perubahan tiket & kirim notifikasi (best-effort).
     *
     * Reverb (in-app, PRD D5) dan email (D10) tidak boleh membatalkan transaksi
     * yang sudah tersimpan, jadi kegagalan keduanya hanya dicatat.
     */
    private function broadcastTicket(Ticket $ticket, string $event, ?string $message = null): void
    {
        try {
            TicketChanged::dispatch($ticket, $event);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Broadcast tiket gagal: '.$e->getMessage());
        }

        if (in_array($event, ['created', 'status', 'ews'], true)) {
            try {
                $this->notifications->notify(
                    $this->notifications->ticketPayload($ticket, $event, (string) $message)
                );
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('Notifikasi tiket gagal: '.$e->getMessage());
            }
        }
    }

    /** Tambah tanggapan admin/petugas. */
    public function reply(Ticket $ticket, string $body, ?User $author = null, bool $isPublic = true): TicketReply
    {
        return DB::transaction(function () use ($ticket, $body, $author, $isPublic) {
            $reply = TicketReply::create([
                'ticket_id' => $ticket->id,
                'author_id' => $author?->id,
                'body' => $body,
                'is_public' => $isPublic,
            ]);

            $ticket->touch();

            return $reply;
        });
    }

    /**
     * Nomor tiket berurutan dengan format TKT-<n>. Memakai MAX(id)+1 efektif
     * di dalam transaksi; unik dijaga oleh constraint DB.
     */
    private function nextTicketNo(): string
    {
        $last = Ticket::query()->lockForUpdate()->max('id') ?? 0;

        return 'TKT-'.($last + 1);
    }
}