<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Surel perkembangan tiket untuk pelapor. Dikirim oleh ReporterNotifier.
 *
 * Seperti TicketNotificationMail: lewat queue dan baru diantrikan setelah
 * transaksi database commit.
 */
class ReporterTicketMail extends Mailable implements ShouldQueue
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
            ->subject($this->payload['subject'] ?? '[Contact Center] Perkembangan Tiket')
            ->markdown('mail.reporter-ticket');
    }
}
