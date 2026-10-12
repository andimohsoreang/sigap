<?php

namespace Tests\Feature\Fixes;

use App\Enums\TicketStatus;
use App\Models\Ticket;
use App\Models\User;
use App\Services\TicketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * A-20: transisi status terdefinisi, resolved_at dibersihkan saat dibuka kembali.
 */
class StatusTransitionTest extends TestCase
{
    use RefreshDatabase;

    public function test_enum_defines_allowed_transitions(): void
    {
        $this->assertTrue(TicketStatus::Baru->canTransitionTo(TicketStatus::Diproses));
        $this->assertFalse(TicketStatus::Baru->canTransitionTo(TicketStatus::Selesai));
        $this->assertFalse(TicketStatus::Ditolak->canTransitionTo(TicketStatus::Selesai));
        $this->assertTrue(TicketStatus::Selesai->canTransitionTo(TicketStatus::Diproses));

        foreach (TicketStatus::cases() as $status) {
            $this->assertNotContains($status, $status->allowedTransitions());
        }
    }

    public function test_disallowed_transition_is_rejected_on_web_and_api(): void
    {
        $admin = User::factory()->admin()->create();
        $ticket = Ticket::factory()->create(['status' => TicketStatus::Baru]);

        $this->actingAs($admin)->post("/admin/tiket/{$ticket->ticket_no}/status", ['status' => 'selesai'])
            ->assertSessionHasErrors('status');

        $this->actingAs($admin, 'sanctum')->postJson("/api/v1/admin/tickets/{$ticket->ticket_no}/status", ['status' => 'selesai'])
            ->assertStatus(422)->assertJsonValidationErrors('status');

        $this->assertSame(TicketStatus::Baru, $ticket->fresh()->status);
        $this->assertDatabaseCount('ticket_histories', 0);
    }

    public function test_reopening_clears_resolved_at_and_resolving_sets_it(): void
    {
        $admin = User::factory()->admin()->create();
        $ticket = Ticket::factory()->create(['status' => TicketStatus::Diproses]);
        $service = app(TicketService::class);

        $service->changeStatus($ticket, TicketStatus::Selesai, $admin);
        $this->assertNotNull($ticket->fresh()->resolved_at);
        $this->assertNotNull($ticket->resolved_at, 'model pemanggil ikut diperbarui');

        $service->changeStatus($ticket, TicketStatus::Diproses, $admin, 'Dibuka kembali');
        $this->assertNull($ticket->fresh()->resolved_at);
        $this->assertSame(TicketStatus::Diproses, $ticket->status);
    }

    public function test_same_status_is_idempotent(): void
    {
        $ticket = Ticket::factory()->create(['status' => TicketStatus::Diproses]);

        app(TicketService::class)->changeStatus($ticket, TicketStatus::Diproses);

        $this->assertDatabaseCount('ticket_histories', 0);
    }

    public function test_service_throws_validation_exception_for_invalid_transition(): void
    {
        $ticket = Ticket::factory()->create(['status' => TicketStatus::Ditolak]);

        $this->expectException(ValidationException::class);

        app(TicketService::class)->changeStatus($ticket, TicketStatus::Selesai);
    }

    public function test_admin_detail_exposes_allowed_transitions(): void
    {
        $admin = User::factory()->admin()->create();
        $ticket = Ticket::factory()->create(['status' => TicketStatus::Baru]);

        $this->actingAs($admin)->get("/admin/tiket/{$ticket->ticket_no}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('ticket.transisi', ['verifikasi', 'diproses', 'ditolak']));
    }
}
