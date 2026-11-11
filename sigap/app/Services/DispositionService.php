<?php

namespace App\Services;

use App\Enums\TicketStatus;
use App\Models\Ticket;
use App\Models\TicketDisposition;
use App\Models\Unit;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Disposisi tiket ke Unit Kerja oleh Super Admin (PRD-UNIT-KERJA F2).
 *
 * Aturan:
 * - Paling banyak SATU disposisi aktif (menunggu/diterima) per tiket; dijaga
 *   dengan transaksi + kunci baris tiket.
 * - Mendisposisikan tiket yang sudah punya disposisi aktif = MENGALIHKAN:
 *   disposisi lama ditutup "ditarik", lalu dibuat disposisi baru.
 * - Tiket yang sudah selesai/ditolak tidak bisa didisposisikan.
 * - `tickets.unit_id` selalu mengikuti unit disposisi aktif.
 */
class DispositionService
{
    public function __construct(private readonly AuditService $audit) {}

    public function dispose(Ticket $ticket, Unit $unit, User $actor, ?string $note = null, ?CarbonInterface $dueAt = null): TicketDisposition
    {
        if (! $unit->is_active) {
            throw ValidationException::withMessages(['unit_id' => 'Unit kerja sudah nonaktif.']);
        }

        [$disposition, $previous] = DB::transaction(function () use ($ticket, $unit, $actor, $note, $dueAt) {
            /** @var Ticket $locked */
            $locked = Ticket::query()->whereKey($ticket->getKey())->lockForUpdate()->firstOrFail();

            if ($locked->status instanceof TicketStatus && ! $locked->status->isOpen()) {
                throw ValidationException::withMessages(['unit_id' => 'Tiket yang sudah selesai atau ditolak tidak dapat didisposisikan.']);
            }

            $previous = TicketDisposition::query()->where('ticket_id', $locked->id)->active()->lockForUpdate()->first();
            if ($previous?->unit_id === $unit->id) {
                throw ValidationException::withMessages(['unit_id' => 'Tiket sudah didisposisikan ke unit ini.']);
            }

            $now = Carbon::now();
            $previous?->update(['status' => TicketDisposition::STATUS_WITHDRAWN, 'closed_at' => $now, 'closed_by' => $actor->id]);

            $disposition = TicketDisposition::create([
                'ticket_id' => $locked->id,
                'unit_id' => $unit->id,
                'assigned_by' => $actor->id,
                'status' => TicketDisposition::STATUS_WAITING,
                'note' => self::clean($note),
                'due_at' => $dueAt,
            ]);

            $locked->forceFill(['unit_id' => $unit->id, 'disposed_at' => $now])->save();
            $ticket->setRawAttributes($locked->getAttributes(), true);

            return [$disposition, $previous];
        });

        $this->audit->safe(
            $previous ? 'ticket.redirected' : 'ticket.disposed',
            $ticket,
            $previous
                ? "Disposisi tiket {$ticket->ticket_no} dialihkan ke {$unit->name}."
                : "Tiket {$ticket->ticket_no} didisposisikan ke {$unit->name}.",
            ['unit' => $unit->code, 'dari_unit' => $previous?->unit?->code],
        );

        return $disposition;
    }

    /** Tarik disposisi aktif: tiket kembali ke antrean "Belum didisposisi". */
    public function withdraw(Ticket $ticket, User $actor, ?string $reason = null): void
    {
        $withdrawn = DB::transaction(function () use ($ticket, $actor, $reason) {
            /** @var Ticket $locked */
            $locked = Ticket::query()->whereKey($ticket->getKey())->lockForUpdate()->firstOrFail();
            $active = TicketDisposition::query()->where('ticket_id', $locked->id)->active()->lockForUpdate()->first();

            if ($active === null) {
                throw ValidationException::withMessages(['disposisi' => 'Tiket ini tidak sedang didisposisikan.']);
            }

            $active->update([
                'status' => TicketDisposition::STATUS_WITHDRAWN,
                'closed_at' => Carbon::now(),
                'closed_by' => $actor->id,
                'return_reason' => self::clean($reason),
            ]);
            $locked->forceFill(['unit_id' => null, 'disposed_at' => null])->save();
            $ticket->setRawAttributes($locked->getAttributes(), true);

            return $active;
        });

        $this->audit->safe('ticket.withdrawn', $ticket, "Disposisi tiket {$ticket->ticket_no} ke {$withdrawn->unit?->name} ditarik.", [
            'unit' => $withdrawn->unit?->code,
        ]);
    }

    /**
     * Dipanggil {@see TicketService::changeStatus} di dalam transaksinya saat
     * tiket ditutup (selesai/ditolak): disposisi aktif ikut selesai. Unit
     * penangan tetap tercatat di tiket.
     */
    public static function closeActive(Ticket $ticket, ?User $actor): void
    {
        TicketDisposition::query()->where('ticket_id', $ticket->id)->active()->update([
            'status' => TicketDisposition::STATUS_DONE,
            'closed_at' => Carbon::now(),
            'closed_by' => $actor?->id,
        ]);
    }

    private static function clean(?string $text): ?string
    {
        $text = trim((string) $text);

        return $text === '' ? null : $text;
    }
}
