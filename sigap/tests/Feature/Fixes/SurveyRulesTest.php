<?php

namespace Tests\Feature\Fixes;

use App\Enums\TicketStatus;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A-07: satu survei per tiket, hanya tiket Selesai, dan hanya pelapor.
 */
class SurveyRulesTest extends TestCase
{
    use RefreshDatabase;

    public function test_second_survey_is_rejected_without_overwrite(): void
    {
        $ticket = Ticket::factory()->create(['ticket_no' => 'TKT-261012-SRVAAA', 'status' => TicketStatus::Selesai]);

        $this->postJson('/api/v1/survei/TKT-261012-SRVAAA', ['rating' => 5, 'comment' => 'Pertama'])->assertCreated();
        $this->postJson('/api/v1/survei/tkt-261012-srvaaa', ['rating' => 1, 'comment' => 'Kedua'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('ticket');

        $this->post('/lacak/survei', ['ticket' => 'TKT-261012-SRVAAA', 'rating' => 2])->assertSessionHasErrors('ticket');

        $this->assertDatabaseCount('surveys', 1);
        $this->assertSame(5, $ticket->survey()->first()->rating);
    }

    public function test_api_rejects_survey_for_unfinished_ticket(): void
    {
        Ticket::factory()->create(['ticket_no' => 'TKT-261012-SRVBBB', 'status' => TicketStatus::Diproses]);

        $this->postJson('/api/v1/survei/TKT-261012-SRVBBB', ['rating' => 4])
            ->assertStatus(422)
            ->assertJsonValidationErrors('ticket');

        $this->assertDatabaseCount('surveys', 0);
    }

    public function test_ticket_with_account_can_only_be_rated_by_its_reporter(): void
    {
        $owner = User::factory()->warga()->create();
        $other = User::factory()->warga()->create();
        Ticket::factory()->forReporter($owner)->create(['ticket_no' => 'TKT-261012-SRVCCC', 'status' => TicketStatus::Selesai]);

        $this->postJson('/api/v1/survei/TKT-261012-SRVCCC', ['rating' => 3])->assertForbidden();
        $this->actingAs($other, 'sanctum')->postJson('/api/v1/survei/TKT-261012-SRVCCC', ['rating' => 3])->assertForbidden();
        $this->actingAs($other)->post('/lacak/survei', ['ticket' => 'TKT-261012-SRVCCC', 'rating' => 3])->assertForbidden();

        $this->actingAs($owner)->post('/lacak/survei', ['ticket' => 'TKT-261012-SRVCCC', 'rating' => 4])->assertRedirect('/lacak/TKT-261012-SRVCCC');

        $this->assertDatabaseCount('surveys', 1);
    }
}
