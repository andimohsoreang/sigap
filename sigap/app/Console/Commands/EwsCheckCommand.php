<?php

namespace App\Console\Commands;

use App\Enums\TicketStatus;
use App\Events\TicketChanged;
use App\Models\Setting;
use App\Models\Ticket;
use App\Services\NotificationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Pemeriksaan EWS (Early Warning System) — tiket publik yang melewati SLA
 * dan belum selesai. Dijadwalkan harian; diaktifkan lewat pengaturan
 * `ews_enabled` (PRD FR-06 / TECH-SPEC §11.2).
 */
class EwsCheckCommand extends Command
{
    protected $signature = 'sigap:ews-check';

    protected $description = 'Periksa tiket yang melewati SLA dan kirim peringatan EWS';

    public function __construct(private readonly NotificationService $notifications)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        if (! Setting::get('ews_enabled', false)) {
            $this->line('EWS dinonaktifkan pada pengaturan — dilewati.');

            return self::SUCCESS;
        }

        $overdue = Ticket::query()
            ->public()
            ->whereIn('status', [
                TicketStatus::Baru->value,
                TicketStatus::Verifikasi->value,
                TicketStatus::Diproses->value,
            ])
            ->whereNotNull('sla_due_at')
            ->where('sla_due_at', '<', now())
            ->orderBy('sla_due_at')
            ->get();

        if ($overdue->isEmpty()) {
            $this->info('Tidak ada tiket melewati SLA.');

            return self::SUCCESS;
        }

        foreach ($overdue as $ticket) {
            $late = now()->diffForHumans($ticket->sla_due_at, true);
            $message = "Tiket {$ticket->ticket_no} melewati tenggat SLA {$late} dan belum selesai.";

            try {
                TicketChanged::dispatch($ticket, 'ews');
                $this->notifications->notify(
                    $this->notifications->ticketPayload($ticket, 'ews', $message)
                );
            } catch (\Throwable $e) {
                Log::warning('EWS gagal dikirim', ['ticket' => $ticket->ticket_no, 'error' => $e->getMessage()]);
            }
        }

        $this->warn("{$overdue->count()} tiket melewati SLA — peringatan dikirim.");

        return self::SUCCESS;
    }
}