<?php

namespace Tests\Feature\Web;

use App\Enums\UserRole;
use App\Mail\TicketNotificationMail;
use App\Models\Region;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Surel petugas: diisi saat tambah admin, diubah super admin, atau lewat profil sendiri. */
class AdminEmailTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_creates_admin_with_email(): void
    {
        $super = User::factory()->admin()->create();
        $region = Region::factory()->create();

        $this->actingAs($super)->post('/admin/petugas', [
            'name' => 'Petugas Bulungan',
            'nip' => '198001012010011001',
            'email' => 'Petugas.Bulungan@Transmigrasi.go.id',
            'role' => UserRole::AdminKawasan->value,
            'region_id' => $region->id,
            'password' => 'RahasiaKuat123',
        ])->assertSessionHasNoErrors();

        $this->assertDatabaseHas('users', ['username' => '198001012010011001', 'email' => 'petugas.bulungan@transmigrasi.go.id']);

        $this->actingAs($super)->get('/admin/petugas')->assertInertia(fn (Assert $page) => $page
            ->where('admins.1.email', 'petugas.bulungan@transmigrasi.go.id'));
    }

    public function test_email_is_optional_but_must_be_unique_and_valid(): void
    {
        $super = User::factory()->admin()->create(['email' => 'dipakai@example.com']);
        $base = ['name' => 'A', 'role' => UserRole::SuperAdmin->value, 'password' => 'RahasiaKuat123'];

        $this->actingAs($super)->post('/admin/petugas', $base + ['nip' => 'nip-1'])->assertSessionHasNoErrors();
        $this->actingAs($super)->post('/admin/petugas', $base + ['nip' => 'nip-2', 'email' => 'dipakai@example.com'])
            ->assertSessionHasErrors(['email' => 'Email sudah dipakai akun lain.']);
        $this->actingAs($super)->post('/admin/petugas', $base + ['nip' => 'nip-3', 'email' => 'bukan-email'])
            ->assertSessionHasErrors('email');
    }

    public function test_super_admin_can_set_and_clear_email_of_existing_admin(): void
    {
        $super = User::factory()->admin()->create();
        $petugas = User::factory()->admin(UserRole::AdminKawasan)->create(['email' => null]);

        $this->actingAs($super)->put("/admin/petugas/{$petugas->id}/email", ['email' => 'baru@example.com'])
            ->assertSessionHas('success');
        $this->assertSame('baru@example.com', $petugas->fresh()->email);
        $this->assertDatabaseHas('activity_logs', ['action' => 'admin.email_updated', 'subject_id' => $petugas->id]);

        $this->actingAs($super)->put("/admin/petugas/{$petugas->id}/email", ['email' => ''])->assertSessionHas('success');
        $this->assertNull($petugas->fresh()->email);
    }

    public function test_only_super_admin_can_edit_other_admin_email_and_not_warga(): void
    {
        $kawasan = User::factory()->admin(UserRole::AdminKawasan)->create();
        $other = User::factory()->admin(UserRole::AdminKawasan)->create(['email' => 'tetap@example.com']);
        $warga = User::factory()->warga()->create();
        $super = User::factory()->admin()->create();

        $this->actingAs($kawasan)->put("/admin/petugas/{$other->id}/email", ['email' => 'x@example.com'])->assertForbidden();
        $this->assertSame('tetap@example.com', $other->fresh()->email);

        $this->actingAs($super)->put("/admin/petugas/{$warga->id}/email", ['email' => 'x@example.com'])->assertNotFound();
    }

    public function test_admin_can_set_own_email_in_profile(): void
    {
        $admin = User::factory()->admin(UserRole::AdminKawasan)->create(['name' => 'Rina', 'email' => null]);

        $this->actingAs($admin)->get('/admin/pengaturan')->assertInertia(fn (Assert $page) => $page->where('profil.email', null));

        $this->actingAs($admin)->put('/admin/profil', ['name' => 'Rina', 'email' => 'Rina@Example.com'])->assertSessionHasNoErrors();
        $this->assertSame('rina@example.com', $admin->fresh()->email);

        // Permintaan tanpa field email tidak menghapus surel yang ada.
        $this->actingAs($admin)->put('/admin/profil', ['name' => 'Rina Putri'])->assertSessionHasNoErrors();
        $this->assertSame('rina@example.com', $admin->fresh()->email);
    }

    public function test_admin_with_email_receives_ticket_notification(): void
    {
        Mail::fake();
        $region = Region::factory()->create();
        User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => $region->id, 'email' => 'petugas@example.com']);

        $this->post('/pengaduan/baru', [
            'nik' => '3273010101900001',
            'nama' => 'Budi',
            'judul' => 'Jembatan putus',
            'uraian' => 'Jembatan penghubung SP2 putus sejak kemarin.',
            'impact' => 'kritis',
            'region_id' => $region->id,
        ])->assertRedirect();

        $ticket = Ticket::query()->firstOrFail();
        Mail::assertQueued(TicketNotificationMail::class, fn (TicketNotificationMail $m) => $m->hasTo('petugas@example.com')
            && $m->payload['nomor'] === $ticket->ticket_no);
    }
}
