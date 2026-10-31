<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\ChatConversation;
use App\Models\Referral;
use App\Models\Survey;
use App\Models\Ticket;
use App\Models\User;
use Database\Seeders\MasterSeeder;
use Database\Seeders\PortalSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/** sigap:data-contoh mengisi data demo; sigap:reset-transaksi menghapus transaksi saja. */
class DataContohCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_data_then_reset_keeps_master_and_real_accounts(): void
    {
        $this->seed([MasterSeeder::class, PortalSeeder::class]);
        Mail::fake();
        Notification::fake();
        $admin = User::factory()->admin(UserRole::SuperAdmin)->create();

        $this->artisan('sigap:data-contoh')->assertSuccessful();

        $this->assertGreaterThanOrEqual(25, Ticket::query()->count());
        $this->assertGreaterThanOrEqual(10, Ticket::query()->public()->distinct()->count('province'));
        $this->assertSame(0, Ticket::query()->public()->whereNull('province')->count());
        $this->assertGreaterThan(0, Ticket::query()->where('status', 'selesai')->where('resolved_at', '>', \DB::raw('sla_due_at'))->count(), 'Ada kasus selesai terlambat.');
        $this->assertGreaterThan(0, Survey::query()->count());
        $this->assertGreaterThan(0, Referral::query()->count());
        $this->assertTrue(ChatConversation::query()->whereNull('outcome')->whereNotNull('handoff_at')->exists(), 'Ada percakapan menunggu petugas.');
        Mail::assertNothingQueued();
        Mail::assertNothingSent();

        // Tidak boleh menimpa data yang sudah ada tanpa --force.
        $this->artisan('sigap:data-contoh')->assertFailed();

        $this->artisan('sigap:reset-transaksi', ['--force' => true])->assertSuccessful();

        $this->assertSame(0, Ticket::withTrashed()->count());
        $this->assertSame(0, ChatConversation::query()->count());
        $this->assertSame(0, Referral::query()->count());
        $this->assertSame(0, User::query()->where('email', 'like', '%@contoh.test')->count());
        $this->assertTrue($admin->fresh()->exists);
        $this->assertTrue(ActivityLog::query()->where('action', 'data.reset_transaksi')->exists());
    }

    public function test_reset_asks_for_confirmation(): void
    {
        $this->artisan('sigap:reset-transaksi')->expectsConfirmation('Hapus semua data di atas? Tindakan ini tidak dapat dibatalkan.', 'no')->assertFailed();
    }
}
