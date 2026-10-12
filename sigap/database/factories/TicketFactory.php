<?php

namespace Database\Factories;

use App\Enums\TicketImpact;
use App\Enums\TicketPriority;
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
            'ticket_no' => 'TKT-'.fake()->unique()->numberBetween(1, 99999),
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