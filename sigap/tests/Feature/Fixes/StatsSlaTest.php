<?php

namespace Tests\Feature\Fixes;

use App\Enums\TicketImpact;
use App\Enums\TicketStatus;
use App\Models\ActivityLog;
use App\Models\Category;
use App\Models\ChatConversation;
use App\Models\Ticket;
use App\Models\User;
use App\Services\ChatService;
use App\Services\SlaCalculator;
use App\Services\StatsService;
use App\Services\TicketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * D-03 (pencarian), D-05 (agregat & cache), D-06 (SLA), D-08 (bulan
 * berjalan), D-09 (penghitung chat atomik), D-01 (retensi/prune).
 */
class StatsSlaTest extends TestCase
{
    use RefreshDatabase;

    public function test_search_is_case_insensitive_and_escapes_wildcards(): void
    {
        $admin = User::factory()->admin()->create();
        Ticket::factory()->create(['ticket_no' => 'TKT-S1', 'title' => 'Jalan Berlubang']);
        Ticket::factory()->create(['ticket_no' => 'TKT-S2', 'title' => 'Diskon 100% palsu']);
        Ticket::factory()->create(['ticket_no' => 'TKT-S3', 'title' => 'Lampu mati']);

        $this->actingAs($admin)->get('/admin/tiket?q=BERLUBANG')
            ->assertInertia(fn ($page) => $page->has('tickets.data', 1)->where('tickets.data.0.nomor', 'TKT-S1'));

        $this->actingAs($admin)->get('/admin/tiket?q='.urlencode('100%'))
            ->assertInertia(fn ($page) => $page->has('tickets.data', 1)->where('tickets.data.0.nomor', 'TKT-S2'));

        $this->actingAs($admin)->get('/admin/tiket?q='.urlencode('%'))
            ->assertInertia(fn ($page) => $page->has('tickets.data', 1));

        $this->actingAs($admin)->get('/admin/tiket?q=_')
            ->assertInertia(fn ($page) => $page->has('tickets.data', 0));

        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/tickets?q=lampu')
            ->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_sla_percentage_and_status_counts_use_sql_aggregates(): void
    {
        Ticket::factory()->create(['status' => TicketStatus::Selesai, 'sla_due_at' => now()->addDay(), 'resolved_at' => now()]);
        Ticket::factory()->create(['status' => TicketStatus::Selesai, 'sla_due_at' => now()->subDays(2), 'resolved_at' => now()]);
        Ticket::factory()->create(['status' => TicketStatus::Selesai, 'sla_due_at' => now()->subDay(), 'resolved_at' => null]);
        Ticket::factory()->create(['status' => TicketStatus::Diproses, 'sla_due_at' => now()->subDay()]);

        $stats = app(StatsService::class);

        DB::enableQueryLog();
        $pct = $stats->slaPercentage(Ticket::query());
        $this->assertCount(1, DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertSame(33.3, $pct);
        $this->assertSame(3, $stats->statusCounts(Ticket::query())['selesai']);
        $this->assertSame(1, $stats->overdueCount(Ticket::query()));
    }

    public function test_public_overview_is_cached_for_sixty_seconds(): void
    {
        Ticket::factory()->create();
        $stats = app(StatsService::class);

        $this->assertSame(1, $stats->publicOverview()['total']);
        Ticket::factory()->create();
        $this->assertSame(1, $stats->publicOverview()['total']);

        Cache::forget(StatsService::PUBLIC_CACHE_KEY);
        $this->assertSame(2, $stats->publicOverview()['total']);
    }

    public function test_this_month_excludes_same_month_last_year(): void
    {
        Ticket::factory()->create(['created_at' => now()]);
        Ticket::factory()->create(['created_at' => now()->subYear()]);

        $this->assertSame(1, app(StatsService::class)->thisMonthCount(Ticket::query()));
    }

    public function test_average_resolution_hours_is_computed_in_sql(): void
    {
        $created = Carbon::parse('2026-10-01 08:00:00');
        Ticket::factory()->create(['status' => TicketStatus::Selesai, 'created_at' => $created, 'resolved_at' => $created->copy()->addHours(10)]);
        Ticket::factory()->create(['status' => TicketStatus::Selesai, 'created_at' => $created, 'resolved_at' => $created->copy()->addHours(20)]);

        $this->assertSame(15.0, app(StatsService::class)->averageResolutionHours(Ticket::query()));
    }

    public function test_due_date_uses_stricter_of_impact_and_category(): void
    {
        $sla = new SlaCalculator;
        $from = Carbon::parse('2026-10-05 08:00:00'); // Senin

        $this->assertSame(5, $sla->resolveDays(TicketImpact::Sedang, 5));
        $this->assertSame(3, $sla->resolveDays(TicketImpact::Kritis, 14));
        $this->assertSame(14, $sla->resolveDays(TicketImpact::Rendah, null));
        $this->assertSame('2026-10-12', $sla->dueAt(TicketImpact::Sedang, $from, 5)->toDateString());

        $category = Category::create(['name' => 'Darurat Air', 'slug' => 'darurat-air', 'sla_days' => 2]);
        $ticket = app(TicketService::class)->create([
            'title' => 'Air bersih', 'description' => 'Pipa air bersih putus total',
            'impact' => 'sedang', 'category_id' => $category->id,
        ]);
        $this->assertSame(
            $sla->dueAt(TicketImpact::Sedang, $ticket->created_at, 2)->toDateString(),
            $ticket->sla_due_at->toDateString(),
        );
    }

    public function test_sla_status_is_met_only_when_resolved_before_due(): void
    {
        $sla = new SlaCalculator;
        $due = Carbon::parse('2026-10-10 12:00:00');
        $now = Carbon::parse('2026-10-20 12:00:00');

        $this->assertSame('terpenuhi', $sla->status(false, $due, $now, $due->copy()->subHour()));
        $this->assertSame('terlambat', $sla->status(false, $due, $now, $due->copy()->addHour()));
        $this->assertSame('terlambat', $sla->status(false, $due, $now, null));
        $this->assertSame('terlambat', $sla->status(true, $due, $now));
        $this->assertSame('berjalan', $sla->status(true, $due, $due->copy()->subDay()));
    }

    public function test_internal_tickets_get_sla(): void
    {
        $ticket = app(TicketService::class)->create([
            'title' => 'AC rusak', 'description' => 'AC ruang rapat rusak total', 'impact' => 'tinggi', 'is_internal' => true,
        ]);

        $this->assertNotNull($ticket->sla_due_at);
        $this->assertNull($ticket->region_id);
    }

    public function test_chat_unread_counters_increment_atomically(): void
    {
        $conversation = ChatConversation::create(['guest_token' => 'g', 'subject' => 'Live Chat (Tamu)']);
        $stale = ChatConversation::find($conversation->id);
        $chat = app(ChatService::class);

        $chat->send($conversation, 'Satu', 'guest');
        $chat->send($stale, 'Dua', 'guest'); // model basi tidak boleh menimpa hitungan

        $this->assertSame(2, $conversation->fresh()->unread_admin);
        $this->assertSame(2, $stale->unread_admin);
    }

    public function test_old_guest_chats_and_activity_logs_are_prunable(): void
    {
        $old = ChatConversation::create(['guest_token' => 'lama', 'last_message_at' => now()->subDays(200)]);
        $recent = ChatConversation::create(['guest_token' => 'baru', 'last_message_at' => now()->subDays(10)]);
        $member = ChatConversation::create(['user_id' => User::factory()->warga()->create()->id, 'last_message_at' => now()->subDays(400)]);

        $oldLog = ActivityLog::create(['action' => 'lama']);
        $oldLog->forceFill(['created_at' => now()->subYears(2)])->save();
        $newLog = ActivityLog::create(['action' => 'baru']);

        $this->artisan('model:prune', ['--model' => [ChatConversation::class, ActivityLog::class]])->assertSuccessful();

        $this->assertModelMissing($old);
        $this->assertModelExists($recent);
        $this->assertModelExists($member);
        $this->assertModelMissing($oldLog);
        $this->assertModelExists($newLog);
    }
}
