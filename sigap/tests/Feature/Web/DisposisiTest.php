<?php

namespace Tests\Feature\Web;

use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\Ticket;
use App\Models\TicketDisposition;
use App\Models\Unit;
use App\Models\User;
use App\Services\TicketService;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** PRD-UNIT-KERJA F2: disposisi tiket ke Unit Kerja oleh Super Admin. */
class DisposisiTest extends TestCase
{
    use RefreshDatabase;

    private Unit $hukum;

    private Unit $umum;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
        $this->hukum = Unit::create(['code' => 'SETJEN-HUKUM', 'name' => 'Biro Hukum', 'level' => Unit::LEVEL_ESELON_2]);
        $this->umum = Unit::create(['code' => 'SETJEN-UMUM', 'name' => 'Biro Umum dan Layanan Pengadaan', 'short_name' => 'Biro Umum', 'level' => Unit::LEVEL_ESELON_2]);
    }

    private function superAdmin(): User
    {
        return User::factory()->admin(UserRole::SuperAdmin)->create();
    }

    private function ticket(array $data = []): Ticket
    {
        return app(TicketService::class)->create($data + [
            'title' => 'Sertifikat lahan belum terbit',
            'description' => 'Sertifikat lahan usaha belum terbit sejak 2019.',
            'impact' => 'sedang',
            'province' => 'Kalimantan Tengah',
            'reporter_name' => 'Budi Santoso',
        ]);
    }

    private function dispose(User $admin, Ticket $ticket, array $data): TestResponse
    {
        return $this->actingAs($admin)->post("/admin/tiket/{$ticket->ticket_no}/disposisi", $data);
    }

    public function test_super_admin_disposes_ticket_to_unit(): void
    {
        $admin = $this->superAdmin();
        $ticket = $this->ticket();
        $due = now()->addDays(3)->startOfMinute();

        $this->dispose($admin, $ticket, ['unit_id' => $this->hukum->id, 'catatan' => ' Mohon dicek. ', 'tenggat' => $due->toIso8601String()])
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        $ticket->refresh();
        $this->assertSame($this->hukum->id, $ticket->unit_id);
        $this->assertNotNull($ticket->disposed_at);

        $disposition = TicketDisposition::query()->where('ticket_id', $ticket->id)->sole();
        $this->assertSame(TicketDisposition::STATUS_WAITING, $disposition->status);
        $this->assertSame('Mohon dicek.', $disposition->note);
        $this->assertSame($admin->id, $disposition->assigned_by);
        $this->assertTrue($disposition->due_at->equalTo($due));
        $this->assertTrue(ActivityLog::query()->where('action', 'ticket.disposed')->exists());
    }

    public function test_admin_kawasan_cannot_dispose_or_withdraw(): void
    {
        $kawasan = User::factory()->admin(UserRole::AdminKawasan)->create();
        $ticket = $this->ticket();

        $this->dispose($kawasan, $ticket, ['unit_id' => $this->hukum->id])->assertForbidden();
        $this->actingAs($kawasan)->delete("/admin/tiket/{$ticket->ticket_no}/disposisi")->assertForbidden();
        $this->assertNull($ticket->fresh()->unit_id);
    }

    public function test_rejects_inactive_unit_past_deadline_and_closed_ticket(): void
    {
        $admin = $this->superAdmin();
        $ticket = $this->ticket();
        $this->umum->update(['is_active' => false]);

        $this->dispose($admin, $ticket, ['unit_id' => $this->umum->id])->assertSessionHasErrors('unit_id');
        $this->dispose($admin, $ticket, ['unit_id' => $this->hukum->id, 'tenggat' => now()->subHour()->toIso8601String()])
            ->assertSessionHasErrors('tenggat');

        $closed = $this->ticket();
        app(TicketService::class)->changeStatus($closed, TicketStatus::Ditolak, $admin, 'Bukan kewenangan.');
        $this->dispose($admin, $closed, ['unit_id' => $this->hukum->id])->assertSessionHasErrors('unit_id');

        $this->assertSame(0, TicketDisposition::count());
    }

    public function test_redisposing_redirects_and_keeps_single_active_disposition(): void
    {
        $admin = $this->superAdmin();
        $ticket = $this->ticket();

        $this->dispose($admin, $ticket, ['unit_id' => $this->hukum->id])->assertSessionHasNoErrors();
        $this->dispose($admin, $ticket, ['unit_id' => $this->hukum->id])->assertSessionHasErrors('unit_id');
        $this->dispose($admin, $ticket, ['unit_id' => $this->umum->id])->assertSessionHasNoErrors();

        $this->assertSame($this->umum->id, $ticket->fresh()->unit_id);
        $this->assertSame(1, TicketDisposition::query()->where('ticket_id', $ticket->id)->active()->count());
        $this->assertSame(
            TicketDisposition::STATUS_WITHDRAWN,
            TicketDisposition::query()->where('unit_id', $this->hukum->id)->value('status'),
        );
        $this->assertTrue(ActivityLog::query()->where('action', 'ticket.redirected')->exists());
    }

    public function test_withdraw_returns_ticket_to_queue(): void
    {
        $admin = $this->superAdmin();
        $ticket = $this->ticket();
        $this->dispose($admin, $ticket, ['unit_id' => $this->hukum->id]);

        $this->actingAs($admin)->delete("/admin/tiket/{$ticket->ticket_no}/disposisi", ['alasan' => 'Salah unit'])
            ->assertSessionHasNoErrors();

        $ticket->refresh();
        $this->assertNull($ticket->unit_id);
        $this->assertNull($ticket->disposed_at);
        $disposition = TicketDisposition::query()->sole();
        $this->assertSame(TicketDisposition::STATUS_WITHDRAWN, $disposition->status);
        $this->assertSame('Salah unit', $disposition->return_reason);
        $this->assertSame($admin->id, $disposition->closed_by);

        $this->actingAs($admin)->delete("/admin/tiket/{$ticket->ticket_no}/disposisi")->assertSessionHasErrors('disposisi');
    }

    public function test_closing_ticket_closes_disposition_and_skips_old_auto_assign(): void
    {
        $admin = $this->superAdmin();
        $ticket = $this->ticket();
        $this->dispose($admin, $ticket, ['unit_id' => $this->hukum->id]);

        app(TicketService::class)->changeStatus($ticket, TicketStatus::Diproses, $admin);
        $this->assertNull($ticket->fresh()->assignee_id);

        app(TicketService::class)->changeStatus($ticket, TicketStatus::Selesai, $admin);
        $disposition = TicketDisposition::query()->sole();
        $this->assertSame(TicketDisposition::STATUS_DONE, $disposition->status);
        $this->assertNotNull($disposition->closed_at);
        $this->assertSame($this->hukum->id, $ticket->fresh()->unit_id);
    }

    public function test_detail_page_shows_disposition_and_form_only_for_super_admin(): void
    {
        $admin = $this->superAdmin();
        $ticket = $this->ticket();
        $this->dispose($admin, $ticket, ['unit_id' => $this->hukum->id, 'catatan' => 'Cek lokasi SP 2']);

        $this->actingAs($admin)->get("/admin/tiket/{$ticket->ticket_no}")
            ->assertInertia(fn (Assert $page) => $page->component('admin/tiket-detail')
                ->where('ticket.unit_penangan', 'Biro Hukum')
                ->where('disposisi.boleh_ubah', true)
                ->has('disposisi.unit_options', 2)
                ->where('disposisi.riwayat.0.unit', 'Biro Hukum')
                ->where('disposisi.riwayat.0.aktif', true)
                ->where('disposisi.riwayat.0.catatan', 'Cek lokasi SP 2'));

        $kawasan = User::factory()->admin(UserRole::AdminKawasan)->create();
        $this->actingAs($kawasan)->get("/admin/tiket/{$ticket->ticket_no}")
            ->assertInertia(fn (Assert $page) => $page->where('disposisi.boleh_ubah', false)
                ->where('disposisi.unit_options', [])
                ->where('disposisi.riwayat.0.unit', 'Biro Hukum'));
    }

    public function test_ticket_list_filters_undisposed_and_counts_tab(): void
    {
        $admin = $this->superAdmin();
        $disposed = $this->ticket(['title' => 'Sudah didisposisi']);
        $this->ticket(['title' => 'Belum didisposisi']);
        $this->dispose($admin, $disposed, ['unit_id' => $this->umum->id]);

        $this->actingAs($admin)->get('/admin/tiket?status=aktif&unit=none')
            ->assertInertia(fn (Assert $page) => $page->component('admin/tiket')
                ->has('tickets.data', 1)
                ->where('tickets.data.0.judul', 'Belum didisposisi')
                ->where('tab_counts.belum_disposisi', 1)
                ->where('chips.0.label', 'Belum didisposisi'));

        $this->actingAs($admin)->get("/admin/tiket?unit={$this->umum->id}")
            ->assertInertia(fn (Assert $page) => $page->has('tickets.data', 1)
                ->where('tickets.data.0.unit_penangan', 'Biro Umum'));
    }

    public function test_public_tracking_shows_unit_name_not_staff(): void
    {
        $admin = $this->superAdmin();
        $ticket = $this->ticket();

        $this->get("/lacak/{$ticket->ticket_no}")
            ->assertInertia(fn (Assert $page) => $page->where('ticket.unit_penangan', null));

        $this->dispose($admin, $ticket, ['unit_id' => $this->umum->id]);

        $this->get("/lacak/{$ticket->ticket_no}")
            ->assertInertia(fn (Assert $page) => $page->where('ticket.unit_penangan', 'Biro Umum dan Layanan Pengadaan')
                ->where('ticket.petugas', null));
    }
}
