<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Surel verifikasi akun warga (berbahasa Indonesia, lewat queue).
 * Tautan bertanda tangan dari Laravel, berlaku 60 menit (auth.verification.expire).
 */
class VerifikasiEmail extends VerifyEmail implements ShouldQueue
{
    use Queueable;

    public function __construct()
    {
        $this->afterCommit();
    }

    protected function buildMailMessage($url): MailMessage
    {
        return (new MailMessage)
            ->subject('[SIGAP] Verifikasi email akun Anda')
            ->greeting('Halo!')
            ->line('Terima kasih telah mendaftar di SIGAP Kementerian Transmigrasi. Klik tombol di bawah untuk memverifikasi email dan mengaktifkan akun Anda.')
            ->action('Verifikasi email', $url)
            ->line('Tautan ini berlaku 60 menit. Bila Anda tidak merasa mendaftar, abaikan surel ini.')
            ->salutation('Salam, Tim SIGAP');
    }
}
