<?php

namespace Tests\Feature\Web;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\Ticket;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\MasterSeeder;
use Database\Seeders\UnitSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** PRD-UNIT-KERJA F1: master Unit Kerja, unit petugas, unit pelapor internal. */
class UnitKerjaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
    }

    private function superAdmin(): User
    {
        return User::factory()->admin(UserRole::SuperAdmin)->create();
    }

    public function test_seeder_follows_official_structure_and_is_idempotent(): void
    {
        $this->seed(UnitSeeder::class);
        $count = Unit::count();

        $this->assertSame(['DITJEN-PEPMT', 'DITJEN-PPKT', 'ITJEN', 'PUS-BANGSDM', 'PUS-DATIN', 'PUS-STRAJAK', 'SETJEN'], Unit::query()->whereNull('parent_id')->orderBy('code')->pluck('code')->all());
        $this->assertSame(Unit::LEVEL_ESELON_1, Unit::query()->where('code', 'SETJEN')->value('level'));
        $biroHukum = Unit::query()->where('code', 'SETJEN-HUKUM')->firstOrFail();
        $this->assertSame('Biro Hukum', $biroHukum->name);
        $this->assertSame('SETJEN', $biroHukum->parent->code);
        $this->assertSame(0, Unit::query()->where('code', 'PUS-BANGSDM')->firstOrFail()->children()->count());
        $this->assertFalse(Unit::query()->where('code', 'like', 'UPT-%')->exists());

        Unit::query()->where('code', 'SETJEN-HUKUM')->update(['name' => 'Biro Hukum (disunting)']);
        $this->seed(UnitSeeder::class);

        $this->assertSame($count, Unit::count());
        $this->assertSame('Biro Hukum (disunting)', Unit::query()->where('code', 'SETJEN-HUKUM')->value('name'));
    }

    public function test_only_super_admin_can_open_and_change_units(): void
    {
        $kawasan = User::factory()->admin(UserRole::AdminKawasan)->create();
        $unit = Unit::create(['code' => 'SETJEN', 'name' => 'Sekretariat Jenderal', 'level' => Unit::LEVEL_ESELON_1]);

        $this->actingAs($kawasan)->get('/admin/unit-kerja')->assertForbidden();
        $this->actingAs($kawasan)->post('/admin/unit-kerja', ['code' => 'X', 'name' => 'X', 'level' => 'lainnya'])->assertForbidden();
        $this->actingAs($kawasan)->put("/admin/unit-kerja/{$unit->id}", ['code' => 'SETJEN', 'name' => 'Y', 'level' => 'eselon_1'])->assertForbidden();
        $this->assertSame('Sekretariat Jenderal', $unit->fresh()->name);
    }

    public function test_page_lists_units_in_tree_order(): void
    {
        $setjen = Unit::create(['code' => 'SETJEN', 'name' => 'Sekretariat Jenderal', 'level' => Unit::LEVEL_ESELON_1, 'sort' => 1]);
        Unit::create(['code' => 'ITJEN', 'name' => 'Inspektorat Jenderal', 'level' => Unit::LEVEL_ESELON_1, 'sort' => 2]);
        $hukum = Unit::create(['code' => 'SETJEN-HUKUM', 'name' => 'Biro Hukum', 'level' => Unit::LEVEL_ESELON_2, 'parent_id' => $setjen->id]);
        User::factory()->admin(UserRole::AdminKawasan)->create(['unit_id' => $hukum->id]);

        $this->actingAs($this->superAdmin())->get('/admin/unit-kerja')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/unit-kerja')
                ->where('units.0.code', 'SETJEN')
                ->where('units.0.anak', 1)
                ->where('units.1.code', 'SETJEN-HUKUM')
                ->where('units.1.depth', 1)
                ->where('units.1.petugas', 1)
                ->where('units.2.code', 'ITJEN')
                ->has('levels', 3));
    }

    public function test_super_admin_creates_updates_and_deactivates_unit_with_audit(): void
    {
        $admin = $this->superAdmin();
        $setjen = Unit::create(['code' => 'SETJEN', 'name' => 'Sekretariat Jenderal', 'level' => Unit::LEVEL_ESELON_1]);

        $this->actingAs($admin)->post('/admin/unit-kerja', [
            'code' => 'SETJEN-HUKUM',
            'name' => 'Biro Hukum',
            'parent_id' => $setjen->id,
            'level' => Unit::LEVEL_ESELON_2,
            'email' => ' Biro.Hukum@Transmigrasi.go.id ',
            'is_active' => true,
        ])->assertSessionHasNoErrors()->assertRedirect();

        $hukum = Unit::query()->where('code', 'SETJEN-HUKUM')->firstOrFail();
        $this->assertSame($setjen->id, $hukum->parent_id);
        $this->assertSame('biro.hukum@transmigrasi.go.id', $hukum->email);

        $this->actingAs($admin)->put("/admin/unit-kerja/{$hukum->id}", [
            'code' => 'SETJEN-HUKUM',
            'name' => 'Biro Hukum',
            'parent_id' => $setjen->id,
            'level' => Unit::LEVEL_ESELON_2,
            'is_active' => false,
        ])->assertSessionHasNoErrors();

        $this->assertFalse($hukum->fresh()->is_active);
        $this->assertTrue(ActivityLog::query()->where('action', 'unit.created')->exists());
        $this->assertTrue(ActivityLog::query()->where('action', 'unit.deactivated')->exists());
    }

    public function test_upt_is_no_longer_a_valid_level(): void
    {
        $this->actingAs($this->superAdmin())
            ->post('/admin/unit-kerja', ['code' => 'UPT-X', 'name' => 'Balai X', 'level' => 'upt'])
            ->assertSessionHasErrors('level');
        $this->assertArrayNotHasKey('upt', Unit::LEVELS);
    }

    public function test_super_admin_deletes_unused_unit_with_audit(): void
    {
        $unit = Unit::create(['code' => 'LAMA', 'name' => 'Unit Lama', 'level' => Unit::LEVEL_OTHER]);

        $this->actingAs($this->superAdmin())->delete("/admin/unit-kerja/{$unit->id}")
            ->assertRedirect()->assertSessionHas('success');

        $this->assertNull($unit->fresh());
        $this->assertTrue(ActivityLog::query()->where('action', 'unit.deleted')->exists());
    }

    public function test_unit_in_use_cannot_be_deleted(): void
    {
        $admin = $this->superAdmin();
        $induk = Unit::create(['code' => 'INDUK', 'name' => 'Induk', 'level' => Unit::LEVEL_ESELON_1]);
        Unit::create(['code' => 'INDUK-ANAK', 'name' => 'Anak', 'level' => Unit::LEVEL_ESELON_2, 'parent_id' => $induk->id]);
        $berpetugas = Unit::create(['code' => 'BERPETUGAS', 'name' => 'Berpetugas', 'level' => Unit::LEVEL_OTHER]);
        User::factory()->admin(UserRole::AdminKawasan)->create(['unit_id' => $berpetugas->id]);
        $bertiket = Unit::create(['code' => 'BERTIKET', 'name' => 'Bertiket', 'level' => Unit::LEVEL_OTHER]);
        Ticket::factory()->create(['unit_id' => $bertiket->id])->delete();

        foreach ([$induk, $berpetugas, $bertiket] as $unit) {
            $this->actingAs($admin)->delete("/admin/unit-kerja/{$unit->id}")->assertSessionHas('error');
            $this->assertNotNull($unit->fresh(), "{$unit->code} tidak boleh terhapus.");
        }

        $this->actingAs($admin)->get('/admin/unit-kerja')->assertInertia(fn (Assert $page) => $page
            ->where('units.0.code', 'BERPETUGAS')
            ->where('units.0.blokir_hapus', 'masih ada petugas di unit ini')
            ->where('units.2.code', 'INDUK')
            ->where('units.2.blokir_hapus', 'masih punya sub-unit')
            ->where('units.3.code', 'INDUK-ANAK')
            ->where('units.3.blokir_hapus', null));
    }

    public function test_only_super_admin_can_delete_units(): void
    {
        $unit = Unit::create(['code' => 'LAMA', 'name' => 'Unit Lama', 'level' => Unit::LEVEL_OTHER]);

        $this->actingAs(User::factory()->admin(UserRole::AdminKawasan)->create())
            ->delete("/admin/unit-kerja/{$unit->id}")->assertForbidden();
        $this->assertNotNull($unit->fresh());
    }

    public function test_code_must_be_unique_and_well_formed(): void
    {
        $admin = $this->superAdmin();
        Unit::create(['code' => 'SETJEN', 'name' => 'Sekretariat Jenderal', 'level' => Unit::LEVEL_ESELON_1]);

        $this->actingAs($admin)->post('/admin/unit-kerja', ['code' => 'SETJEN', 'name' => 'Lain', 'level' => 'lainnya'])
            ->assertSessionHasErrors('code');
        $this->actingAs($admin)->post('/admin/unit-kerja', ['code' => 'biro hukum', 'name' => 'Lain', 'level' => 'lainnya'])
            ->assertSessionHasErrors('code');
        $this->assertSame(1, Unit::count());
    }

    public function test_parent_cannot_be_itself_or_a_descendant(): void
    {
        $admin = $this->superAdmin();
        $setjen = Unit::create(['code' => 'SETJEN', 'name' => 'Sekretariat Jenderal', 'level' => Unit::LEVEL_ESELON_1]);
        $pusbang = Unit::create(['code' => 'SETJEN-PUSBANGSDM', 'name' => 'Pusat Pengembangan SDM', 'level' => Unit::LEVEL_ESELON_2, 'parent_id' => $setjen->id]);
        $balai = Unit::create(['code' => 'UPT-YOGYA', 'name' => 'Balai Yogyakarta', 'level' => Unit::LEVEL_OTHER, 'parent_id' => $pusbang->id]);
        $payload = ['code' => 'SETJEN', 'name' => 'Sekretariat Jenderal', 'level' => Unit::LEVEL_ESELON_1];

        $this->actingAs($admin)->put("/admin/unit-kerja/{$setjen->id}", $payload + ['parent_id' => $setjen->id])->assertSessionHasErrors('parent_id');
        $this->actingAs($admin)->put("/admin/unit-kerja/{$setjen->id}", $payload + ['parent_id' => $balai->id])->assertSessionHasErrors('parent_id');
        $this->assertNull($setjen->fresh()->parent_id);
    }

    public function test_super_admin_assigns_active_unit_to_staff(): void
    {
        $admin = $this->superAdmin();
        $petugas = User::factory()->admin(UserRole::AdminKawasan)->create();
        $hukum = Unit::create(['code' => 'SETJEN-HUKUM', 'name' => 'Biro Hukum', 'level' => Unit::LEVEL_ESELON_2]);
        $lama = Unit::create(['code' => 'LAMA', 'name' => 'Unit Lama', 'level' => 'lainnya', 'is_active' => false]);

        $this->actingAs($admin)->put("/admin/petugas/{$petugas->id}/unit", ['unit_id' => $lama->id])->assertSessionHasErrors('unit_id');
        $this->assertNull($petugas->fresh()->unit_id);

        $this->actingAs($admin)->put("/admin/petugas/{$petugas->id}/unit", ['unit_id' => $hukum->id])->assertSessionHasNoErrors();
        $this->assertSame($hukum->id, $petugas->fresh()->unit_id);
        $this->assertTrue(ActivityLog::query()->where('action', 'admin.unit_updated')->exists());

        $this->actingAs($admin)->put("/admin/petugas/{$petugas->id}/unit", ['unit_id' => null])->assertSessionHasNoErrors();
        $this->assertNull($petugas->fresh()->unit_id);

        $warga = User::factory()->warga()->create();
        $this->actingAs($admin)->put("/admin/petugas/{$warga->id}/unit", ['unit_id' => $hukum->id])->assertNotFound();
    }

    public function test_new_staff_can_be_created_with_unit_and_list_shows_it(): void
    {
        $admin = $this->superAdmin();
        $hukum = Unit::create(['code' => 'SETJEN-HUKUM', 'name' => 'Biro Hukum', 'short_name' => 'Hukum', 'level' => Unit::LEVEL_ESELON_2]);

        $this->actingAs($admin)->post('/admin/petugas', [
            'name' => 'Petugas Hukum',
            'nip' => '199001012020121001',
            'role' => UserRole::AdminKawasan->value,
            'unit_id' => $hukum->id,
            'password' => 'KataSandiKuat123',
        ])->assertSessionHasNoErrors();

        $this->assertSame($hukum->id, User::query()->where('username', '199001012020121001')->value('unit_id'));

        $this->actingAs($admin)->get('/admin/petugas')
            ->assertInertia(fn (Assert $page) => $page->component('admin/admins')
                ->where('units.0.name', 'Biro Hukum')
                ->where('admins', fn ($admins) => collect($admins)->contains(fn ($a) => $a['nama'] === 'Petugas Hukum' && $a['unit'] === 'Hukum')));
    }

    public function test_internal_form_lists_active_units_and_links_reporter_unit(): void
    {
        $setjen = Unit::create(['code' => 'SETJEN', 'name' => 'Sekretariat Jenderal', 'level' => Unit::LEVEL_ESELON_1]);
        Unit::create(['code' => 'SETJEN-UMUM', 'name' => 'Biro Umum dan Layanan Pengadaan', 'level' => Unit::LEVEL_ESELON_2, 'parent_id' => $setjen->id]);
        Unit::create(['code' => 'LAMA', 'name' => 'Unit Lama', 'level' => 'lainnya', 'is_active' => false]);

        $this->get('/pengaduan/internal')
            ->assertInertia(fn (Assert $page) => $page->where('units', ['Sekretariat Jenderal', 'Biro Umum dan Layanan Pengadaan', 'Lainnya']));

        $payload = [
            'nip' => '198501012010011001',
            'nama' => 'Pegawai Uji',
            'kontak' => '081234567890',
            'kategori' => 'Internet / Jaringan',
            'urgensi' => 'Sedang',
            'lokasi' => 'Lantai 3',
            'deskripsi' => 'Jaringan internet di lantai 3 terputus sejak pagi.',
        ];

        $this->post('/pengaduan/internal', $payload + ['unit' => 'Biro Umum dan Layanan Pengadaan'])->assertSessionHasNoErrors();
        $this->post('/pengaduan/internal', $payload + ['unit' => 'Lainnya'])->assertSessionHasNoErrors();

        $tickets = Ticket::query()->internal()->orderBy('id')->get();
        $this->assertSame(Unit::query()->where('code', 'SETJEN-UMUM')->value('id'), $tickets[0]->reporter_unit_id);
        $this->assertSame('Biro Umum dan Layanan Pengadaan', $tickets[0]->reporter_unit);
        $this->assertNull($tickets[1]->reporter_unit_id);
        $this->assertSame('Lainnya', $tickets[1]->reporter_unit);
    }

    public function test_mapping_command_previews_then_maps_only_exact_names(): void
    {
        $hukum = Unit::create(['code' => 'SETJEN-HUKUM', 'name' => 'Biro Hukum', 'level' => Unit::LEVEL_ESELON_2]);
        $cocok = User::factory()->admin(UserRole::AdminKawasan)->create(['unit' => ' biro hukum ']);
        $beda = User::factory()->admin(UserRole::AdminKawasan)->create(['unit' => 'Dit. Pertanahan Transmigrasi']);
        $sudah = User::factory()->admin(UserRole::AdminKawasan)->create(['unit' => 'Biro Hukum', 'unit_id' => null]);
        $sudah->forceFill(['unit_id' => Unit::create(['code' => 'X', 'name' => 'Unit X', 'level' => 'lainnya'])->id])->save();

        $this->artisan('sigap:petakan-unit')->assertSuccessful();
        $this->assertNull($cocok->fresh()->unit_id);

        $this->artisan('sigap:petakan-unit --terapkan')->assertSuccessful();
        $this->assertSame($hukum->id, $cocok->fresh()->unit_id);
        $this->assertNull($beda->fresh()->unit_id);
        $this->assertNotSame($hukum->id, $sudah->fresh()->unit_id);
    }
}
