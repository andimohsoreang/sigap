<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Surel notifikasi tiket SIGAP (D10). Dikirim oleh EmailDriver.
 *
 * A-06: dikirim lewat queue (SMTP lambat/mati tidak memperlambat request)
 * dan baru diantrikan setelah transaksi database commit.
 */
class TicketNotificationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    /** @param array<string, mixed> $payload */
    public function __construct(public array $payload)
    {
        $this->afterCommit();
    }

    public function build(): self
    {
        return $this
            ->subject($this->payload['subject'] ?? '[SIGAP] Notifikasi Tiket')
            ->view('mail.ticket-notification');
    }
}
