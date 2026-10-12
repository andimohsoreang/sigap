<?php

namespace Tests\Feature\Fixes;

use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Events\ChatMessageSent;
use App\Events\NotificationBroadcast;
use App\Events\TicketChanged;
use App\Mail\TicketNotificationMail;
use App\Models\Region;
use App\Models\Setting;
use App\Models\Ticket;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\TicketService;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * A-06 (penerima & antrean notifikasi) dan D-07 (EWS sekali per tiket, satu
 * ringkasan per admin).
 */
class NotificationScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_events_and_mail_are_queued_after_commit(): void
    {
        foreach ([TicketChanged::class, NotificationBroadcast::class, ChatMessageSent::class] as $event) {
            $this->assertTrue(is_subclass_of($event, ShouldBroadcast::class), $event);
            $this->assertFalse(is_subclass_of($event, ShouldBroadcastNow::class), $event);
            $this->assertTrue(is_subclass_of($event, ShouldDispatchAfterCommit::class), $event);
        }

        $this->assertTrue(is_subclass_of(TicketNotificationMail::class, ShouldQueue::class));
        $this->assertTrue((new TicketNotificationMail([]))->afterCommit);
    }

    public function test_recipients_are_super_admins_and_admins_of_ticket_region(): void
    {
        $regionA = Region::factory()->create();
        $regionB = Region::factory()->create();
        $super = User::factory()->admin()->create();
        $kawasanA = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => $regionA->id]);
        $kawasanB = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => $regionB->id]);
        User::factory()->admin()->create(['is_active' => false]);
        User::factory()->warga()->create();

        $service = app(NotificationService::class);

        $ids = $service->recipientsFor(Ticket::factory()->create(['region_id' => $regionA->id]))->pluck('id')->all();
        $this->assertEqualsCanonicalizing([$super->id, $kawasanA->id], $ids);

        $internal = $service->recipientsFor(Ticket::factory()->internal()->create())->pluck('id')->all();
        $this->assertSame([$super->id], $internal);

        $this->assertNotContains($kawasanB->id, $ids);
    }

    public function test_ticket_changed_broadcasts_on_private_user_channels(): void
    {
        Event::fake([TicketChanged::class, NotificationBroadcast::class]);
        Mail::fake();

        $region = Region::factory()->create();
        $super = User::factory()->admin()->create();
        $kawasan = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => $region->id]);
        $ticket = Ticket::factory()->create(['region_id' => $region->id, 'status' => TicketStatus::Baru]);

        app(TicketService::class)->changeStatus($ticket, TicketStatus::Diproses, $super);

        Event::assertDispatched(TicketChanged::class, function (TicketChanged $e) use ($super, $kawasan) {
            $channels = array_map(fn ($c) => $c->name, $e->broadcastOn());
            sort($channels);
            $expected = ['private-user.'.$super->id, 'private-user.'.$kawasan->id];
            sort($expected);

            return $channels === $expected;
        });
    }

    public function test_ews_sends_one_digest_per_admin_and_only_once_per_ticket(): void
    {
        Setting::put('ews_enabled', true);
        Event::fake([TicketChanged::class, NotificationBroadcast::class]);
        Mail::fake();

        $region = Region::factory()->create();
        $super = User::factory()->admin()->create();
        $kawasan = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => $region->id]);

        Ticket::factory()->count(3)->create([
            'region_id' => $region->id,
            'status' => TicketStatus::Diproses,
            'sla_due_at' => now()->subDay(),
        ]);

        $this->artisan('sigap:ews-check')->assertSuccessful();

        // Satu ringkasan per admin (2 admin), bukan satu per tiket.
        Event::assertDispatchedTimes(NotificationBroadcast::class, 2);
        Event::assertDispatched(NotificationBroadcast::class, fn ($e) => $e->userId === $super->id && count($e->payload['tickets']) === 3);
        Event::assertDispatched(NotificationBroadcast::class, fn ($e) => $e->userId === $kawasan->id);
        $this->assertSame(0, Ticket::whereNull('ews_notified_at')->count());

        // Jalankan ulang: tidak ada peringatan ganda.
        $this->artisan('sigap:ews-check')->expectsOutputToContain('Tidak ada tiket melewati SLA')->assertSuccessful();
        Event::assertDispatchedTimes(NotificationBroadcast::class, 2);
    }

    public function test_ews_covers_internal_tickets_for_super_admins_only(): void
    {
        Setting::put('ews_enabled', true);
        Event::fake([TicketChanged::class, NotificationBroadcast::class]);
        Mail::fake();

        $region = Region::factory()->create();
        $super = User::factory()->admin()->create();
        User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => $region->id]);

        $internal = Ticket::factory()->create([
            'is_internal' => true,
            'region_id' => $region->id,
            'status' => TicketStatus::Baru,
            'sla_due_at' => now()->subDay(),
        ]);

        $this->artisan('sigap:ews-check')->assertSuccessful();

        Event::assertDispatchedTimes(NotificationBroadcast::class, 1);
        Event::assertDispatched(NotificationBroadcast::class, fn ($e) => $e->userId === $super->id
            && $e->payload['event'] === 'ews');
        $this->assertNotNull($internal->fresh()->ews_notified_at);
    }

    public function test_ews_is_enabled_by_default_like_settings_page(): void
    {
        Event::fake([NotificationBroadcast::class]);
        User::factory()->admin()->create();
        Ticket::factory()->create(['status' => TicketStatus::Baru, 'sla_due_at' => now()->subDay()]);

        $this->assertNull(Setting::get('ews_enabled'));
        $this->artisan('sigap:ews-check')->assertSuccessful();

        Event::assertDispatched(NotificationBroadcast::class);
    }

    public function test_reopened_ticket_can_trigger_ews_again(): void
    {
        $admin = User::factory()->admin()->create();
        $ticket = Ticket::factory()->create([
            'status' => TicketStatus::Selesai,
            'resolved_at' => now(),
            'ews_notified_at' => now(),
        ]);

        app(TicketService::class)->changeStatus($ticket, TicketStatus::Diproses, $admin);

        $this->assertNull($ticket->fresh()->ews_notified_at);
    }
}
