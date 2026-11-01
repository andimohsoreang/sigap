<?php

namespace Tests\Feature\Web;

use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\Ticket;
use App\Models\User;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Halaman Tiket Internal (desain 01-11-2026): judul, tenggat SLA, petugas, ringkasan berjalan & lewat SLA. */
class TiketInternalRingkasanTest extends TestCase
{
    use RefreshDatabase;

    public function test_rows_carry_title_deadline_and_summary_counts(): void
    {
        $this->seed(MasterSeeder::class);
        $super = User::factory()->admin(UserRole::SuperAdmin)->create();
        $petugas = User::factory()->admin(UserRole::SuperAdmin)->create(['name' => 'Rina Petugas']);

        Ticket::factory()->internal()->create(['ticket_no' => 'INT-LEWAT', 'title' => 'AC ruang rapat mati', 'status' => TicketStatus::Diproses, 'sla_due_at' => now()->subDay(), 'assignee_id' => $petugas->id]);
        Ticket::factory()->internal()->create(['ticket_no' => 'INT-AMAN', 'status' => TicketStatus::Baru, 'sla_due_at' => now()->addDays(3)]);
        Ticket::factory()->internal()->create(['ticket_no' => 'INT-SELESAI', 'status' => TicketStatus::Selesai, 'sla_due_at' => now()->subDays(5)]);
        Ticket::factory()->create(['ticket_no' => 'PUB-LEWAT', 'status' => TicketStatus::Baru, 'sla_due_at' => now()->subDay()]);

        $this->actingAs($super)->get('/admin/tiket-internal?q=INT-LEWAT')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('admin/internal')
            ->where('tickets.data.0.judul', 'AC ruang rapat mati')
            ->where('tickets.data.0.petugas', 'Rina Petugas')
            ->where('tickets.data.0.overdue', true)
            ->whereType('tickets.data.0.tenggat_sla', 'string')
            // Ringkasan hanya menghitung tiket internal yang masih berjalan.
            ->where('stats.berjalan', 2)
            ->where('stats.ews', 1));
    }
}
