<?php

namespace Tests\Feature\Web;

use App\Enums\TicketStatus;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class WargaPortalTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_is_redirected_to_masuk(): void
    {
        $this->get('/portal-warga')->assertRedirect('/masuk');
    }

    public function test_warga_can_open_portal_and_only_sees_own_tickets(): void
    {
        $warga = User::factory()->warga()->create(['name' => 'Budi Santoso']);
        $other = User::factory()->warga()->create();

        Ticket::factory()->forReporter($warga)->create(['ticket_no' => 'TKT-100', 'title' => 'Milik Budi']);
        Ticket::factory()->forReporter($other)->create(['ticket_no' => 'TKT-200', 'title' => 'Milik Orang Lain']);

        $this->actingAs($warga)
            ->get('/portal-warga')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('warga/portal')
                ->where('profile.nama', 'Budi Santoso')
                ->where('profile.inisial', 'BS')
                ->has('tickets', 1)
                ->where('tickets.0.nomor', 'TKT-100')
            );
    }

    public function test_admin_is_bounced_from_portal_to_dashboard(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->get('/portal-warga')->assertRedirect('/admin');
    }

    public function test_warga_cannot_open_admin_dashboard(): void
    {
        $warga = User::factory()->warga()->create();

        $this->actingAs($warga)->get('/admin')->assertRedirect('/portal-warga');
    }

    public function test_warga_can_update_profile_and_password(): void
    {
        $warga = User::factory()->warga()->create(['email' => 'lama@example.com']);

        $this->actingAs($warga)->patch('/portal-warga/profil', [
            'email' => 'baru@example.com',
            'telp' => '0812000111',
            'password' => 'rahasia123',
            'password_confirmation' => 'rahasia123',
        ])->assertRedirect();

        $warga->refresh();
        $this->assertSame('baru@example.com', $warga->email);
        $this->assertSame('0812000111', $warga->phone);
        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('rahasia123', $warga->password));
    }

    public function test_warga_can_delete_own_new_ticket(): void
    {
        $warga = User::factory()->warga()->create();
        $ticket = Ticket::factory()->forReporter($warga)->create(['status' => TicketStatus::Baru]);

        $this->actingAs($warga)->delete("/portal-warga/tiket/{$ticket->ticket_no}")->assertRedirect();

        $this->assertDatabaseMissing('tickets', ['id' => $ticket->id]);
    }

    public function test_warga_cannot_delete_ticket_in_progress(): void
    {
        $warga = User::factory()->warga()->create();
        $ticket = Ticket::factory()->forReporter($warga)->create(['status' => TicketStatus::Diproses]);

        $this->actingAs($warga)->delete("/portal-warga/tiket/{$ticket->ticket_no}")->assertStatus(422);

        $this->assertDatabaseHas('tickets', ['id' => $ticket->id]);
    }

    public function test_warga_cannot_delete_another_users_ticket(): void
    {
        $warga = User::factory()->warga()->create();
        $other = User::factory()->warga()->create();
        $ticket = Ticket::factory()->forReporter($other)->create(['status' => TicketStatus::Baru]);

        $this->actingAs($warga)->delete("/portal-warga/tiket/{$ticket->ticket_no}")->assertStatus(403);

        $this->assertDatabaseHas('tickets', ['id' => $ticket->id]);
    }
}