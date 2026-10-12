<?php

namespace App\Console\Commands;

use App\Enums\TicketStatus;
use App\Models\Setting;
use App\Models\Ticket;
use App\Services\NotificationService;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * Pemeriksaan EWS (Early Warning System) — tiket publik yang melewati SLA
 * dan belum selesai. Dijadwalkan harian; diaktifkan lewat pengaturan
 * `ews_enabled` (PRD FR-06 / TECH-SPEC §11.2).
 *
 * D-07:
 * - setiap tiket hanya diperingatkan SEKALI per pelanggaran (kolom
 *   `ews_notified_at`; direset bila tiket dibuka kembali);
 * - setiap admin menerima SATU ringkasan (digest) berisi tiket yang menjadi
 *   wewenangnya, bukan satu notifikasi per tiket;
 * - default `ews_enabled` = aktif, sama dengan tampilan halaman Pengaturan.
 */
class EwsCheckCommand extends Command
{
    protected $signature = 'sigap:ews-check';

    protected $description = 'Periksa tiket yang melewati SLA dan kirim peringatan EWS';

    /** Batas jumlah tiket yang dirinci dalam satu ringkasan. */
    private const DIGEST_LIMIT = 20;

    public function __construct(private readonly NotificationService $notifications)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        if (! Setting::get('ews_enabled', true)) {
            $this->line('EWS dinonaktifkan pada pengaturan — dilewati.');

            return self::SUCCESS;
        }

        // Tiket internal ikut dipantau; penerimanya hanya super admin
        // (NotificationService::recipientsFor).
        $overdue = Ticket::query()
            ->whereIn('status', [
                TicketStatus::Baru->value,
                TicketStatus::Verifikasi->value,
                TicketStatus::Diproses->value,
            ])
            ->whereNotNull('sla_due_at')
            ->where('sla_due_at', '<', now())
            ->whereNull('ews_notified_at')
            ->orderBy('sla_due_at')
            ->get();

        if ($overdue->isEmpty()) {
            $this->info('Tidak ada tiket melewati SLA.');

            return self::SUCCESS;
        }

        // Kelompokkan tiket per admin penerima (super admin + admin kawasan).
        $digests = [];
        foreach ($overdue as $ticket) {
            foreach ($this->notifications->recipientsFor($ticket) as $admin) {
                $digests[$admin->id] ??= ['user' => $admin, 'tickets' => collect()];
                $digests[$admin->id]['tickets']->push($ticket);
            }
        }

        foreach ($digests as $digest) {
            try {
                $this->notifications->notify($this->digestPayload($digest['tickets']), $digest['user']);
            } catch (\Throwable $e) {
                Log::warning('EWS gagal dikirim', ['user' => $digest['user']->id, 'error' => $e->getMessage()]);
            }
        }

        Ticket::query()
            ->whereKey($overdue->modelKeys())
            ->update(['ews_notified_at' => now()]);

        $this->warn("{$overdue->count()} tiket melewati SLA — ringkasan dikirim ke ".count($digests).' admin.');

        return self::SUCCESS;
    }

    /**
     * @param  Collection<int, Ticket>  $tickets
     * @return array<string, mixed>
     */
    private function digestPayload(Collection $tickets): array
    {
        $count = $tickets->count();
        $lines = $tickets->take(self::DIGEST_LIMIT)->map(function (Ticket $t) {
            $late = now()->diffForHumans($t->sla_due_at, true);

            return "• {$t->ticket_no} — {$t->title} (terlambat {$late})";
        });

        if ($count > self::DIGEST_LIMIT) {
            $lines->push('… dan '.($count - self::DIGEST_LIMIT).' tiket lainnya.');
        }

        $body = "{$count} tiket melewati tenggat SLA dan belum selesai:\n".$lines->implode("\n");

        return [
            'event' => 'ews',
            'nomor' => $count === 1 ? $tickets->first()->ticket_no : null,
            'tickets' => $tickets->pluck('ticket_no')->all(),
            'message' => $body,
            'subject' => "[SIGAP] Peringatan EWS — {$count} tiket melewati SLA",
            'title' => 'Peringatan EWS',
            'body' => $body,
            'cta_url' => '/admin/matriks',
            'cta_label' => 'Buka matriks',
            'meta' => [
                'Jumlah tiket' => (string) $count,
            ],
        ];
    }
}
