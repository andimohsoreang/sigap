<?php

namespace Tests\Feature\Web;

use App\Models\ActivityLog;
use App\Models\Ticket;
use App\Models\User;
use App\Services\RecaptchaService;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Hardening keamanan F6 (SEC-01..11).
 */
class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
    }

    public function test_security_headers_are_present_on_web_responses(): void
    {
        $response = $this->get('/');

        $response->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
            ->assertHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');

        $this->assertStringContainsString("default-src 'self'", $response->headers->get('Content-Security-Policy'));
        $this->assertStringContainsString("frame-ancestors 'none'", $response->headers->get('Content-Security-Policy'));
        $this->assertStringContainsString("object-src 'none'", $response->headers->get('Content-Security-Policy'));
    }

    public function test_security_headers_are_present_on_api_responses(): void
    {
        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('X-Content-Type-Options', 'nosniff');
    }

    public function test_hsts_is_only_set_over_https(): void
    {
        $this->get('/')->assertHeaderMissing('Strict-Transport-Security');

        $this->get('https://localhost/')->assertHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    public function test_recaptcha_is_verified_server_side_when_configured(): void
    {
        config()->set('services.recaptcha.secret', 'test-secret');
        Http::fake([
            'www.google.com/recaptcha/api/siteverify' => Http::response(['success' => true, 'score' => 0.9]),
        ]);

        $this->post('/pengaduan/baru', [
            'nik' => '3171010101010042',
            'nama' => 'Warga Recaptcha',
            'judul' => 'Uji recaptcha',
            'uraian' => 'Uji verifikasi recaptcha server-side minimal sepuluh',
            'impact' => 'rendah',
            'recaptcha_token' => 'token-valid',
        ])->assertRedirect();

        $this->assertDatabaseHas('tickets', ['title' => 'Uji recaptcha']);
        Http::assertSent(fn ($request) => str_contains($request->url(), 'siteverify'));
    }

    public function test_recaptcha_failure_blocks_ticket_creation(): void
    {
        config()->set('services.recaptcha.secret', 'test-secret');
        Http::fake([
            'www.google.com/recaptcha/api/siteverify' => Http::response(['success' => false]),
        ]);

        $this->from('/pengaduan/baru')->post('/pengaduan/baru', [
            'nik' => '3171010101010043',
            'nama' => 'Warga Gagal',
            'judul' => 'Harus ditolak',
            'uraian' => 'Uji recaptcha gagal minimal sepuluh karakter',
            'impact' => 'rendah',
            'recaptcha_token' => 'token-invalid',
        ])->assertRedirect('/pengaduan/baru')->assertSessionHasErrors('recaptcha_token');

        $this->assertDatabaseMissing('tickets', ['title' => 'Harus ditolak']);
    }

    public function test_recaptcha_low_score_is_rejected(): void
    {
        config()->set('services.recaptcha.secret', 'test-secret');
        Http::fake([
            'www.google.com/recaptcha/api/siteverify' => Http::response(['success' => true, 'score' => 0.1]),
        ]);

        $this->from('/pengaduan/baru')->post('/pengaduan/baru', [
            'nik' => '3171010101010044',
            'nama' => 'Warga Skor Rendah',
            'judul' => 'Skor rendah',
            'uraian' => 'Uji skor recaptcha rendah minimal sepuluh',
            'impact' => 'rendah',
            'recaptcha_token' => 'token',
        ])->assertSessionHasErrors('recaptcha_token');

        $this->assertDatabaseCount('tickets', 0);
    }

    public function test_recaptcha_is_skipped_when_not_configured(): void
    {
        config()->set('services.recaptcha.secret', null);

        $this->post('/pengaduan/baru', [
            'nik' => '3171010101010045',
            'nama' => 'Warga Dev',
            'judul' => 'Tanpa recaptcha',
            'uraian' => 'Dev tanpa kunci recaptcha tetap boleh minimal sepuluh',
            'impact' => 'sedang',
        ])->assertRedirect();

        $this->assertDatabaseHas('tickets', ['title' => 'Tanpa recaptcha']);
    }

    public function test_admin_mutations_are_audited(): void
    {
        $admin = User::factory()->admin()->create();
        $ticket = Ticket::factory()->create(['ticket_no' => 'TKT-900']);

        $this->actingAs($admin)->post("/admin/tiket/{$ticket->ticket_no}/status", [
            'status' => 'diproses',
            'note' => 'Ditindaklanjuti.',
        ])->assertRedirect();

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'ticket.status_changed',
            'user_id' => $admin->id,
        ]);
    }

    public function test_super_admin_can_view_activity_log(): void
    {
        $super = User::factory()->admin()->create();
        $this->actingAs($super)->post('/admin/kategori', ['name' => 'Kategori Audit'])->assertRedirect();

        $this->actingAs($super)->get('/admin/log-aktivitas')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('admin/log-aktivitas')
                ->has('logs.data')
            );

        $this->assertDatabaseHas('activity_logs', ['action' => 'category.created']);
    }

    public function test_plain_admin_cannot_view_activity_log(): void
    {
        $admin = User::factory()->admin(\App\Enums\UserRole::AdminKawasan)->create();

        $this->actingAs($admin)->get('/admin/log-aktivitas')->assertForbidden();
    }

    public function test_public_resource_hides_internal_tickets(): void
    {
        Ticket::factory()->create([
            'ticket_no' => 'TKT-901',
            'is_internal' => true,
            'title' => 'Rahasia Internal',
        ]);

        $this->getJson('/api/v1/tiket/TKT-901')->assertNotFound();
    }
}