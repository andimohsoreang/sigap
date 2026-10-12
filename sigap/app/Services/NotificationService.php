<?php

namespace App\Services;

use App\Contracts\NotificationChannel;
use App\Enums\TicketStatus;
use App\Models\Setting;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Orkestrator notifikasi (TECH-SPEC §7b — D10).
 *
 * Menyusun payload, memilih penerima, lalu mengirimnya ke semua driver yang
 * aktif pada `config('notifications.channels')`. Kegagalan satu driver tidak
 * boleh menggagalkan proses bisnis — dicatat sebagai warning dan dilanjutkan.
 *
 * WhatsApp tidak pernah dipanggil karena tidak ada driver-nya.
 */
class NotificationService
{
    /** @var array<string, NotificationChannel>|null */
    private ?array $channels = null;

    /** @param array<string, mixed>|null $payload */
    public function notify(?array $payload, ?User $recipient = null): void
    {
        if ($payload === null) {
            return;
        }

        $recipients = $recipient !== null
            ? collect([$recipient])
            : $this->defaultRecipients();

        foreach ($recipients as $user) {
            foreach ($this->channels() as $channel) {
                try {
                    $channel->send($user, $payload);
                } catch (\Throwable $e) {
                    Log::warning('Gagal mengirim notifikasi', [
                        'channel' => $channel->name(),
                        'user' => $user->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }
    }

    /** Payload untuk tiket baru / status berubah / EWS. */
    public function ticketPayload(Ticket $ticket, string $event, string $message = ''): array
    {
        $status = $ticket->status instanceof TicketStatus ? $ticket->status->value : (string) $ticket->status;

        return [
            'event' => $event,
            'nomor' => $ticket->ticket_no,
            'judul' => $ticket->title,
            'status' => $status,
            'impact' => $ticket->impact?->value,
            'is_internal' => (bool) $ticket->is_internal,
            'created_at' => $ticket->created_at?->toIso8601String(),
            'message' => $message,
            'subject' => "[SIGAP] {$ticket->ticket_no} — {$ticket->title}",
            'title' => "Tiket {$ticket->ticket_no}",
            'body' => $message !== '' ? $message : "Status: {$status}",
            'cta_url' => '/admin/tiket/'.$ticket->ticket_no,
            'cta_label' => 'Buka tiket',
            'meta' => [
                'Status' => $status,
                'Dampak' => $ticket->impact?->label() ?? '-',
            ],
        ];
    }

    /** Penerima default: PIC pengaturan + admin aktif + pelapor tiket. */
    private function defaultRecipients()
    {
        $users = User::query()
            ->where('is_active', true)
            ->whereIn('role', ['admin_kawasan', 'super_admin'])
            ->get();

        return $users;
    }

    /** @return array<string, NotificationChannel> */
    private function channels(): array
    {
        if ($this->channels !== null) {
            return $this->channels;
        }

        $config = config('notifications.channels', []);
        $this->channels = [];

        foreach ($config as $key => $class) {
            if (! is_string($class) || ! class_exists($class)) {
                continue;
            }

            try {
                $this->channels[$key] = app($class);
            } catch (\Throwable $e) {
                Log::warning('Driver notifikasi tidak dapat diinisialisasi', [
                    'channel' => $key,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $this->channels;
    }

    /** Preferensi pengaturan (pic_email/pic_phone/whatsapp_enabled). */
    public static function settings(): array
    {
        $value = Setting::get('notification', []);

        return is_array($value) ? $value : [];
    }
}