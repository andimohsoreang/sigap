<?php

namespace Database\Factories;

use App\Enums\TicketImpact;
use App\Enums\TicketStatus;
use App\Enums\TicketVisibility;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

/**
 * @extends Factory<Ticket>
 */
class TicketFactory extends Factory
{
    protected $model = Ticket::class;

    public function definition(): array
    {
        $impact = fake()->randomElement(TicketImpact::cases());

        return [
            // Format baru TKT-YYMMDD-XXXXXX (format lama butuh kode akses bagi tamu).
            'ticket_no' => 'TKT-'.now()->format('ymd').'-'.fake()->unique()->regexify('['.Ticket::NUMBER_ALPHABET.']{6}'),
            'title' => fake()->sentence(4),
            'description' => fake()->paragraph(),
            'status' => TicketStatus::Baru,
            'priority' => $impact->priority(),
            'impact' => $impact,
            'visibility' => TicketVisibility::Publik,
            'is_internal' => false,
            'reporter_name' => fake()->name(),
            'reporter_nik' => fake()->numerify('################'),
            'sla_due_at' => Carbon::now()->addDays(7),
            'created_at' => Carbon::now(),
            'updated_at' => Carbon::now(),
        ];
    }

    public function internal(): static
    {
        return $this->state(fn () => [
            'is_internal' => true,
            'region_id' => null,
            'sla_due_at' => null,
        ]);
    }

    public function forReporter(User $user): static
    {
        return $this->state(fn () => [
            'reporter_id' => $user->id,
            'reporter_nik' => $user->nik,
        ]);
    }
}
