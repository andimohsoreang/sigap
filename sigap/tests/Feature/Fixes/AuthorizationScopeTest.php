<?php

namespace Tests\Feature\Fixes;

use App\Enums\UserRole;
use App\Models\Category;
use App\Models\Region;
use App\Models\Setting;
use App\Models\Ticket;
use App\Models\User;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A-05 (scoping peran), A-18 (kata sandi admin), A-19 (403 peran salah).
 */
class AuthorizationScopeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
    }

    private function kawasan(?Region $region): User
    {
        return User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => $region?->id]);
    }

    public function test_admin_kawasan_without_region_sees_no_tickets(): void
    {
        Ticket::factory()->create(['region_id' => null]);
        Ticket::factory()->create(['region_id' => Region::factory()->create()->id]);
        $admin = $this->kawasan(null);

        $this->assertSame(0, Ticket::query()->visibleTo($admin)->count());
        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/tickets')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/rekap')->assertOk()->assertJsonPath('total', 0);
    }

    public function test_store_admin_requires_region_for_admin_kawasan_and_strong_password(): void
    {
        $super = User::factory()->admin()->create();

        $this->actingAs($super)->post('/admin/petugas', [
            'name' => 'Tanpa Kawasan', 'nip' => 'NIP-1', 'role' => 'admin_kawasan', 'password' => 'RahasiaKuat2026',
        ])->assertSessionHasErrors('region_id');

        $this->actingAs($super)->post('/admin/petugas', [
            'name' => 'Sandi Lemah', 'nip' => 'NIP-2', 'role' => 'super_admin', 'password' => 'rahasia123',
        ])->assertSessionHasErrors('password');

        $this->actingAs($super, 'sanctum')->postJson('/api/v1/admin/admins', [
            'name' => 'API Kawasan', 'nip' => 'NIP-3', 'role' => 'admin_kawasan', 'password' => 'RahasiaKuat2026',
        ])->assertStatus(422)->assertJsonValidationErrors('region_id');

        $this->actingAs($super, 'sanctum')->postJson('/api/v1/admin/admins', [
            'name' => 'API Kawasan', 'nip' => 'NIP-4', 'role' => 'admin_kawasan',
            'region_id' => Region::factory()->create()->id, 'password' => 'RahasiaKuat2026',
        ])->assertCreated();

        $this->assertDatabaseMissing('users', ['username' => 'NIP-1']);
        $this->assertDatabaseHas('activity_logs', ['action' => 'admin.created']);
    }

    public function test_create_admin_command_requires_region_for_admin_kawasan(): void
    {
        $region = Region::factory()->create(['code' => 'KWS-CMD']);

        $this->artisan('sigap:admin', ['--username' => 'kws1', '--name' => 'Kawasan', '--role' => 'admin_kawasan', '--region' => 'TIDAK-ADA', '--no-interaction' => true])
            ->assertFailed();

        $this->artisan('sigap:admin', ['--username' => 'kws2', '--name' => 'Kawasan', '--role' => 'admin_kawasan', '--region' => 'KWS-CMD'])
            ->expectsQuestion('Kata sandi (min 12 karakter, huruf besar, huruf kecil & angka)', 'RahasiaKuat2026')
            ->expectsQuestion('Ulangi kata sandi', 'RahasiaKuat2026')
            ->assertSuccessful();

        $this->assertSame($region->id, User::where('username', 'kws2')->value('region_id'));

        $this->artisan('sigap:admin', ['--username' => 'lemah', '--name' => 'Lemah', '--role' => 'super_admin'])
            ->expectsQuestion('Kata sandi (min 12 karakter, huruf besar, huruf kecil & angka)', 'pendek1')
            ->expectsQuestion('Ulangi kata sandi', 'pendek1')
            ->assertFailed();
    }

    public function test_settings_and_categories_are_super_admin_only(): void
    {
        $admin = $this->kawasan(Region::factory()->create());
        $category = Category::first();

        $this->actingAs($admin)->get('/admin/pengaturan')->assertOk();
        $this->actingAs($admin)->put('/admin/pengaturan', ['sla_response_minutes' => 5])->assertForbidden();
        $this->actingAs($admin)->post('/admin/kategori', ['name' => 'Baru'])->assertForbidden();
        $this->actingAs($admin)->delete("/admin/kategori/{$category->id}")->assertForbidden();
        $this->actingAs($admin, 'sanctum')->putJson('/api/v1/admin/pengaturan', ['ews_enabled' => false])->assertForbidden();

        $this->assertSame(60, (int) Setting::get('sla_response_minutes'));
        $this->assertDatabaseHas('categories', ['id' => $category->id]);
    }

    public function test_admin_kawasan_may_only_edit_own_region(): void
    {
        $own = Region::factory()->create();
        $other = Region::factory()->create();
        $admin = $this->kawasan($own);

        $this->actingAs($admin)->put("/admin/kawasan/{$own->id}", ['name' => 'Milik Sendiri'])->assertRedirect();
        $this->actingAs($admin)->put("/admin/kawasan/{$other->id}", ['name' => 'Bukan Milik'])->assertForbidden();
        $this->actingAs($admin, 'sanctum')->putJson("/api/v1/admin/kawasan/{$other->id}", ['name' => 'X'])->assertForbidden();

        $this->actingAs($admin)->post('/admin/kawasan', ['code' => 'KWS-X', 'name' => 'Baru'])->assertForbidden();
        $this->actingAs($admin)->delete("/admin/kawasan/{$own->id}")->assertForbidden();
        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/admin/kawasan', ['code' => 'KWS-Y', 'name' => 'Baru'])->assertForbidden();
        $this->actingAs($admin, 'sanctum')->deleteJson("/api/v1/admin/kawasan/{$own->id}")->assertForbidden();

        $this->assertSame('Milik Sendiri', $own->fresh()->name);
        $this->assertNotSame('Bukan Milik', $other->fresh()->name);
    }

    public function test_channels_are_created_by_super_admin_only(): void
    {
        $admin = $this->kawasan(Region::factory()->create());

        $this->actingAs($admin)->post('/admin/kanal', ['type' => 'sosmed', 'name' => 'IG'])->assertForbidden();
        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/admin/kanal', ['type' => 'sosmed', 'name' => 'IG'])->assertForbidden();
    }

    public function test_internal_tickets_are_super_admin_only(): void
    {
        Ticket::factory()->internal()->create();
        $admin = $this->kawasan(Region::factory()->create());
        $super = User::factory()->admin()->create();

        $this->actingAs($admin)->get('/admin/tiket-internal')->assertForbidden();
        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/tiket-internal')->assertForbidden();

        $this->actingAs($super, 'sanctum')->getJson('/api/v1/admin/tiket-internal')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_wrong_role_gets_403_json_and_guest_401(): void
    {
        $warga = User::factory()->warga()->create();

        $this->getJson('/api/v1/admin/tickets')->assertUnauthorized();
        $this->actingAs($warga, 'sanctum')->getJson('/api/v1/admin/rekap')->assertForbidden();

        $admin = User::factory()->admin()->create();
        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/warga/profile')->assertForbidden();
    }
}
