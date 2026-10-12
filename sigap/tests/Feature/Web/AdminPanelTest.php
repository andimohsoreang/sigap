<?php

namespace Tests\Feature\Web;

use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\Category;
use App\Models\Region;
use App\Models\Setting;
use App\Models\Ticket;
use App\Models\User;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminPanelTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
    }

    private function superAdmin(): User
    {
        return User::factory()->admin(UserRole::SuperAdmin)->create();
    }

    private function adminKawasan(Region $region): User
    {
        return User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => $region->id]);
    }

    public function test_guest_and_warga_cannot_open_admin_panel(): void
    {
        $this->get('/admin')->assertRedirect('/masuk');

        $warga = User::factory()->warga()->create();
        $this->actingAs($warga)->get('/admin')->assertRedirect('/portal-warga');
    }

    public function test_super_admin_can_open_every_admin_page(): void
    {
        $admin = $this->superAdmin();
        Region::factory()->create();

        foreach ([
            '/admin/matriks' => 'admin/matriks',
            '/admin/tiket' => 'admin/tiket',
            '/admin/tiket-internal' => 'admin/internal',
            '/admin/input-manual' => 'admin/input-manual',
            '/admin/chat' => 'admin/chat',
            '/admin/petugas' => 'admin/admins',
            '/admin/kawasan' => 'admin/kawasan',
            '/admin/kanal' => 'admin/kanal',
            '/admin/pengaturan' => 'admin/pengaturan',
        ] as $url => $component) {
            $this->actingAs($admin)->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page->component($component));
        }
    }

    public function test_admin_kawasan_cannot_open_super_admin_pages(): void
    {
        $admin = $this->adminKawasan(Region::factory()->create());

        // Peran admin_kawasan pada rute khusus super_admin → 403, bukan redirect
        // (lihat SEC-07 & SecurityHardeningTest).
        $this->actingAs($admin)->get('/admin/petugas')->assertForbidden();
    }

    public function test_matriks_is_scoped_to_admin_region(): void
    {
        $regionA = Region::factory()->create();
        $regionB = Region::factory()->create();
        $admin = $this->adminKawasan($regionA);

        Ticket::factory()->create(['ticket_no' => 'TKT-A1', 'region_id' => $regionA->id]);
        Ticket::factory()->create(['ticket_no' => 'TKT-B1', 'region_id' => $regionB->id]);

        $this->actingAs($admin)
            ->get('/admin/matriks')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/matriks')
                ->has('tickets.data', 1)
                ->where('tickets.data.0.nomor', 'TKT-A1')
            );
    }

    public function test_admin_can_change_status_and_history_is_recorded(): void
    {
        $admin = $this->superAdmin();
        $ticket = Ticket::factory()->create(['status' => TicketStatus::Baru]);

        $this->actingAs($admin)
            ->post("/admin/tiket/{$ticket->ticket_no}/status", ['status' => 'diproses', 'note' => 'Ditindaklanjuti'])
            ->assertRedirect();

        $ticket->refresh();
        $this->assertSame(TicketStatus::Diproses, $ticket->status);
        $this->assertDatabaseHas('ticket_histories', ['ticket_id' => $ticket->id, 'to_status' => 'diproses']);
    }

    public function test_admin_can_reply_to_ticket(): void
    {
        $admin = $this->superAdmin();
        $ticket = Ticket::factory()->create();

        $this->actingAs($admin)
            ->post("/admin/tiket/{$ticket->ticket_no}/tanggapan", ['body' => 'Terima kasih atas laporannya.', 'is_public' => true])
            ->assertRedirect();

        $this->assertDatabaseHas('ticket_replies', ['ticket_id' => $ticket->id, 'body' => 'Terima kasih atas laporannya.']);
    }

    public function test_admin_can_create_manual_ticket(): void
    {
        $admin = $this->superAdmin();
        $region = Region::factory()->create();
        $category = Category::first();

        $this->actingAs($admin)
            ->post('/admin/input-manual', [
                'sumber_laporan' => 'instagram',
                'nama' => 'warga_ig',
                'judul' => 'Aduan via IG',
                'uraian' => 'Keluhan warga lewat Instagram minimal sepuluh',
                'region_id' => $region->id,
                'category_id' => $category->id,
                'impact' => 'sedang',
            ])
            ->assertRedirect('/admin/matriks');

        $this->assertDatabaseHas('tickets', ['title' => 'Aduan via IG', 'reporter_name' => 'warga_ig']);
    }

    public function test_admin_can_manage_regions(): void
    {
        $admin = $this->superAdmin();

        $this->actingAs($admin)->post('/admin/kawasan', [
            'code' => 'KWS-NEW',
            'name' => 'SP Baru',
            'province' => 'Papua',
            'infrastructure_status' => 'Memadai',
        ])->assertRedirect();

        $region = Region::where('code', 'KWS-NEW')->firstOrFail();

        $this->actingAs($admin)->put("/admin/kawasan/{$region->id}", ['name' => 'SP Diubah'])->assertRedirect();
        $this->assertSame('SP Diubah', $region->fresh()->name);

        $this->actingAs($admin)->delete("/admin/kawasan/{$region->id}")->assertRedirect();
        $this->assertDatabaseMissing('regions', ['id' => $region->id]);
    }

    public function test_admin_can_add_and_delete_category(): void
    {
        $admin = $this->superAdmin();

        $this->actingAs($admin)->post('/admin/kategori', ['name' => 'Kategori Baru'])->assertRedirect();
        $category = Category::where('name', 'Kategori Baru')->firstOrFail();

        $this->actingAs($admin)->delete("/admin/kategori/{$category->id}")->assertRedirect();
        $this->assertDatabaseMissing('categories', ['id' => $category->id]);
    }

    public function test_super_admin_can_sync_integration_and_log_is_written(): void
    {
        $admin = $this->superAdmin();

        $this->actingAs($admin)->post('/admin/integrasi/sp4n')->assertRedirect();

        $this->assertDatabaseCount('channel_sync_logs', 1);
    }

    public function test_admin_kawasan_cannot_trigger_integration_sync(): void
    {
        $admin = $this->adminKawasan(Region::factory()->create());

        $this->actingAs($admin)->post('/admin/integrasi/sp4n')->assertForbidden();

        $this->assertDatabaseCount('channel_sync_logs', 0);
    }

    public function test_admin_can_update_settings(): void
    {
        $admin = $this->superAdmin();

        $this->actingAs($admin)->put('/admin/pengaturan', [
            'sla_response_minutes' => 45,
            'ews_enabled' => true,
            'auto_disposition' => true,
        ])->assertRedirect();

        $this->assertSame(45, Setting::get('sla_response_minutes'));
        $this->assertTrue((bool) Setting::get('ews_enabled'));
    }

    public function test_super_admin_can_create_another_admin(): void
    {
        $admin = $this->superAdmin();
        $region = Region::factory()->create();

        $this->actingAs($admin)->post('/admin/petugas', [
            'name' => 'Petugas Baru',
            'nip' => 'NIP-999',
            'role' => UserRole::AdminKawasan->value,
            'region_id' => $region->id,
            'password' => 'rahasia123',
        ])->assertRedirect();

        $this->assertDatabaseHas('users', ['username' => 'NIP-999', 'role' => 'admin_kawasan']);
    }

    /* ------------------- DataTable: filter, sort, pagination ------------------ */

    public function test_tiket_datatable_sorts_by_whitelisted_column(): void
    {
        $admin = $this->superAdmin();
        Ticket::factory()->create(['ticket_no' => 'TKT-C3', 'title' => 'Banjir']);
        Ticket::factory()->create(['ticket_no' => 'TKT-A1', 'title' => 'Aspal rusak']);
        Ticket::factory()->create(['ticket_no' => 'TKT-B2', 'title' => 'Drainase']);

        $this->actingAs($admin)
            ->get('/admin/tiket?sort=nomor:asc')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('tickets.data.0.nomor', 'TKT-A1')
                ->where('tickets.data.1.nomor', 'TKT-B2')
                ->where('tickets.data.2.nomor', 'TKT-C3')
            );

        $this->actingAs($admin)
            ->get('/admin/tiket?sort=nomor:desc')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('tickets.data.0.nomor', 'TKT-C3'));
    }

    public function test_tiket_datatable_ignores_unwhitelisted_sort_column(): void
    {
        $admin = $this->superAdmin();
        Ticket::factory()->create(['ticket_no' => 'TKT-LAMA', 'created_at' => now()->subDay()]);
        $baru = Ticket::factory()->create(['ticket_no' => 'TKT-BARU', 'created_at' => now()]);

        // Kolom berbahaya → diabaikan, jatuh ke urutan default (terbaru dulu).
        $this->actingAs($admin)
            ->get('/admin/tiket?sort=password:asc')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('tickets.data.0.nomor', $baru->ticket_no));
    }

    public function test_tiket_datatable_filters_and_searches(): void
    {
        $admin = $this->superAdmin();
        Ticket::factory()->create(['ticket_no' => 'TKT-X1', 'title' => 'Jalan berlubang', 'status' => TicketStatus::Baru]);
        Ticket::factory()->create(['ticket_no' => 'TKT-X2', 'title' => 'Lampu mati', 'status' => TicketStatus::Selesai]);

        $this->actingAs($admin)
            ->get('/admin/tiket?status=selesai')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('tickets.data', 1)->where('tickets.data.0.nomor', 'TKT-X2'));

        $this->actingAs($admin)
            ->get('/admin/tiket?q=berlubang')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('tickets.data', 1)->where('tickets.data.0.nomor', 'TKT-X1'));
    }

    public function test_tiket_datatable_respects_per_page(): void
    {
        $admin = $this->superAdmin();
        Ticket::factory()->count(12)->create();

        $this->actingAs($admin)
            ->get('/admin/tiket?per_page=5')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('tickets.data', 5)
                ->where('tickets.meta.per_page', 5)
                ->where('tickets.meta.total', 12)
            );
    }

    public function test_tiket_internal_datatable_filters_and_searches(): void
    {
        $admin = $this->superAdmin();
        Ticket::factory()->create(['ticket_no' => 'INT-1', 'title' => 'AC rusak', 'reporter_name' => 'Budi', 'is_internal' => true, 'status' => TicketStatus::Baru]);
        Ticket::factory()->create(['ticket_no' => 'INT-2', 'title' => 'Printer rusak', 'reporter_name' => 'Sari', 'is_internal' => true, 'status' => TicketStatus::Selesai]);
        Ticket::factory()->create(['ticket_no' => 'PUB-1', 'title' => 'Publik', 'is_internal' => false]);

        $this->actingAs($admin)
            ->get('/admin/tiket-internal?q=Budi')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('tickets.data', 1)->where('tickets.data.0.nomor', 'INT-1'));

        $this->actingAs($admin)
            ->get('/admin/tiket-internal?status=selesai')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('tickets.data', 1)->where('tickets.data.0.nomor', 'INT-2'));
    }

    public function test_activity_log_datatable_sorts_and_searches(): void
    {
        $admin = $this->superAdmin();
        ActivityLog::create(['username' => 'zeta', 'action' => 'region.created', 'description' => 'Zona baru']);
        ActivityLog::create(['username' => 'alfa', 'action' => 'admin.created', 'description' => 'Admin baru']);

        $this->actingAs($admin)
            ->get('/admin/log-aktivitas?sort=username:asc')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('logs.data.0.username', 'alfa')
                ->where('logs.data.1.username', 'zeta')
            );

        $this->actingAs($admin)
            ->get('/admin/log-aktivitas?action=region.created')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('logs.data', 1)->where('logs.data.0.username', 'zeta'));
    }
}