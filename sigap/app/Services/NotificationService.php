<?php

namespace App\Services;

use App\Contracts\NotificationChannel;
use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\Setting;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * Orkestrator notifikasi (TECH-SPEC §7b — D10).
 *
 * Menyusun payload, memilih penerima, lalu mengirimnya ke semua driver yang
 * aktif pada `config('notifications.channels')`. Kegagalan satu driver tidak
 * boleh menggagalkan proses bisnis — dicatat sebagai warning dan dilanjutkan.
 *
 * A-06: penerima notifikasi tiket dibatasi sesuai wewenang (SEC-07):
 * super admin aktif + admin kawasan aktif pada kawasan tiket. Tiket internal
 * (tanpa kawasan) hanya ke super admin.
 *
 * WhatsApp tidak pernah dipanggil karena tidak ada driver-nya.
 */
class NotificationService
{
    /** @var array<string, NotificationChannel>|null */
    private ?array $channels = null;

    /**
     * Kirim payload ke penerima tertentu (satu user atau koleksi user).
     *
     * @param  array<string, mixed>|null  $payload
     * @param  User|iterable<User>  $recipients
     */
    public function notify(?array $payload, User|iterable $recipients): void
    {
        if ($payload === null) {
            return;
        }

        $recipients = $recipients instanceof User ? [$recipients] : $recipients;

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

    /** Notifikasi perubahan tiket ke penerima yang berwenang atas tiket itu. */
    public function notifyTicket(Ticket $ticket, string $event, string $message = ''): void
    {
        $this->notify($this->ticketPayload($ticket, $event, $message), $this->recipientsFor($ticket));
    }

    /**
     * Penerima notifikasi untuk sebuah tiket: super admin aktif + admin
     * kawasan aktif di kawasan tiket (tiket internal: super admin saja).
     *
     * @return Collection<int, User>
     */
    public function recipientsFor(Ticket $ticket): Collection
    {
        return User::query()
            ->where('is_active', true)
            ->where(function ($q) use ($ticket) {
                $q->where('role', UserRole::SuperAdmin->value);

                if (! $ticket->is_internal && $ticket->region_id !== null) {
                    $q->orWhere(fn ($q) => $q
                        ->where('role', UserRole::AdminKawasan->value)
                        ->where('region_id', $ticket->region_id));
                }
            })
            ->orderBy('id')
            ->get();
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
