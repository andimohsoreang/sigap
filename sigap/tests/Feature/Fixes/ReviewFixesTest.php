<?php

namespace Tests\Feature\Fixes;

use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\Region;
use App\Models\Ticket;
use App\Models\User;
use App\Support\Nik;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Testing\AssertableInertia as Assert;
use RuntimeException;
use Tests\TestCase;

/**
 * Perbaikan hasil review independen: kunci blind index NIK, kode akses
 * nomor lama, CSP non-lokal, limiter login per akun, masa berlaku token.
 */
class ReviewFixesTest extends TestCase
{
    use RefreshDatabase;

    private const NIK = '3171010101010001';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
    }

    /* ------------------------------ NIK_HASH_KEY ----------------------------- */

    public function test_nik_hash_uses_dedicated_key_not_app_key(): void
    {
        config()->set('app.nik_hash_key', null);
        $fallback = Nik::hash(self::NIK);

        config()->set('app.nik_hash_key', 'base64:'.base64_encode(str_repeat('k', 32)));
        $dedicated = Nik::hash(self::NIK);

        $this->assertNotSame($fallback, $dedicated);
        $this->assertSame(hash_hmac('sha256', self::NIK, str_repeat('k', 32)), $dedicated);

        // Rotasi APP_KEY tidak mengubah blind index.
        config()->set('app.key', 'base64:'.base64_encode(random_bytes(32)));
        $this->assertSame($dedicated, Nik::hash(self::NIK));
    }

    public function test_missing_nik_hash_key_outside_local_is_clear_error(): void
    {
        config()->set('app.nik_hash_key', null);
        $this->app['env'] = 'staging';

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('NIK_HASH_KEY');

        Nik::hash(self::NIK);
    }

    public function test_rehash_command_restores_nik_login_after_key_change(): void
    {
        config()->set('app.nik_hash_key', 'kunci-lama');
        $user = User::factory()->warga()->create(['nik' => self::NIK]);
        $ticket = Ticket::factory()->create(['reporter_nik' => self::NIK]);
        Ticket::factory()->create(['reporter_nik' => null]);

        config()->set('app.nik_hash_key', 'kunci-baru');
        $this->assertNull(User::findByNik(self::NIK));

        $this->artisan('sigap:rehash-nik', ['--force' => true, '--chunk' => 1])
            ->expectsOutputToContain('users: 1 baris diperbarui.')
            ->expectsOutputToContain('tickets: 1 baris diperbarui.')
            ->assertSuccessful();

        $this->assertTrue($user->is(User::findByNik(self::NIK)));
        $this->assertSame(Nik::hash(self::NIK), $ticket->fresh()->reporter_nik_hash);
    }

    public function test_rehash_command_rolls_back_when_decryption_fails(): void
    {
        config()->set('app.nik_hash_key', 'kunci-lama');
        $user = User::factory()->warga()->create(['nik' => self::NIK]);
        $before = $user->nik_hash;
        Ticket::factory()->create(['reporter_nik' => self::NIK]);
        DB::table('tickets')->update(['reporter_nik' => 'bukan-ciphertext']);

        config()->set('app.nik_hash_key', 'kunci-baru');
        $this->artisan('sigap:rehash-nik', ['--force' => true])->assertFailed();

        $this->assertSame($before, $user->fresh()->nik_hash);
    }

    /* ---------------------------- Kode akses lacak ---------------------------- */

    public function test_new_tickets_get_lookup_token_and_it_is_never_public(): void
    {
        $ticket = Ticket::factory()->create();

        $this->assertMatchesRegularExpression('/^['.Ticket::NUMBER_ALPHABET.']{8}$/', $ticket->lookup_token);
        $this->assertArrayNotHasKey('lookup_token', $ticket->toArray());

        $this->getJson("/api/v1/tiket/{$ticket->ticket_no}")
            ->assertOk()
            ->assertJsonMissingPath('data.kode_akses');
        $this->assertStringNotContainsString(
            $ticket->lookup_token,
            (string) $this->getJson("/api/v1/tiket/{$ticket->ticket_no}")->getContent(),
        );
    }

    public function test_legacy_number_owner_and_admin_need_no_code_and_see_it(): void
    {
        $region = Region::factory()->create();
        $owner = User::factory()->warga()->create();
        $admin = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => $region->id]);
        $ticket = Ticket::factory()->forReporter($owner)->create(['ticket_no' => 'TKT-77', 'region_id' => $region->id]);

        $this->get('/lacak/TKT-77')->assertInertia(fn (Assert $p) => $p->where('ticket', false)->where('butuh_kode', true));
        $this->actingAs($owner)->get('/lacak/TKT-77')->assertInertia(fn (Assert $p) => $p->where('ticket.nomor', 'TKT-77'));
        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/tiket/TKT-77')->assertOk();

        $this->actingAs($owner)->get('/portal-warga')
            ->assertInertia(fn (Assert $p) => $p->where('tickets.0.kode_akses', $ticket->lookup_token));
        $this->actingAs($admin)->get('/admin/tiket/TKT-77')
            ->assertInertia(fn (Assert $p) => $p->where('ticket.kode_akses', $ticket->lookup_token));
    }

    public function test_guest_survey_on_legacy_number_requires_code(): void
    {
        $ticket = Ticket::factory()->create(['ticket_no' => 'TKT-78', 'status' => TicketStatus::Selesai]);

        $this->postJson('/api/v1/survei/TKT-78', ['rating' => 4])->assertNotFound();
        $this->postJson('/api/v1/survei/TKT-78', ['rating' => 4, 'kode' => strtolower($ticket->lookup_token)])->assertCreated();
    }

    public function test_new_format_number_needs_no_code(): void
    {
        $ticket = Ticket::factory()->create(['ticket_no' => 'TKT-261012-KQ4MZA']);

        $this->get('/lacak/TKT-261012-KQ4MZA')
            ->assertInertia(fn (Assert $p) => $p->where('ticket.nomor', $ticket->ticket_no)->where('butuh_kode', false));
    }

    public function test_lookup_token_migration_backfills_existing_rows(): void
    {
        $migration = require database_path('migrations/2026_10_12_000004_add_lookup_token_to_tickets_table.php');
        Ticket::factory()->count(3)->create();

        $migration->down();
        $migration->up();

        $tokens = DB::table('tickets')->pluck('lookup_token');
        $this->assertCount(3, $tokens);
        $this->assertCount(3, $tokens->filter(fn ($t) => is_string($t) && strlen($t) === Ticket::LOOKUP_TOKEN_LENGTH)->unique());
    }

    /* ------------------------------ CSP & limiter ----------------------------- */

    public function test_staging_gets_strict_csp_and_local_stays_relaxed(): void
    {
        $this->app['env'] = 'staging';
        $csp = (string) $this->get('/')->headers->get('Content-Security-Policy');
        $this->assertMatchesRegularExpression("/script-src 'self' 'nonce-[^']+'/", $csp);
        $this->assertStringNotContainsString("'unsafe-eval'", $csp);

        $this->app['env'] = 'local';
        $csp = (string) $this->get('/')->headers->get('Content-Security-Policy');
        $this->assertStringContainsString("'unsafe-inline' 'unsafe-eval'", $csp);
    }

    public function test_login_is_limited_per_identifier_across_ips(): void
    {
        RateLimiter::clear('login');

        for ($i = 1; $i <= 30; $i++) {
            $this->withServerVariables(['REMOTE_ADDR' => "10.0.{$i}.1"])
                ->postJson('/api/v1/auth/login', ['identifier' => 'Target', 'password' => 'salah-sandi'])
                ->assertStatus(401);
        }

        // Percobaan ke-31 dari IP baru, identifier sama (beda huruf besar) → ditolak.
        $this->withServerVariables(['REMOTE_ADDR' => '10.9.9.9'])
            ->postJson('/api/v1/auth/login', ['identifier' => ' target ', 'password' => 'salah-sandi'])
            ->assertStatus(429);

        // Identifier lain dari IP yang sama tetap boleh.
        $this->withServerVariables(['REMOTE_ADDR' => '10.9.9.9'])
            ->postJson('/api/v1/auth/login', ['identifier' => 'lainnya', 'password' => 'salah-sandi'])
            ->assertStatus(401);
    }

    /* ---------------------------- Sanctum expiration -------------------------- */

    public function test_sanctum_expiration_never_zero(): void
    {
        foreach (['' => 10080, '0' => 10080, '-5' => 10080, 'abc' => 10080, '60' => 60] as $value => $expected) {
            putenv("SANCTUM_EXPIRATION={$value}");
            $_ENV['SANCTUM_EXPIRATION'] = $_SERVER['SANCTUM_EXPIRATION'] = (string) $value;

            $config = require config_path('sanctum.php');
            $this->assertSame($expected, $config['expiration'], "SANCTUM_EXPIRATION='{$value}'");
        }

        putenv('SANCTUM_EXPIRATION');
        unset($_ENV['SANCTUM_EXPIRATION'], $_SERVER['SANCTUM_EXPIRATION']);
    }
}
