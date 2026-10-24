<?php

namespace App\Services;

use App\Enums\TicketStatus;
use App\Mail\ReporterTicketMail;
use App\Models\Ticket;
use App\Models\TicketReply;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Surel perkembangan tiket untuk PELAPOR (warga).
 *
 * Dikirim saat tiket dibuat, status berubah, dan petugas menulis tanggapan
 * publik. Alamat tujuan: surel akun warga yang sudah terverifikasi, atau
 * surel yang diisi di formulir pengaduan. Tanpa surel tidak ada yang dikirim.
 *
 * Isi surel tidak memuat NIK maupun catatan internal petugas (catatan status
 * dan tanggapan non-publik tidak pernah dikirim). Kegagalan SMTP tidak boleh
 * membatalkan proses bisnis — hanya dicatat di log.
 */
class ReporterNotifier
{
    public function ticketCreated(Ticket $ticket): void
    {
        $this->send($ticket, [
            'subject' => "[SIGAP] Tiket {$ticket->ticket_no} diterima",
            'heading' => 'Pengaduan Anda sudah kami terima',
            'intro' => 'Terima kasih telah melapor melalui SIGAP. Simpan nomor tiket dan kode akses di bawah untuk melacak perkembangannya.',
            'meta' => $this->meta($ticket, withAccessCode: true),
        ]);
    }

    public function statusChanged(Ticket $ticket): void
    {
        $status = $ticket->status instanceof TicketStatus ? $ticket->status : null;

        $intro = match ($status) {
            TicketStatus::Verifikasi => 'Laporan Anda sudah diperiksa petugas dan dinyatakan dapat ditindaklanjuti.',
            TicketStatus::Diproses => 'Laporan Anda sedang ditindaklanjuti petugas.',
            TicketStatus::Selesai => 'Laporan Anda telah selesai ditangani. Mohon luangkan waktu satu menit untuk mengisi survei kepuasan di halaman lacak tiket.',
            TicketStatus::Ditolak => 'Laporan Anda tidak dapat diproses. Lihat tanggapan petugas di halaman lacak tiket untuk keterangannya.',
            default => 'Status laporan Anda diperbarui.',
        };

        $this->send($ticket, [
            'subject' => "[SIGAP] Tiket {$ticket->ticket_no}: {$status?->label()}",
            'heading' => 'Status laporan: '.($status?->label() ?? '-'),
            'intro' => $intro,
            'meta' => $this->meta($ticket),
            'cta_label' => $status === TicketStatus::Selesai ? 'Lacak tiket & isi survei' : 'Lacak tiket',
        ]);
    }

    public function replied(Ticket $ticket, TicketReply $reply): void
    {
        if (! $reply->is_public) {
            return;
        }

        $this->send($ticket, [
            'subject' => "[SIGAP] Tanggapan petugas untuk tiket {$ticket->ticket_no}",
            'heading' => 'Ada tanggapan baru dari petugas',
            'intro' => 'Petugas SIGAP menanggapi laporan Anda:',
            'quote' => $reply->body,
            'meta' => $this->meta($ticket),
        ]);
    }

    /** Alamat surel pelapor, atau null bila tidak ada yang dapat dipakai. */
    public function emailFor(Ticket $ticket): ?string
    {
        $reporter = $ticket->reporter;

        $candidates = [
            $reporter?->hasVerifiedEmail() ? $reporter->email : null,
            $ticket->reporter_email,
        ];

        foreach ($candidates as $email) {
            $email = trim((string) $email);

            if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                return $email;
            }
        }

        return null;
    }

    /** @param array<string, mixed> $payload */
    private function send(Ticket $ticket, array $payload): void
    {
        if (! config('notifications.reporter_email', true)) {
            return;
        }

        try {
            $email = $this->emailFor($ticket);

            if ($email === null) {
                return;
            }

            Mail::to($email)->send(new ReporterTicketMail($payload + [
                'cta_url' => '/lacak/'.$ticket->ticket_no,
                'cta_label' => 'Lacak tiket',
            ]));
        } catch (\Throwable $e) {
            Log::warning('Surel ke pelapor gagal', ['ticket' => $ticket->ticket_no, 'error' => $e->getMessage()]);
        }
    }

    /** @return array<string, string> */
    private function meta(Ticket $ticket, bool $withAccessCode = false): array
    {
        $meta = [
            'Nomor tiket' => $ticket->ticket_no,
            'Judul' => (string) $ticket->title,
            'Status' => $ticket->status instanceof TicketStatus ? $ticket->status->label() : '-',
        ];

        if ($withAccessCode && $ticket->lookup_token) {
            $meta['Kode akses'] = $ticket->lookup_token;
        }

        if ($ticket->sla_due_at !== null && $ticket->status instanceof TicketStatus && $ticket->status->isOpen()) {
            $meta['Target selesai'] = $ticket->sla_due_at->timezone('Asia/Jakarta')->translatedFormat('j F Y');
        }

        return $meta;
    }
}
