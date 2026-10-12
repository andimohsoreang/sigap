<?php

namespace App\Services\Notifications;

use App\Contracts\NotificationChannel;
use App\Events\NotificationBroadcast;
use App\Models\User;

/**
 * Driver IN-APP (TECH-SPEC §7b — D10).
 *
 * Menyiar perubahan lewat Reverb ke lonceng notifikasi panel admin
 * (`admin.notifications`) dan ke kanal privat per pengguna (`user.{id}`).
 * Bila Reverb mati, broadcast gagal diam-diam tanpa membatalkan request.
 */
class InAppDriver implements NotificationChannel
{
    public function name(): string
    {
        return 'in_app';
    }

    public function send(User $recipient, array $payload): void
    {
        NotificationBroadcast::dispatch($recipient->id, $payload);
    }
}