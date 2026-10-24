<?php

namespace Tests\Feature;

use App\Enums\TicketStatus;
use App\Mail\ReporterTicketMail;
use App\Mail\TicketNotificationMail;
use App\Models\Ticket;
use App\Models\User;
use App\Services\ReporterNotifier;
use App\Services\TicketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/** Surel perkembangan tiket ke pelapor (dibuat, status berubah, tanggapan publik). */
class ReporterNotificationTest extends TestCase
{
    use RefreshDatabase;

    private function reporterMails(string $email): Collection
    {
        return Mail::queued(ReporterTicketMail::class, fn (ReporterTicketMail $m) => $m->hasTo($email));
    }

    public function test_public_form_ticket_emails_reporter_with_number_and_access_code(): void
    {
        Mail::fake();

        $this->post('/pengaduan/baru', [
            'nik' => '3273010101900001',
            'nama' => 'Budi Santoso',
            'email' => 'budi@example.com',
            'judul' => 'Jalan rusak',
            'uraian' => 'Jalan poros desa rusak berat sejak Januari.',
            'impact' => 'tinggi',
        ])->assertRedirect();

        $ticket = Ticket::query()->firstOrFail();
        $mails = $this->reporterMails('budi@example.com');

        $this->assertCount(1, $mails);
        $payload = $mails->first()->payload;
        $this->assertSame($ticket->ticket_no, $payload['meta']['Nomor tiket']);
        $this->assertSame($ticket->lookup_token, $payload['meta']['Kode akses']);
        $this->assertSame('/lacak/'.$ticket->ticket_no, $payload['cta_url']);
        $this->assertStringNotContainsString('3273010101900001', json_encode($payload));
    }

    public function test_no_email_means_no_reporter_mail(): void
    {
        Mail::fake();

        $this->post('/pengaduan/baru', [
            'nik' => '3273010101900001',
            'nama' => 'Tanpa Email',
            'judul' => 'Lampu jalan mati',
            'uraian' => 'Lampu jalan di blok C mati seminggu.',
            'impact' => 'rendah',
        ])->assertRedirect();

        Mail::assertNotQueued(ReporterTicketMail::class);
    }

    public function test_status_change_emails_reporter_without_internal_note(): void
    {
        Mail::fake();
        $admin = User::factory()->admin()->create();
        $ticket = Ticket::factory()->create(['status' => TicketStatus::Baru, 'reporter_email' => 'pelapor@example.com']);

        $this->actingAs($admin)
            ->post("/admin/tiket/{$ticket->ticket_no}/status", ['status' => 'selesai', 'note' => 'CATATAN-INTERNAL'])
            ->assertSessionHasErrors(); // Menunggu → Selesai tidak diizinkan

        $this->actingAs($admin)
            ->post("/admin/tiket/{$ticket->ticket_no}/status", ['status' => 'diproses', 'note' => 'CATATAN-INTERNAL'])
            ->assertRedirect();

        $mails = $this->reporterMails('pelapor@example.com');
        $this->assertCount(1, $mails);
        $this->assertStringContainsString('Diproses', $mails->first()->payload['subject']);
        $this->assertStringNotContainsString('CATATAN-INTERNAL', json_encode($mails->first()->payload));
    }

    public function test_finished_ticket_mail_invites_survey(): void
    {
        Mail::fake();
        $ticket = Ticket::factory()->create(['status' => TicketStatus::Diproses, 'reporter_email' => 'pelapor@example.com']);

        app(TicketService::class)->changeStatus($ticket, TicketStatus::Selesai);

        $payload = $this->reporterMails('pelapor@example.com')->first()->payload;
        $this->assertStringContainsString('survei', $payload['intro']);
        $this->assertSame('Lacak tiket & isi survei', $payload['cta_label']);
    }

    public function test_only_public_replies_are_emailed(): void
    {
        Mail::fake();
        $admin = User::factory()->admin()->create();
        $ticket = Ticket::factory()->create(['reporter_email' => 'pelapor@example.com']);

        $this->actingAs($admin)->post("/admin/tiket/{$ticket->ticket_no}/tanggapan", ['body' => 'Catatan untuk tim saja.', 'is_public' => false]);
        $this->assertCount(0, $this->reporterMails('pelapor@example.com'));

        $this->actingAs($admin)->post("/admin/tiket/{$ticket->ticket_no}/tanggapan", ['body' => 'Petugas akan survei lokasi besok.', 'is_public' => true]);
        $mails = $this->reporterMails('pelapor@example.com');
        $this->assertCount(1, $mails);
        $this->assertSame('Petugas akan survei lokasi besok.', $mails->first()->payload['quote']);
    }

    public function test_verified_account_email_is_preferred_over_unverified(): void
    {
        $verified = User::factory()->warga()->create(['email' => 'akun@example.com']);
        $unverified = User::factory()->warga()->unverified()->create(['email' => 'belum@example.com']);
        $notifier = app(ReporterNotifier::class);

        $this->assertSame('akun@example.com', $notifier->emailFor(
            Ticket::factory()->forReporter($verified)->create(['reporter_email' => 'form@example.com'])
        ));
        $this->assertSame('form@example.com', $notifier->emailFor(
            Ticket::factory()->forReporter($unverified)->create(['reporter_email' => 'form@example.com'])
        ));
    }

    public function test_reporter_mail_can_be_disabled(): void
    {
        Mail::fake();
        config(['notifications.reporter_email' => false]);
        $ticket = Ticket::factory()->create(['status' => TicketStatus::Baru, 'reporter_email' => 'pelapor@example.com']);

        app(TicketService::class)->changeStatus($ticket, TicketStatus::Diproses);

        Mail::assertNotQueued(ReporterTicketMail::class);
    }

    public function test_reporter_mail_renders(): void
    {
        $html = (new ReporterTicketMail([
            'subject' => '[SIGAP] Tes',
            'heading' => 'Pengaduan Anda sudah kami terima',
            'intro' => 'Terima kasih.',
            'quote' => 'Isi tanggapan',
            'meta' => ['Nomor tiket' => 'TKT-261025-ABCDEF', 'Kode akses' => 'ABCD2345'],
            'cta_url' => '/lacak/TKT-261025-ABCDEF',
            'cta_label' => 'Lacak tiket',
        ]))->render();

        $this->assertStringContainsString('TKT-261025-ABCDEF', $html);
        $this->assertStringContainsString('/lacak/TKT-261025-ABCDEF', $html);
        $this->assertStringContainsString('Isi tanggapan', $html);
    }

    public function test_staff_ticket_mail_renders(): void
    {
        $html = (new TicketNotificationMail([
            'subject' => '[SIGAP] Tiket baru',
            'title' => 'Tiket baru TKT-261025-ABCDEF',
            'body' => 'Ada tiket baru di kawasan Anda.',
            'meta' => ['Nomor tiket' => 'TKT-261025-ABCDEF'],
            'cta_url' => '/admin/tiket/TKT-261025-ABCDEF',
        ]))->render();

        $this->assertStringContainsString('Ada tiket baru di kawasan Anda.', $html);
        $this->assertStringContainsString('/admin/tiket/TKT-261025-ABCDEF', $html);
    }
}
