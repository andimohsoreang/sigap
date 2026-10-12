<?php

namespace Tests\Feature\Fixes;

use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\Category;
use App\Models\Region;
use App\Models\Ticket;
use App\Models\User;
use Database\Seeders\MasterSeeder;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Contracts\Broadcasting\Broadcaster;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Kontrak integrasi frontend ↔ backend (pass integrasi audit).
 */
class IntegrationContractsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
    }

    public function test_admin_kawasan_manual_input_without_region_uses_own_region(): void
    {
        $own = Region::factory()->create();
        $admin = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => $own->id]);

        $this->actingAs($admin)->get('/admin/input-manual')
            ->assertInertia(fn (Assert $page) => $page
                ->where('region_locked', true)
                ->where('own_region.id', $own->id));

        $this->actingAs($admin)->post('/admin/input-manual', [
            'sumber_laporan' => 'tatap_muka',
            'nama' => 'Warga Datang',
            'judul' => 'Aduan tanpa kawasan',
            'uraian' => 'Kawasan dipaksa dari akun admin kawasan',
            'category_id' => Category::query()->value('id'),
            'impact' => 'rendah',
        ])->assertRedirect('/admin/matriks');

        $this->assertSame($own->id, Ticket::where('title', 'Aduan tanpa kawasan')->value('region_id'));
    }

    public function test_super_admin_manual_input_still_requires_region(): void
    {
        $super = User::factory()->admin(UserRole::SuperAdmin)->create();

        $this->actingAs($super)->get('/admin/input-manual')
            ->assertInertia(fn (Assert $page) => $page->where('region_locked', false));

        $this->actingAs($super)->post('/admin/input-manual', [
            'sumber_laporan' => 'tatap_muka',
            'nama' => 'Warga',
            'judul' => 'Tanpa kawasan',
            'uraian' => 'Super admin wajib memilih kawasan',
            'category_id' => Category::query()->value('id'),
            'impact' => 'rendah',
        ])->assertSessionHasErrors('region_id');
    }

    public function test_inertia_survey_by_other_account_returns_field_error(): void
    {
        $owner = User::factory()->warga()->create();
        $other = User::factory()->warga()->create();
        Ticket::factory()->create([
            'ticket_no' => 'TKT-261012-NTGAAA',
            'status' => TicketStatus::Selesai,
            'reporter_id' => $owner->id,
        ]);

        $this->actingAs($other)
            ->from('/lacak/TKT-261012-NTGAAA')
            ->withHeader('X-Inertia', 'true')
            ->post('/lacak/survei', ['ticket' => 'TKT-261012-NTGAAA', 'rating' => 3])
            ->assertRedirect('/lacak/TKT-261012-NTGAAA')
            ->assertSessionHasErrors('ticket');

        $this->assertDatabaseCount('surveys', 0);
    }

    public function test_admin_can_update_own_profile_with_current_password(): void
    {
        $admin = User::factory()->admin(UserRole::AdminKawasan)->create([
            'region_id' => Region::factory()->create()->id,
            'password' => 'LamaSekali123',
        ]);

        $this->actingAs($admin)->put('/admin/profil', [
            'name' => 'Nama Baru',
            'current_password' => 'salah',
            'password' => 'BaruSekali1234',
            'password_confirmation' => 'BaruSekali1234',
        ])->assertSessionHasErrors('current_password');

        $this->actingAs($admin)->put('/admin/profil', [
            'name' => 'Nama Baru',
            'current_password' => 'LamaSekali123',
            'password' => 'lemah',
            'password_confirmation' => 'lemah',
        ])->assertSessionHasErrors('password');

        $this->actingAs($admin)->put('/admin/profil', [
            'name' => 'Nama Baru',
            'current_password' => 'LamaSekali123',
            'password' => 'BaruSekali1234',
            'password_confirmation' => 'BaruSekali1234',
        ])->assertSessionHasNoErrors();

        $admin->refresh();
        $this->assertSame('Nama Baru', $admin->name);
        $this->assertTrue(Hash::check('BaruSekali1234', $admin->password));
    }

    public function test_user_channel_only_authorizes_owner(): void
    {
        $channels = app(Broadcaster::class)->getChannels();
        $callback = $channels->get('user.{id}');
        $this->assertIsCallable($callback);
        $this->assertNull($channels->get('admin.notifications'));

        $user = User::factory()->warga()->create();
        $this->assertTrue((bool) $callback($user, (string) $user->id));
        $this->assertFalse((bool) $callback($user, $user->id + 1));
    }

    public function test_password_change_elsewhere_invalidates_web_session(): void
    {
        $admin = User::factory()->admin(UserRole::SuperAdmin)->create(['password' => 'LamaSekali123']);

        $this->actingAs($admin)->get('/admin/matriks')->assertOk();

        $admin->forceFill(['password' => 'BaruSekali1234'])->save();

        $this->get('/admin/matriks')->assertRedirect('/masuk');
    }

    public function test_api_errors_render_as_json_without_accept_header(): void
    {
        $this->get('/api/v1/tidak-ada')
            ->assertNotFound()
            ->assertHeader('Content-Type', 'application/json');
    }

    public function test_prune_is_scheduled_daily(): void
    {
        $events = collect(app(Schedule::class)->events())
            ->filter(fn ($e) => str_contains($e->command ?? '', 'model:prune'));

        $this->assertCount(1, $events);
        $event = $events->first();
        $this->assertSame('0 2 * * *', $event->expression);
        $this->assertStringContainsString('ChatConversation', $event->command);
        $this->assertStringContainsString('ActivityLog', $event->command);
    }
}
