<?php

namespace Tests\Feature\Infra;

use App\Models\Ticket;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A-01 / A-02 / L-02: rate limit login, pencarian tiket publik, dan health.
 */
class RateLimitTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
    }

    public function test_web_login_is_throttled_per_identifier_and_ip(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->post('/masuk', ['identifier' => 'korban', 'password' => 'salah-'.$i])
                ->assertStatus(302);
        }

        $this->post('/masuk', ['identifier' => 'korban', 'password' => 'salah-lagi'])
            ->assertStatus(429)
            ->assertHeader('Retry-After');

        // Identifier sama dari IP lain masih punya jatah sendiri.
        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9'])
            ->post('/masuk', ['identifier' => 'korban', 'password' => 'salah'])
            ->assertStatus(302);
    }

    public function test_web_login_identifier_key_is_case_insensitive(): void
    {
        foreach (['Korban', 'KORBAN', ' korban ', 'korBan', 'korban'] as $identifier) {
            $this->post('/masuk', ['identifier' => $identifier, 'password' => 'salah'])->assertStatus(302);
        }

        $this->post('/masuk', ['identifier' => 'KoRbAn', 'password' => 'salah'])->assertStatus(429);
    }

    public function test_web_login_is_throttled_per_ip_across_identifiers(): void
    {
        for ($i = 0; $i < 20; $i++) {
            $this->post('/masuk', ['identifier' => "akun-{$i}", 'password' => 'salah'])
                ->assertStatus(302);
        }

        $this->post('/masuk', ['identifier' => 'akun-baru', 'password' => 'salah'])
            ->assertStatus(429);
    }

    public function test_inertia_login_gets_validation_message_instead_of_html_429(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->post('/masuk', ['identifier' => 'korban', 'password' => 'salah']);
        }

        $this->from('/masuk')
            ->withHeaders(['X-Inertia' => 'true'])
            ->post('/masuk', ['identifier' => 'korban', 'password' => 'salah'])
            ->assertStatus(303)
            ->assertRedirect('/masuk')
            ->assertSessionHasErrors('identifier');
    }

    public function test_api_login_is_throttled(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $status = $this->postJson('/api/v1/auth/login', ['identifier' => 'korban', 'password' => 'salah'])->status();
            $this->assertNotSame(429, $status);
        }

        $this->postJson('/api/v1/auth/login', ['identifier' => 'korban', 'password' => 'salah'])
            ->assertStatus(429);
    }

    public function test_public_ticket_lookup_is_throttled(): void
    {
        $ticket = Ticket::factory()->create();

        for ($i = 0; $i < 30; $i++) {
            $this->assertNotSame(429, $this->get('/lacak/TKT-'.(900000 + $i))->status());
        }

        $this->get('/lacak/'.$ticket->ticket_no)->assertStatus(429);
        $this->get('/lacak?ticket='.$ticket->ticket_no)->assertStatus(429);
    }

    public function test_api_ticket_lookup_is_throttled(): void
    {
        for ($i = 0; $i < 30; $i++) {
            $this->assertNotSame(429, $this->getJson('/api/v1/tiket/TKT-'.(900000 + $i))->status());
        }

        $this->getJson('/api/v1/tiket/TKT-1')->assertStatus(429);
    }

    public function test_lookup_limit_is_per_ip(): void
    {
        for ($i = 0; $i < 30; $i++) {
            $this->getJson('/api/v1/tiket/TKT-'.(900000 + $i));
        }

        $this->getJson('/api/v1/tiket/TKT-1')->assertStatus(429);

        $other = $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.7'])->getJson('/api/v1/tiket/TKT-1');
        $this->assertNotSame(429, $other->status());
    }

    public function test_health_check_does_not_leak_ticket_count_and_pings_database(): void
    {
        Ticket::factory()->count(3)->create();

        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJson(['ok' => true, 'service' => 'sigap-api', 'database' => 'ok'])
            ->assertJsonMissingPath('tickets');
    }

    public function test_health_check_is_throttled(): void
    {
        for ($i = 0; $i < 60; $i++) {
            $this->getJson('/api/v1/health')->assertOk();
        }

        $this->getJson('/api/v1/health')->assertStatus(429);
    }
}
