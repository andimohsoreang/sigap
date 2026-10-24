<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Surel tautan atur ulang kata sandi warga (berbahasa Indonesia, lewat queue).
 * Token berlaku sesuai auth.passwords.users.expire (60 menit).
 */
class AturUlangSandi extends ResetPassword implements ShouldQueue
{
    use Queueable;

    public function __construct(#[\SensitiveParameter] $token)
    {
        parent::__construct($token);
        $this->afterCommit();
    }

    protected function buildMailMessage($url): MailMessage
    {
        $minutes = config('auth.passwords.'.config('auth.defaults.passwords').'.expire');

        return (new MailMessage)
            ->subject('[SIGAP] Atur ulang kata sandi')
            ->greeting('Halo!')
            ->line('Kami menerima permintaan untuk mengatur ulang kata sandi akun SIGAP Anda.')
            ->action('Atur ulang kata sandi', $url)
            ->line("Tautan ini berlaku {$minutes} menit dan hanya dapat dipakai satu kali.")
            ->line('Bila Anda tidak meminta ini, abaikan surel ini. Kata sandi Anda tidak akan berubah.')
            ->salutation('Salam, Tim SIGAP');
    }
}
