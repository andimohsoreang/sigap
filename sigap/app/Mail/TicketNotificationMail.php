<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Surel notifikasi tiket SIGAP (D10). Dikirim oleh EmailDriver.
 */
class TicketNotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    /** @param array<string, mixed> $payload */
    public function __construct(public array $payload) {}

    public function build(): self
    {
        return $this
            ->subject($this->payload['subject'] ?? '[SIGAP] Notifikasi Tiket')
            ->view('mail.ticket-notification');
    }
}