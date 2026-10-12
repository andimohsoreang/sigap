<?php

namespace App\Services\Notifications;

use App\Contracts\NotificationChannel;
use App\Mail\TicketNotificationMail;
use App\Models\User;
use Illuminate\Support\Facades\Mail;

/**
 * Driver EMAIL (TECH-SPEC §7b — D10).
 *
 * Mengirim ringkasan perubahan tiket ke surel penerima melalui Mailable.
 * Kegagalan SMTP tidak boleh membatalkan proses bisnis (dicegat
 * NotificationService). Admin tanpa surel dilewati diam-diam karena
 * login memakai NIK/username.
 */
class EmailDriver implements NotificationChannel
{
    public function name(): string
    {
        return 'email';
    }

    public function send(User $recipient, array $payload): void
    {
        $email = trim((string) ($recipient->email ?? ''));

        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        Mail::to($email)->send(new TicketNotificationMail($payload));
    }
}
