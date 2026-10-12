<?php

namespace Tests\Feature;

use App\Enums\TicketStatus;
use App\Events\NotificationBroadcast;
use App\Events\TicketChanged;
use App\Mail\TicketNotificationMail;
use App\Models\Channel;
use App\Models\ChannelSyncLog;
use App\Models\Setting;
use App\Models\Ticket;
use App\Models\User;
use App\Services\TicketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Notifikasi D10 (TECH-SPEC §7b) & command scheduler.
 */
class NotificationTest extends TestCase
{
    use RefreshDatabase;

    private function adminWithEmail(string $email = 'admin@example.test'): User
    {
        return User::factory()->create([
            'role' => \App\Enums\UserRole::SuperAdmin,
            'email' => $email,
            'is_active' => true,
        ]);
    }

    public function test_email_driver_sends_mailable_to_admin_with_email(): void
    {
        Mail::fake();

        $admin = $this->adminWithEmail();
        $ticket = Ticket::factory()->create(['status' => TicketStatus::Baru]);

        app(TicketService::class)->changeStatus($ticket, TicketStatus::Diproses, $admin, 'Ditindaklanjuti');

        Mail::assertSent(TicketNotificationMail::class, function (TicketNotificationMail $mail) use ($admin, $ticket) {
            return $mail->hasTo($admin->email)
                && ($mail->payload['nomor'] ?? null) === $ticket->ticket_no;
        });
    }

    public function test_admin_without_email_is_skipped_without_error(): void
    {
        Mail::fake();

        $admin = $this->adminWithEmail();
        $admin->update(['email' => null]);

        $ticket = Ticket::factory()->create(['status' => TicketStatus::Baru]);

        app(TicketService::class)->changeStatus($ticket, TicketStatus::Diproses, $admin);

        Mail::assertNothingSent();
    }

    public function test_in_app_driver_broadcasts_to_admin_panel(): void
    {
        Event::fake([TicketChanged::class, NotificationBroadcast::class]);
        Mail::fake();

        $admin = $this->adminWithEmail();
        $ticket = Ticket::factory()->create(['status' => TicketStatus::Baru]);

        app(TicketService::class)->changeStatus($ticket, TicketStatus::Selesai, $admin);

        Event::assertDispatched(NotificationBroadcast::class, fn (NotificationBroadcast $e) => $e->payload['event'] === 'status');
    }

    public function test_no_whatsapp_driver_is_registered(): void
    {
        $channels = config('notifications.channels');

        $this->assertArrayHasKey('in_app', $channels);
        $this->assertArrayHasKey('email', $channels);
        $this->assertArrayNotHasKey('whatsapp', $channels);
    }

    public function test_ews_command_disabled_when_setting_off(): void
    {
        Setting::put('ews_enabled', false);

        $this->artisan('sigap:ews-check')
            ->expectsOutputToContain('EWS dinonaktifkan')
            ->assertSuccessful();
    }

    public function test_ews_command_flags_overdue_tickets(): void
    {
        Setting::put('ews_enabled', true);
        Event::fake([TicketChanged::class, NotificationBroadcast::class]);
        Mail::fake();

        $this->adminWithEmail();

        Ticket::factory()->create([
            'status' => TicketStatus::Diproses,
            'sla_due_at' => now()->subDay(),
        ]);

        $this->artisan('sigap:ews-check')->assertSuccessful();

        Event::assertDispatched(NotificationBroadcast::class, fn (NotificationBroadcast $e) => $e->payload['event'] === 'ews');
    }

    public function test_ews_ignores_internal_and_finished_tickets(): void
    {
        Setting::put('ews_enabled', true);
        Event::fake([TicketChanged::class, NotificationBroadcast::class]);

        Ticket::factory()->create([
            'is_internal' => true,
            'status' => TicketStatus::Diproses,
            'sla_due_at' => now()->subDay(),
        ]);

        Ticket::factory()->create([
            'status' => TicketStatus::Selesai,
            'sla_due_at' => now()->subDay(),
        ]);

        $this->artisan('sigap:ews-check')
            ->expectsOutputToContain('Tidak ada tiket melewati SLA')
            ->assertSuccessful();
    }

    public function test_sync_channels_command_writes_logs_and_timestamps(): void
    {
        Event::fake([TicketChanged::class, NotificationBroadcast::class]);

        Channel::create(['type' => 'nasional', 'name' => 'SP4N-LAPOR!']);

        $this->artisan('sigap:sync-channels')->assertSuccessful();

        $this->assertDatabaseHas('channel_sync_logs', ['channel' => 'sp4n']);
        $this->assertNotNull(Channel::query()->where('name', 'SP4N-LAPOR!')->first()?->last_synced_at);
    }

    public function test_sync_channels_rejects_unknown_channel(): void
    {
        $this->artisan('sigap:sync-channels --channel=tidak-ada')
            ->expectsOutputToContain('tidak-ada')
            ->assertFailed();

        $this->assertSame(0, ChannelSyncLog::count());
    }
}