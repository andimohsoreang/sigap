<?php

namespace Tests\Feature\Ai;

use App\Enums\UserRole;
use App\Events\NotificationBroadcast;
use App\Models\AiCall;
use App\Models\AiQualityRun;
use App\Models\KnowledgeArticle;
use App\Models\Region;
use App\Models\User;
use App\Modules\Ai\CircuitBreaker;
use App\Modules\Ai\TokenBudget;
use Database\Seeders\KnowledgeSeeder;
use Database\Seeders\OfficialKnowledgeSeeder;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * PRD-AI Tahap 5 (Pemantauan): halaman Kesehatan AI (FR-AI-08), uji kualitas
 * mingguan dengan ringkasan ke Super Admin (FR-AI-07), dan notifikasi
 * anggaran (FR-AI-03).
 */
class AiHealthTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function logCall(array $attributes): AiCall
    {
        return AiCall::query()->create($attributes + [
            'task' => 'jawab', 'prompt_version' => 'jawab@uji', 'provider' => 'ai.contoh.test',
            'model' => 'model-uji', 'status' => AiCall::STATUS_OK, 'latency_ms' => 1000,
        ]);
    }

    // --- FR-AI-08: halaman Kesehatan AI ------------------------------------

    public function test_super_admin_sees_todays_numbers_from_ai_calls(): void
    {
        // 10.00 WIB: batas "hari ini" mengikuti WIB, bukan UTC.
        Carbon::setTestNow(Carbon::parse('2026-11-02 10:00', 'Asia/Jakarta'));
        config(['services.ai.enabled' => true, 'services.ai.driver' => 'openai', 'services.ai.base_url' => 'https://ai.contoh.test/v1']);

        foreach ([1000, 2000, 3000, 4000] as $ms) {
            $this->logCall(['latency_ms' => $ms, 'prompt_tokens' => 100, 'completion_tokens' => 20]);
        }
        $this->logCall(['status' => AiCall::STATUS_TIMEOUT, 'latency_ms' => 25000, 'error_code' => 'timeout']);
        $this->logCall(['status' => 'skipped', 'latency_ms' => 0, 'error_code' => 'sirkuit_terbuka']);
        $this->logCall(['task' => 'saran_tiket', 'latency_ms' => 1500, 'prompt_tokens' => 50, 'completion_tokens' => 10]);
        // 23.30 WIB kemarin (16.30 UTC) — bukan hari ini.
        $this->logCall(['status' => AiCall::STATUS_ERROR, 'error_code' => 'http_500'])
            ->forceFill(['created_at' => Carbon::parse('2026-11-01 23:30', 'Asia/Jakarta')->utc()])->save();

        $this->actingAs(User::factory()->admin(UserRole::SuperAdmin)->create())
            ->get('/admin/kesehatan-ai')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/kesehatan-ai')
                ->where('status.kode', 'normal')
                ->where('hari_ini.total', 7)
                ->where('hari_ini.berhasil', 5)
                ->where('hari_ini.gagal', 1)
                ->where('hari_ini.cadangan', 1)
                // 1 galat dari 6 panggilan ke penyedia (yang dilewati tidak dihitung).
                ->where('hari_ini.tingkat_galat', 16.7)
                ->where('hari_ini.p50_ms', 2000)
                ->where('hari_ini.p95_ms', 25000)
                ->where('hari_ini.token', 540)
                ->where('per_tugas.0.tugas', 'jawab')
                ->where('per_tugas.0.total', 6)
                ->where('per_tugas.2.tugas', 'saran_tiket')
                ->where('per_tugas.2.token', 60)
                ->has('tren', 14)
                ->where('tren.12.tanggal', '2026-11-01')
                ->where('tren.12.gagal', 1)
                ->where('tren.13.berhasil', 5)
                ->where('galat_terakhir.0.kode', 'http_500')
                ->where('konfigurasi.penyedia', 'ai.contoh.test')
            );
    }

    public function test_page_contains_numbers_only_never_conversation_text(): void
    {
        config(['services.ai.api_key' => 'kunci-rahasia-uji']);
        $this->logCall(['status' => AiCall::STATUS_ERROR, 'error_code' => 'http_401']);

        $response = $this->actingAs(User::factory()->admin(UserRole::SuperAdmin)->create())->get('/admin/kesehatan-ai');
        $props = $response->viewData('page')['props'];

        $this->assertSame(['id', 'tugas', 'status', 'kode', 'latency_ms', 'waktu'], array_keys($props['galat_terakhir'][0]));
        $this->assertStringNotContainsString('kunci-rahasia-uji', $response->getContent());
    }

    public function test_only_super_admin_may_open_the_page(): void
    {
        $this->get('/admin/kesehatan-ai')->assertRedirect();

        $region = Region::factory()->create();
        $regional = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => $region->id]);
        $this->actingAs($regional)->get('/admin/kesehatan-ai')->assertForbidden();
    }

    public function test_status_reports_disabled_open_circuit_and_exhausted_budget(): void
    {
        $admin = User::factory()->admin(UserRole::SuperAdmin)->create();
        $status = fn () => $this->actingAs($admin)->get('/admin/kesehatan-ai')->viewData('page')['props']['status']['kode'];

        config(['services.ai.enabled' => false]);
        $this->assertSame('nonaktif', $status());

        config(['services.ai.enabled' => true, 'services.ai.driver' => 'fake']);
        $this->assertSame('uji', $status());

        config(['services.ai.daily_token_budget' => 100]);
        app(TokenBudget::class)->add(150);
        $this->assertSame('anggaran_habis', $status());

        config(['services.ai.breaker_threshold' => 1]);
        app(CircuitBreaker::class)->failure();
        $this->assertSame('sirkuit_terbuka', $status(), 'Sirkuit terbuka paling mendesak.');
    }

    // --- FR-AI-07: uji kualitas tersimpan & dilaporkan ----------------------

    public function test_quality_run_is_saved_and_reported_to_super_admin(): void
    {
        $this->seed([KnowledgeSeeder::class, OfficialKnowledgeSeeder::class]);
        KnowledgeArticle::query()->update(['status' => KnowledgeArticle::STATUS_PUBLISHED]);
        $admin = User::factory()->admin(UserRole::SuperAdmin)->create();
        Event::fake([NotificationBroadcast::class]);

        $this->artisan('sigap:uji-asisten', ['--hanya-pencarian' => true, '--min-pencarian' => 101, '--simpan' => true, '--laporkan' => true])
            ->assertFailed();

        $run = AiQualityRun::query()->sole();
        $this->assertFalse($run->passed);
        $this->assertFalse($run->with_model);
        $this->assertGreaterThan(40, $run->retrieval_total);
        $this->assertStringContainsString('pencarian', (string) $run->failures);

        Event::assertDispatched(NotificationBroadcast::class, fn (NotificationBroadcast $e) => $e->userId === $admin->id
            && $e->payload['event'] === 'ai_uji'
            && $e->payload['title'] === 'Uji kualitas TARA: GAGAL'
            && $e->payload['cta_url'] === '/admin/kesehatan-ai');

        $this->actingAs($admin)->get('/admin/kesehatan-ai')
            ->assertInertia(fn (Assert $page) => $page->where('uji.0.lulus', false)->where('uji.0.pencarian.1', $run->retrieval_total));
    }

    public function test_quality_run_without_flags_saves_nothing(): void
    {
        $this->seed([KnowledgeSeeder::class, OfficialKnowledgeSeeder::class]);
        Event::fake([NotificationBroadcast::class]);

        $this->artisan('sigap:uji-asisten', ['--hanya-pencarian' => true])->assertSuccessful();

        $this->assertSame(0, AiQualityRun::query()->count());
        Event::assertNotDispatched(NotificationBroadcast::class);
    }

    public function test_weekly_quality_run_is_scheduled_with_production_thresholds(): void
    {
        // withSchedule() baru mendaftarkan jadwal saat konsol Artisan dinyalakan.
        $this->app->make(Kernel::class)->all();
        $events = collect(app(Schedule::class)->events())->filter(fn ($e) => str_contains($e->command ?? '', 'sigap:uji-asisten'));

        $this->assertCount(1, $events);
        $event = $events->first();
        foreach (['--min-pencarian=95', '--min-klasifikasi=85', '--maks-tanpa-sumber=0', '--maks-p95=12', '--simpan', '--laporkan'] as $option) {
            $this->assertStringContainsString($option, $event->command);
        }
        $this->assertSame('0 3 * * 1', $event->expression);
        $this->assertSame('Asia/Jakarta', $event->timezone);
        $this->assertTrue($event->runInBackground);

        // Tanpa model sungguhan, uji mingguan tidak berjalan.
        config(['services.ai.enabled' => true, 'services.ai.driver' => 'fake']);
        $this->assertFalse($event->filtersPass($this->app));
        config(['services.ai.driver' => 'openai']);
        $this->assertTrue($event->filtersPass($this->app));
    }

    // --- FR-AI-03: notifikasi anggaran habis ---------------------------------

    public function test_super_admin_is_told_once_when_budget_runs_out(): void
    {
        $admin = User::factory()->admin(UserRole::SuperAdmin)->create();
        Event::fake([NotificationBroadcast::class]);
        config(['services.ai.daily_token_budget' => 1000]);
        $sent = fn (string $event) => Event::dispatched(NotificationBroadcast::class, fn (NotificationBroadcast $e) => $e->payload['event'] === $event && $e->userId === $admin->id)->count();

        // Satu panggilan melompati 80% dan 100% sekaligus: cukup kabar "habis".
        app(TokenBudget::class)->add(1200);
        app(TokenBudget::class)->add(50);

        $this->assertSame(1, $sent('ai_anggaran_habis'));
        $this->assertSame(0, $sent('ai_anggaran'));
        Event::assertDispatched(NotificationBroadcast::class, fn (NotificationBroadcast $e) => $e->payload['cta_url'] === '/admin/kesehatan-ai');
    }
}
