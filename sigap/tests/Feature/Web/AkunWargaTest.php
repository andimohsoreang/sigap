<?php

namespace Tests\Feature\Web;

use App\Enums\UserRole;
use App\Http\Controllers\Web\LupaSandiController;
use App\Models\User;
use App\Notifications\AturUlangSandi;
use App\Notifications\VerifikasiEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Daftar akun warga, verifikasi surel, dan lupa kata sandi. */
class AkunWargaTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $override = []): array
    {
        return array_merge([
            'nik' => '3273010101900099',
            'nama' => 'Siti Aminah',
            'email' => 'Siti@Example.com',
            'telepon' => '081234567890',
            'password' => 'rahasia123',
            'password_confirmation' => 'rahasia123',
            'setuju' => true,
        ], $override);
    }

    public function test_register_page_renders(): void
    {
        $this->get('/daftar')->assertOk()->assertInertia(fn (Assert $page) => $page->component('public/daftar'));
    }

    public function test_warga_can_register_and_must_verify_before_portal(): void
    {
        Notification::fake();

        $this->post('/daftar', $this->payload())->assertRedirect('/verifikasi-email');

        $user = User::findByNik('3273010101900099');
        $this->assertNotNull($user);
        $this->assertSame(UserRole::Warga, $user->role);
        $this->assertSame('siti@example.com', $user->email);
        $this->assertNull($user->email_verified_at);
        $this->assertAuthenticatedAs($user);
        Notification::assertSentTo($user, VerifikasiEmail::class);
        $this->assertDatabaseHas('activity_logs', ['action' => 'account.registered', 'user_id' => $user->id]);

        // Portal tertutup sampai surel diverifikasi.
        $this->get('/portal-warga')->assertRedirect('/verifikasi-email');
        $this->get('/verifikasi-email')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('public/verifikasi-email')
            ->where('email', 'si***@example.com'));
    }

    public function test_registration_rejects_duplicate_nik_and_email_and_weak_password(): void
    {
        User::factory()->warga()->create(['nik' => '3273010101900099', 'email' => 'siti@example.com']);

        $this->post('/daftar', $this->payload(['password' => 'pendek', 'password_confirmation' => 'pendek']))
            ->assertSessionHasErrors(['nik', 'email', 'password']);

        $this->post('/daftar', $this->payload(['nik' => '12345', 'email' => 'baru@example.com', 'setuju' => false]))
            ->assertSessionHasErrors(['nik', 'setuju']);

        $this->assertSame(1, User::query()->count());
    }

    public function test_signed_link_verifies_email_and_opens_portal(): void
    {
        $user = User::factory()->warga()->unverified()->create();

        $url = URL::temporarySignedRoute('verification.verify', now()->addMinutes(60), [
            'id' => $user->id,
            'hash' => sha1($user->email),
        ]);

        $this->actingAs($user)->get($url)->assertRedirect('/portal-warga');

        $this->assertNotNull($user->fresh()->email_verified_at);
        $this->actingAs($user)->get('/portal-warga')->assertOk();
    }

    public function test_tampered_verification_link_is_rejected(): void
    {
        $user = User::factory()->warga()->unverified()->create();

        $this->actingAs($user)->get("/verifikasi-email/{$user->id}/".sha1($user->email))->assertForbidden();
        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_unverified_warga_can_resend_and_fix_email(): void
    {
        Notification::fake();
        $user = User::factory()->warga()->unverified()->create(['email' => 'salah@example.com']);

        $this->actingAs($user)->post('/verifikasi-email/kirim-ulang')->assertSessionHas('status');
        Notification::assertSentToTimes($user, VerifikasiEmail::class, 1);

        $this->actingAs($user)->post('/verifikasi-email/ganti', ['email' => 'benar@example.com'])->assertSessionHas('status');
        $this->assertSame('benar@example.com', $user->fresh()->email);
        Notification::assertSentToTimes($user, VerifikasiEmail::class, 2);
    }

    public function test_existing_verified_warga_and_admin_are_not_blocked(): void
    {
        $warga = User::factory()->warga()->create();
        $admin = User::factory()->admin()->unverified()->create();

        $this->actingAs($warga)->get('/portal-warga')->assertOk();
        $this->actingAs($admin)->get('/admin')->assertOk();
        $this->actingAs($admin)->get('/verifikasi-email')->assertRedirect('/admin');
    }

    public function test_changing_email_in_portal_requires_reverification(): void
    {
        Notification::fake();
        $warga = User::factory()->warga()->create(['email' => 'lama@example.com']);

        $this->actingAs($warga)->patch('/portal-warga/profil', ['email' => 'baru@example.com'])->assertRedirect();

        $this->assertNull($warga->fresh()->email_verified_at);
        Notification::assertSentTo($warga, VerifikasiEmail::class);
    }

    public function test_forgot_password_by_nik_sends_link_and_message_is_generic(): void
    {
        Notification::fake();
        $warga = User::factory()->warga()->create(['nik' => '3273010101900077', 'email' => 'warga@example.com']);

        $this->post('/lupa-sandi', ['identifier' => '3273010101900077'])
            ->assertSessionHas('status', LupaSandiController::SENT_MESSAGE);
        Notification::assertSentTo($warga, AturUlangSandi::class);

        // Akun tidak ada: pesan sama persis, tidak ada surel.
        $this->post('/lupa-sandi', ['identifier' => '9999999999999999'])
            ->assertSessionHas('status', LupaSandiController::SENT_MESSAGE);
        Notification::assertSentTimes(AturUlangSandi::class, 1);
    }

    public function test_forgot_password_ignores_admin_accounts(): void
    {
        Notification::fake();
        $admin = User::factory()->admin()->create(['email' => 'petugas@example.com']);

        $this->post('/lupa-sandi', ['identifier' => 'petugas@example.com'])->assertSessionHas('status');

        Notification::assertNothingSentTo($admin);
    }

    public function test_reset_link_sets_new_password_and_verifies_email(): void
    {
        $warga = User::factory()->warga()->unverified()->create(['email' => 'warga@example.com', 'password' => 'lamaSekali1']);
        $token = Password::broker()->createToken($warga);

        $this->get("/atur-ulang-sandi/{$token}?email=warga@example.com")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('public/atur-ulang-sandi')->where('email', 'warga@example.com'));

        $this->post('/atur-ulang-sandi', [
            'token' => $token,
            'email' => 'warga@example.com',
            'password' => 'baruSekali2',
            'password_confirmation' => 'baruSekali2',
        ])->assertRedirect('/masuk')->assertSessionHas('status');

        $warga->refresh();
        $this->assertTrue(Hash::check('baruSekali2', $warga->password));
        $this->assertNotNull($warga->email_verified_at);
        $this->assertDatabaseHas('activity_logs', ['action' => 'account.password_reset']);
    }

    public function test_invalid_reset_token_is_rejected(): void
    {
        $warga = User::factory()->warga()->create(['email' => 'warga@example.com', 'password' => 'lamaSekali1']);

        $this->post('/atur-ulang-sandi', [
            'token' => 'palsu',
            'email' => 'warga@example.com',
            'password' => 'baruSekali2',
            'password_confirmation' => 'baruSekali2',
        ])->assertSessionHasErrors('password');

        $this->assertTrue(Hash::check('lamaSekali1', $warga->fresh()->password));
    }

    public function test_login_page_links_to_register_and_reset(): void
    {
        $this->get('/masuk')->assertInertia(fn (Assert $page) => $page->where('canResetPassword', true));
    }
}
