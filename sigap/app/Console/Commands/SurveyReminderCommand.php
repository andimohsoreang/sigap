<?php

namespace App\Console\Commands;

use App\Enums\TicketStatus;
use App\Models\Ticket;
use App\Services\ReporterNotifier;
use Illuminate\Console\Command;

/**
 * Satu kali pengingat survei kepuasan: tiket publik yang selesai sejak 3 hari
 * lalu dan belum disurvei. Tiket yang selesai lebih dari 14 hari lalu tidak
 * diingatkan lagi agar rilis pertama tidak mengirim surel ke laporan lama.
 */
class SurveyReminderCommand extends Command
{
    protected $signature = 'sigap:pengingat-survei';

    protected $description = 'Kirim satu pengingat survei kepuasan ke pelapor tiket yang selesai 3 hari lalu';

    public const AFTER_DAYS = 3;

    public const WINDOW_DAYS = 14;

    public function handle(ReporterNotifier $reporters): int
    {
        $sent = 0;

        Ticket::query()
            ->public()
            ->where('status', TicketStatus::Selesai->value)
            ->whereBetween('resolved_at', [now()->subDays(self::WINDOW_DAYS), now()->subDays(self::AFTER_DAYS)])
            ->whereNull('survey_reminded_at')
            ->whereDoesntHave('survey')
            ->with('reporter')
            ->chunkById(100, function ($tickets) use ($reporters, &$sent) {
                foreach ($tickets as $ticket) {
                    // Ditandai walau tanpa surel: pengingat memang hanya sekali per tiket.
                    $ticket->forceFill(['survey_reminded_at' => now()])->save();
                    $sent += $reporters->surveyReminder($ticket) ? 1 : 0;
                }
            });

        $this->line("{$sent} pengingat survei terkirim.");

        return self::SUCCESS;
    }
}
