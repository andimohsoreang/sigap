<?php

namespace Tests\Feature\Api;

use App\Enums\TicketImpact;
use App\Enums\UserRole;
use App\Models\Region;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminApiTest extends TestCase
{
    use RefreshDatabase;

    private function admin(UserRole $role = UserRole::SuperAdmin, ?int $regionId = null): User
    {
        return User::factory()->admin($role)->create(['region_id' => $regionId]);
    }

    public function test_guest_cannot_access_admin_endpoints(): void
    {
        $this->getJson('/api/v1/admin/tickets')->assertUnauthorized();
        $this->getJson('/api/v1/admin/pengaturan')->assertUnauthorized();
    }

    public function test_warga_cannot_access_admin_endpoints(): void
    {
        $warga = User::factory()->warga()->create();

        $this->actingAs($warga, 'sanctum')
            ->getJson('/api/v1/admin/tickets')
            ->assertUnauthorized();
    }

    public function test_admin_can_list_tickets(): void
    {
        Ticket::factory()->count(3)->create();
        $admin = $this->admin();

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/tickets')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('meta.total', 3);
    }

    public function test_admin_can_change_ticket_status_and_history_is_recorded(): void
    {
        $ticket = Ticket::factory()->create();
        $admin = $this->admin();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/admin/tickets/{$ticket->ticket_no}/status", [
                'status' => 'diproses',
                'note' => 'Diverifikasi',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'diproses');

        $this->assertDatabaseHas('ticket_histories', [
            'ticket_id' => $ticket->id,
            'to_status' => 'diproses',
        ]);
    }

    public function test_admin_kawasan_only_sees_own_region_tickets(): void
    {
        $mine = Region::factory()->create();
        $other = Region::factory()->create();

        Ticket::factory()->create(['region_id' => $mine->id]);
        Ticket::factory()->create(['region_id' => $other->id]);

        $admin = $this->admin(UserRole::AdminKawasan, $mine->id);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/tickets')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_rekap_sla_pct_is_not_always_zero(): void
    {
        $admin = $this->admin();

        // Satu tiket selesai tepat waktu, satu terlambat.
        Ticket::factory()->create([
            'status' => 'selesai',
            'sla_due_at' => now()->addDay(),
            'resolved_at' => now(),
        ]);
        Ticket::factory()->create([
            'status' => 'selesai',
            'sla_due_at' => now()->subDays(2),
            'resolved_at' => now(),
        ]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/rekap')->assertOk();

        $this->assertSame(50.0, (float) $response->json('sla_pct'));
    }

    public function test_only_super_admin_can_manage_admins(): void
    {
        $kawasan = $this->admin(UserRole::AdminKawasan);

        $this->actingAs($kawasan, 'sanctum')
            ->getJson('/api/v1/admin/admins')
            ->assertUnauthorized();
    }

    public function test_integration_sync_runs_stub_adapters(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/admin/integrasi/sp4n')
            ->assertOk()
            ->assertJsonPath('stub', true)
            ->assertJsonPath('channel', 'sp4n');

        $this->assertDatabaseCount('channel_sync_logs', 1);
    }
}