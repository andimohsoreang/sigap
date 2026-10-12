<?php

namespace Database\Factories;

use App\Models\Region;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Region>
 */
class RegionFactory extends Factory
{
    protected $model = Region::class;

    public function definition(): array
    {
        return [
            'code' => 'KWS-'.fake()->unique()->numerify('####'),
            'name' => 'SP'.fake()->numberBetween(1, 20).' '.fake()->city(),
            'province' => fake()->state(),
            'latitude' => fake()->latitude(),
            'longitude' => fake()->longitude(),
            'geometry' => null,
            'infrastructure_status' => fake()->randomElement(['Memadai', 'Berkembang', 'Kurang']),
            'kk_count' => fake()->numberBetween(50, 800),
            'is_active' => true,
        ];
    }
}
