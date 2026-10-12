<?php

namespace Database\Factories;

use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'role' => UserRole::Warga,
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
        ];
    }

    /** Akun petugas/admin. */
    public function admin(UserRole $role = UserRole::SuperAdmin): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => $role,
            'username' => 'admin'.fake()->unique()->numerify('####'),
            'email' => fake()->unique()->safeEmail(),
        ]);
    }

    /** Akun warga dengan NIK 16 digit. */
    public function warga(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => UserRole::Warga,
            'nik' => (string) fake()->unique()->numerify('################'),
        ]);
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }
}
