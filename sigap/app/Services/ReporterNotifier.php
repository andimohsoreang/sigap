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
            'subject' => "[Contact Center] Tiket {$ticket->ticket_no} diterima",
            'heading' => 'Pengaduan Anda sudah kami terima',
            'intro' => 'Terima kasih telah melapor melalui Contact Center. Simpan nomor tiket dan kode akses di bawah untuk melacak perkembangannya.',
            'meta' => $this->meta($ticket, withAccessCode: true),
        ]);
    }

    public function statusChanged(Ticket $ticket): void
    {
        $status = $ticket->status instanceof TicketStatus ? $ticket->status : null;

        $intro = match ($status) {
            TicketStatus::Verifikasi => 'Laporan Anda sudah diperiksa petugas dan dinyatakan dapat ditindaklanjuti.',
            TicketStatus::Diproses => 'Laporan Anda sedang ditindaklanjuti petugas.',
            TicketStatus::Selesai => 'Laporan Anda telah selesai ditangani. Mohon luangkan waktu kurang dari 2 menit untuk mengisi survei kepuasan; jawaban Anda hanya dipakai untuk perbaikan layanan.',
            TicketStatus::Ditolak => 'Laporan Anda tidak dapat diproses. Lihat tanggapan petugas di halaman lacak tiket untuk keterangannya.',
            default => 'Status laporan Anda diperbarui.',
        };

        $this->send($ticket, [
            'subject' => "[Contact Center] Tiket {$ticket->ticket_no}: {$status?->label()}",
            'heading' => 'Status laporan: '.($status?->label() ?? '-'),
            'intro' => $intro,
            'meta' => $this->meta($ticket),
            ...($status === TicketStatus::Selesai ? ['cta_url' => $this->surveyUrl($ticket), 'cta_label' => 'Isi survei kepuasan'] : []),
        ]);
    }

    /** Satu kali pengingat survei kepuasan (sigap:pengingat-survei). */
    public function surveyReminder(Ticket $ticket): bool
    {
        return $this->send($ticket, [
            'subject' => "[Contact Center] Bagaimana penanganan tiket {$ticket->ticket_no}?",
            'heading' => 'Mohon nilai penanganan pengaduan Anda',
            'intro' => 'Beberapa hari lalu pengaduan Anda dinyatakan selesai. Bila belum sempat, mohon isi survei kepuasan singkat (kurang dari 2 menit). Pengingat ini hanya dikirim sekali.',
            'meta' => $this->meta($ticket),
            'cta_url' => $this->surveyUrl($ticket),
            'cta_label' => 'Isi survei kepuasan',
        ]);
    }

    /** Nomor format lama butuh kode akses agar halaman survei bisa dibuka tamu. */
    private function surveyUrl(Ticket $ticket): string
    {
        $url = '/lacak/'.$ticket->ticket_no.'/survei';

        return Ticket::isLegacyNo($ticket->ticket_no) && $ticket->lookup_token ? $url.'?kode='.$ticket->lookup_token : $url;
    }

    public function replied(Ticket $ticket, TicketReply $reply): void
    {
        if (! $reply->is_public) {
            return;
        }

        $this->send($ticket, [
            'subject' => "[Contact Center] Tanggapan petugas untuk tiket {$ticket->ticket_no}",
            'heading' => 'Ada tanggapan baru dari petugas',
            'intro' => 'Petugas Contact Center menanggapi laporan Anda:',
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

    /**
     * @param  array<string, mixed>  $payload
     * @return bool surel terkirim
     */
    private function send(Ticket $ticket, array $payload): bool
    {
        if (! config('notifications.reporter_email', true)) {
            return false;
        }

        try {
            $email = $this->emailFor($ticket);

            if ($email === null) {
                return false;
            }

            Mail::to($email)->send(new ReporterTicketMail($payload + [
                'cta_url' => '/lacak/'.$ticket->ticket_no,
                'cta_label' => 'Lacak tiket',
            ]));

            return true;
        } catch (\Throwable $e) {
            Log::warning('Surel ke pelapor gagal', ['ticket' => $ticket->ticket_no, 'error' => $e->getMessage()]);

            return false;
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
