<?php

namespace Tests\Feature\Web;

use App\Enums\UserRole;
use App\Models\Region;
use App\Models\User;
use App\Services\PublicChannels;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PublicChannelsTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $overrides = []): array
    {
        $payload = array_replace_recursive(PublicChannels::defaults(), $overrides);
        // Daftar akun diganti utuh, bukan digabung per indeks.
        if (isset($overrides['sosmed']['akun'])) {
            $payload['sosmed']['akun'] = $overrides['sosmed']['akun'];
        }

        return $payload;
    }

    public function test_beranda_shows_default_channels(): void
    {
        $this->get('/beranda-baru')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('public/beranda-transi')
            ->where('kanal.sosmed.label', 'Social Media')
            ->where('kanal.kantor.label', 'Kantor')
            ->where('kanal.kpk.label', 'Whistleblowing KPK')
            ->where('kanal.kpk.url', 'https://kws.kpk.go.id/'));
    }

    public function test_katalog_lists_the_same_channels(): void
    {
        $this->get('/katalog')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('public/katalog')
            ->has('kanal.sosmed.akun', 5)
            ->where('kanal.kantor.label', 'Kantor')
            ->where('kanal.internal.url', '/pengaduan/internal')
            ->has('categories'));
    }

    public function test_super_admin_can_update_channels(): void
    {
        $admin = User::factory()->admin(UserRole::SuperAdmin)->create();

        $this->actingAs($admin)->put('/admin/pengaturan/kanal-publik', $this->payload([
            'sosmed' => ['whatsapp' => '0811-1111-2222', 'akun' => [['platform' => 'x', 'nama' => '@contoh', 'url' => 'https://x.com/contoh']]],
            'kantor' => ['alamat' => 'Jl. Contoh No. 1', 'lat' => '-6.2', 'lng' => '106.8'],
            'internal' => ['url' => 'https://intra.example.go.id/aduan'],
            'lapor' => ['aktif' => false],
        ]))->assertRedirect()->assertSessionHasNoErrors();

        $kanal = PublicChannels::get();
        $this->assertSame('0811-1111-2222', $kanal['sosmed']['whatsapp']);
        $this->assertCount(1, $kanal['sosmed']['akun']);
        $this->assertSame(-6.2, $kanal['kantor']['lat']);
        $this->assertSame('https://intra.example.go.id/aduan', $kanal['internal']['url']);
        $this->assertFalse($kanal['lapor']['aktif']);

        $this->get('/beranda-baru')->assertInertia(fn (Assert $page) => $page->where('kanal.kantor.alamat', 'Jl. Contoh No. 1'));
    }

    public function test_rejects_unsafe_urls(): void
    {
        $admin = User::factory()->admin(UserRole::SuperAdmin)->create();

        $this->actingAs($admin)->put('/admin/pengaturan/kanal-publik', $this->payload([
            'kpk' => ['url' => 'javascript:alert(1)'],
            'sosmed' => ['akun' => [['platform' => 'instagram', 'nama' => '@a', 'url' => 'javascript:alert(1)']]],
        ]))->assertSessionHasErrors(['kpk.url', 'sosmed.akun.0.url']);
    }

    public function test_admin_kawasan_cannot_update_channels(): void
    {
        $admin = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => Region::factory()->create()->id]);

        $this->actingAs($admin)->put('/admin/pengaturan/kanal-publik', $this->payload())->assertForbidden();
    }
}
