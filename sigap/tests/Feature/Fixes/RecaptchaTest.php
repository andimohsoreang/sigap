<?php

namespace Tests\Feature\Fixes;

use App\Enums\TicketStatus;
use App\Models\Ticket;
use App\Services\RecaptchaService;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * A-04: reCAPTCHA v3 fail-closed di production + diterapkan pada formulir
 * internal & survei.
 */
class RecaptchaTest extends TestCase
{
    use RefreshDatabase;

    private function internalPayload(array $extra = []): array
    {
        return array_merge([
            'nip' => '199001012015011001',
            'nama' => 'Pegawai',
            'unit' => 'Biro Umum & TIK',
            'kontak' => '08123',
            'kategori' => 'Internet / Jaringan',
            'urgensi' => 'Tinggi',
            'lokasi' => 'Gedung A Lt. 2',
            'deskripsi' => 'Internet kantor mati total sejak pagi',
        ], $extra);
    }

    public function test_fails_closed_in_production_without_secret(): void
    {
        config()->set('services.recaptcha.secret', null);
        $this->app['env'] = 'production';

        $this->assertFalse(app(RecaptchaService::class)->verify('token'));

        $this->app['env'] = 'testing';
        $this->assertTrue(app(RecaptchaService::class)->verify(null));
    }

    public function test_production_without_secret_blocks_public_complaint(): void
    {
        $this->seed(MasterSeeder::class);
        config()->set('services.recaptcha.secret', null);
        $this->app['env'] = 'production';

        $this->postJson('/api/v1/pengaduan', [
            'nik' => '3171010101010001',
            'nama' => 'Warga',
            'judul' => 'Uji',
            'uraian' => 'Uraian minimal sepuluh karakter',
            'impact' => 'rendah',
            'recaptcha_token' => 'apa-saja',
        ])->assertStatus(422)->assertJsonValidationErrors('recaptcha_token');

        $this->app['env'] = 'testing';
        $this->assertDatabaseCount('tickets', 0);
    }

    public function test_action_mismatch_is_rejected(): void
    {
        config()->set('services.recaptcha.secret', 'test-secret');
        Http::fake(['*' => Http::response(['success' => true, 'score' => 0.9, 'action' => 'login'])]);

        $this->assertFalse(app(RecaptchaService::class)->verify('t', null, RecaptchaService::ACTION_PENGADUAN));
    }

    public function test_internal_form_requires_valid_captcha_when_configured(): void
    {
        config()->set('services.recaptcha.secret', 'test-secret');
        Http::fake(['*' => Http::sequence()
            ->push(['success' => false])
            ->push(['success' => true, 'score' => 0.9, 'action' => 'pengaduan_internal'])]);

        $this->postJson('/api/v1/pengaduan/internal', $this->internalPayload(['recaptcha_token' => 'x']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('recaptcha_token');

        $this->postJson('/api/v1/pengaduan/internal', $this->internalPayload(['recaptcha_token' => 'y']))->assertCreated();
    }

    public function test_survey_requires_valid_captcha_when_configured(): void
    {
        Ticket::factory()->create(['ticket_no' => 'TKT-700', 'status' => TicketStatus::Selesai]);
        config()->set('services.recaptcha.secret', 'test-secret');
        Http::fake(['*' => Http::response(['success' => true, 'score' => 0.1])]);

        $this->postJson('/api/v1/survei/TKT-700', ['rating' => 5, 'recaptcha_token' => 'x'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('recaptcha_token');

        $this->assertDatabaseCount('surveys', 0);
    }
}
