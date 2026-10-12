<?php

namespace Tests\Feature\Fixes;

use App\Models\Ticket;
use App\Models\User;
use App\Support\Nik;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * A-08 (akun nonaktif), A-09 (ganti sandi), A-10 (email unik), A-17 (login
 * NIK/username), D-01 (NIK terenkripsi + blind index).
 */
class AccountSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_deactivated_user_is_logged_out_on_web_and_api(): void
    {
        $warga = User::factory()->warga()->create(['is_active' => false]);

        $this->actingAs($warga)->get('/portal-warga')->assertRedirect('/masuk')->assertSessionHas('error');
        $this->assertGuest('web');

        $admin = User::factory()->admin()->create(['is_active' => false]);
        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/tickets')->assertForbidden();
    }

    public function test_deactivated_user_token_is_revoked(): void
    {
        $admin = User::factory()->admin()->create(['is_active' => false]);
        $token = $admin->createToken('uji')->plainTextToken;

        $this->withToken($token)->getJson('/api/v1/admin/tickets')->assertForbidden();

        $this->assertSame(0, $admin->tokens()->count());
    }

    public function test_password_change_requires_current_password_confirmation_and_strength(): void
    {
        $warga = User::factory()->warga()->create();

        $this->actingAs($warga)->patch('/portal-warga/profil', [
            'password' => 'rahasia123', 'password_confirmation' => 'rahasia123',
        ])->assertSessionHasErrors('current_password');

        $this->actingAs($warga)->patch('/portal-warga/profil', [
            'current_password' => 'salah', 'password' => 'rahasia123', 'password_confirmation' => 'rahasia123',
        ])->assertSessionHasErrors('current_password');

        $this->actingAs($warga)->patch('/portal-warga/profil', [
            'current_password' => 'password', 'password' => 'rahasia123', 'password_confirmation' => 'berbeda123',
        ])->assertSessionHasErrors('password');

        $this->actingAs($warga)->patch('/portal-warga/profil', [
            'current_password' => 'password', 'password' => 'hanyahuruf', 'password_confirmation' => 'hanyahuruf',
        ])->assertSessionHasErrors('password');

        $this->assertTrue(Hash::check('password', $warga->fresh()->password));
    }

    public function test_api_password_change_revokes_other_tokens(): void
    {
        $warga = User::factory()->warga()->create();
        $current = $warga->createToken('ini');
        $warga->createToken('lain');

        $this->withToken($current->plainTextToken)->patchJson('/api/v1/warga/profile', [
            'current_password' => 'password',
            'password' => 'SandiBaru2026',
            'password_confirmation' => 'SandiBaru2026',
        ])->assertOk();

        $this->assertTrue(Hash::check('SandiBaru2026', $warga->fresh()->password));
        $this->assertSame([$current->accessToken->id], $warga->tokens()->pluck('id')->all());
        $this->assertDatabaseHas('activity_logs', ['action' => 'account.password_changed', 'user_id' => $warga->id]);
    }

    public function test_email_must_be_unique_except_own(): void
    {
        User::factory()->warga()->create(['email' => 'dipakai@example.com']);
        $warga = User::factory()->warga()->create(['email' => 'saya@example.com']);

        $this->actingAs($warga, 'sanctum')->patchJson('/api/v1/warga/profile', ['email' => 'dipakai@example.com'])
            ->assertStatus(422)->assertJsonValidationErrors('email');

        $this->actingAs($warga, 'sanctum')->patchJson('/api/v1/warga/profile', ['email' => 'saya@example.com'])
            ->assertOk();
    }

    public function test_nik_is_encrypted_at_rest_and_login_uses_blind_index(): void
    {
        $warga = User::factory()->warga()->create(['nik' => '3171010101010077']);
        $ticket = Ticket::factory()->create(['reporter_nik' => '3171010101010077']);

        $rawUser = DB::table('users')->where('id', $warga->id)->first();
        $rawTicket = DB::table('tickets')->where('id', $ticket->id)->first();

        $this->assertNotSame('3171010101010077', $rawUser->nik);
        $this->assertNotSame('3171010101010077', $rawTicket->reporter_nik);
        $this->assertSame(Nik::hash('3171010101010077'), $rawUser->nik_hash);
        $this->assertSame(Nik::hash('3171010101010077'), $rawTicket->reporter_nik_hash);
        $this->assertSame('3171010101010077', $warga->fresh()->nik);

        $this->postJson('/api/v1/auth/login', ['identifier' => '3171010101010077', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('role', 'warga');

        $this->assertDatabaseHas('activity_logs', ['action' => 'auth.login', 'user_id' => $warga->id]);
    }

    public function test_sixteen_digit_identifier_is_never_treated_as_username(): void
    {
        // Username berbentuk 16 digit tidak boleh dapat dipakai login (ambiguitas NIK).
        User::factory()->admin()->create(['username' => '9999999999999999']);

        $this->postJson('/api/v1/auth/login', ['identifier' => '9999999999999999', 'password' => 'password'])
            ->assertUnauthorized();

        $this->assertDatabaseHas('activity_logs', ['action' => 'auth.login_failed']);
    }

    public function test_inactive_user_cannot_login(): void
    {
        $admin = User::factory()->admin()->create(['is_active' => false]);

        $this->postJson('/api/v1/auth/login', ['identifier' => $admin->username, 'password' => 'password'])
            ->assertUnauthorized();
    }
}
