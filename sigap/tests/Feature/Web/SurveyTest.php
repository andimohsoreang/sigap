<?php

namespace Tests\Feature\Web;

use App\Enums\TicketStatus;
use App\Models\Ticket;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SurveyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
    }

    public function test_public_survey_is_stored_for_completed_ticket(): void
    {
        $ticket = Ticket::factory()->create([
            'ticket_no' => 'TKT-500',
            'status' => TicketStatus::Selesai,
        ]);

        $this->post('/lacak/survei', [
            'ticket' => 'TKT-500',
            'kode' => $ticket->lookup_token,
            'rating' => 5,
            'comment' => 'Pelayanan sangat cepat.',
        ])->assertRedirect('/lacak/TKT-500?kode='.$ticket->lookup_token);

        $this->assertDatabaseHas('surveys', [
            'ticket_id' => $ticket->id,
            'rating' => 5,
            'comment' => 'Pelayanan sangat cepat.',
        ]);
    }

    public function test_survey_is_rejected_for_ticket_not_finished(): void
    {
        $ticket = Ticket::factory()->create(['ticket_no' => 'TKT-501', 'status' => TicketStatus::Diproses]);

        $this->post('/lacak/survei', ['ticket' => 'TKT-501', 'kode' => $ticket->lookup_token, 'rating' => 4])->assertSessionHasErrors('ticket');

        $this->assertDatabaseCount('surveys', 0);
    }

    public function test_survey_is_rejected_for_internal_ticket(): void
    {
        Ticket::factory()->create([
            'ticket_no' => 'TKT-502',
            'status' => TicketStatus::Selesai,
            'is_internal' => true,
        ]);

        $this->post('/lacak/survei', ['ticket' => 'TKT-502', 'rating' => 5])
            ->assertRedirect()
            ->assertSessionHas('error');

        $this->assertDatabaseCount('surveys', 0);
    }

    public function test_rating_must_be_between_one_and_five(): void
    {
        $ticket = Ticket::factory()->create(['ticket_no' => 'TKT-503', 'status' => TicketStatus::Selesai]);

        $this->post('/lacak/survei', ['ticket' => 'TKT-503', 'kode' => $ticket->lookup_token, 'rating' => 9])
            ->assertSessionHasErrors('rating');
    }

    public function test_track_page_reports_survey_already_submitted(): void
    {
        $ticket = Ticket::factory()->create(['ticket_no' => 'TKT-504', 'status' => TicketStatus::Selesai]);
        $ticket->survey()->create(['rating' => 4]);

        $this->get('/lacak/TKT-504?kode='.$ticket->lookup_token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('ticket.sudah_disurvei', true));
    }
}
