<?php

namespace App\Services\Notifications;

use App\Contracts\NotificationChannel;
use App\Events\NotificationBroadcast;
use App\Models\User;

/**
 * Driver IN-APP (TECH-SPEC §7b — D10).
 *
 * Menyiar notifikasi lewat Reverb ke kanal privat per pengguna (`user.{id}`)
 * — hanya penerima yang berwenang (A-06). Broadcast diantrikan setelah
 * commit; bila Reverb mati, kegagalan tidak membatalkan request.
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
