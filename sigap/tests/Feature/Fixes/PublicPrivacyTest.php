<?php

namespace Tests\Feature\Fixes;

use App\Enums\TicketVisibility;
use App\Enums\UserRole;
use App\Models\Region;
use App\Models\Ticket;
use App\Models\TicketReply;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A-02 / A-21: penyamaran identitas pada pelacakan publik & portal warga.
 */
class PublicPrivacyTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_resource_masks_reporter_nik_and_staff(): void
    {
        $petugas = User::factory()->admin()->create(['name' => 'Petugas Rahasia']);
        $warga = User::factory()->warga()->create();

        $ticket = Ticket::factory()->forReporter($warga)->create([
            'reporter_name' => 'Budi Santoso',
            'reporter_nik' => '3171010101010001',
            'assignee_id' => $petugas->id,
        ]);
        TicketReply::create(['ticket_id' => $ticket->id, 'author_id' => $petugas->id, 'body' => 'Sedang kami tangani.']);
        TicketReply::create(['ticket_id' => $ticket->id, 'author_id' => $warga->id, 'body' => 'Terima kasih.']);
        TicketReply::create(['ticket_id' => $ticket->id, 'author_id' => $petugas->id, 'body' => 'Catatan internal', 'is_public' => false]);

        $response = $this->getJson("/api/v1/tiket/{$ticket->ticket_no}")
            ->assertOk()
            ->assertJsonPath('data.pelapor', 'B*** S***')
            ->assertJsonPath('data.nik', null)
            ->assertJsonPath('data.petugas', null)
            ->assertJsonCount(2, 'data.tanggapan')
            ->assertJsonPath('data.tanggapan.0.author', 'Petugas SIGAP')
            ->assertJsonPath('data.tanggapan.1.author', 'Pelapor');

        $body = $response->getContent();
        $this->assertStringNotContainsString('Petugas Rahasia', $body);
        $this->assertStringNotContainsString('3171010101010001', $body);
        $this->assertStringNotContainsString('Catatan internal', $body);
    }

    public function test_anonymous_ticket_shows_anonim(): void
    {
        $ticket = Ticket::factory()->create(['visibility' => TicketVisibility::Anonim, 'reporter_name' => 'Siti']);

        $this->getJson("/api/v1/tiket/{$ticket->ticket_no}")->assertOk()->assertJsonPath('data.pelapor', 'Anonim');
    }

    public function test_confidential_ticket_hidden_from_public_but_visible_to_owner_and_admin(): void
    {
        $region = Region::factory()->create();
        $owner = User::factory()->warga()->create();
        $other = User::factory()->warga()->create();
        $kawasanLain = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => Region::factory()->create()->id]);
        $super = User::factory()->admin()->create();

        $ticket = Ticket::factory()->forReporter($owner)->create([
            'visibility' => TicketVisibility::Rahasia,
            'region_id' => $region->id,
        ]);
        $url = "/api/v1/tiket/{$ticket->ticket_no}";

        $this->getJson($url)->assertNotFound();
        $this->actingAs($other, 'sanctum')->getJson($url)->assertNotFound();
        $this->actingAs($kawasanLain, 'sanctum')->getJson($url)->assertNotFound();
        $this->actingAs($owner, 'sanctum')->getJson($url)->assertOk()->assertJsonPath('data.pelapor', 'Anonim');
        $this->actingAs($super, 'sanctum')->getJson($url)->assertOk();
    }

    public function test_track_page_hides_confidential_ticket_from_guest(): void
    {
        $ticket = Ticket::factory()->create(['visibility' => TicketVisibility::Rahasia]);

        $this->get("/lacak/{$ticket->ticket_no}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('ticket', false));
    }

    public function test_admin_api_still_shows_full_identity(): void
    {
        $admin = User::factory()->admin()->create();
        $ticket = Ticket::factory()->create(['reporter_name' => 'Budi Santoso', 'reporter_nik' => '3171010101010001']);

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/v1/admin/tickets/{$ticket->ticket_no}")
            ->assertOk()
            ->assertJsonPath('data.pelapor', 'Budi Santoso')
            ->assertJsonPath('data.nik', '3171********0001');
    }

    public function test_warga_portal_only_sends_masked_nik(): void
    {
        $warga = User::factory()->warga()->create(['nik' => '3171010101010009']);

        $this->actingAs($warga)->get('/portal-warga')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('profile.nik', '3171********0009')
                ->where('profile.nik_masked', '3171********0009'));
    }
}
