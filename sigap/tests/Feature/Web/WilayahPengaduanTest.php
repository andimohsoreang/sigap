<?php

namespace Tests\Feature\Web;

use App\Enums\UserRole;
use App\Models\Category;
use App\Models\ChatConversation;
use App\Models\Ticket;
use App\Models\User;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Wilayah pengaduan berasal dari pengaduan itu sendiri (31-10-2026): provinsi
 * dipilih warga (kartu Kenalan di chat, formulir, input manual) + lokasi
 * bebas. Lokasi bebas tidak pernah tampil di halaman publik.
 */
class WilayahPengaduanTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
        Mail::fake();
    }

    public function test_guest_identity_card_stores_province_and_location(): void
    {
        $this->postJson('/chat/mulai', ['nama' => 'Siti Rahma', 'provinsi' => 'Kalimantan Utara', 'lokasi' => 'Kab. Bulungan, SP 3'])
            ->assertCreated()
            ->assertJsonPath('identitas.provinsi', 'Kalimantan Utara')
            ->assertJsonPath('identitas.lokasi', 'Kab. Bulungan, SP 3');

        $conversation = ChatConversation::query()->sole();
        $this->assertSame(['Kalimantan Utara', 'Kab. Bulungan, SP 3'], [$conversation->province, $conversation->location]);

        $this->postJson('/chat/mulai', ['nama' => 'Siti', 'provinsi' => 'Nevada'])->assertStatus(422)->assertJsonValidationErrors('provinsi');
    }

    public function test_logged_in_warga_sets_province_without_name(): void
    {
        $warga = User::factory()->warga()->create();

        $this->actingAs($warga)->postJson('/chat/mulai', ['provinsi' => 'Papua Selatan', 'lokasi' => 'Merauke'])
            ->assertOk()
            ->assertJsonPath('identitas.tipe', 'warga')
            ->assertJsonPath('identitas.provinsi', 'Papua Selatan');

        $this->assertSame('Papua Selatan', ChatConversation::query()->where('user_id', $warga->id)->value('province'));
    }

    public function test_public_form_stores_province_and_location(): void
    {
        $this->post('/pengaduan/baru', [
            'nik' => '3273010101900001',
            'nama' => 'Budi Santoso',
            'judul' => 'Jalan rusak',
            'uraian' => 'Jalan poros desa rusak berat sejak Januari.',
            'impact' => 'tinggi',
            'provinsi' => 'Jawa Barat',
            'lokasi' => 'Kab. Garut',
        ])->assertRedirect();

        $ticket = Ticket::query()->sole();
        $this->assertSame(['Jawa Barat', 'Kab. Garut'], [$ticket->province, $ticket->location]);
        $this->assertSame('Jawa Barat · Kab. Garut', $ticket->wilayahLabel());
        $this->assertSame('Jawa Barat', $ticket->wilayahLabel(false));
    }

    public function test_manual_input_requires_province_and_keeps_location(): void
    {
        $admin = User::factory()->admin(UserRole::SuperAdmin)->create();
        $base = [
            'sumber_laporan' => 'call_center',
            'nama' => 'Warga Telepon',
            'judul' => 'Sertifikat belum terbit',
            'uraian' => 'Sertifikat lahan belum terbit sejak 2019.',
            'category_id' => Category::query()->value('id'),
            'impact' => 'sedang',
        ];

        $this->actingAs($admin)->post('/admin/input-manual', $base)->assertSessionHasErrors('provinsi');
        $this->actingAs($admin)->post('/admin/input-manual', $base + ['provinsi' => 'Sulawesi Selatan', 'lokasi' => 'Luwu Timur'])
            ->assertRedirect('/admin/matriks');

        $this->assertSame('Sulawesi Selatan', Ticket::query()->where('title', 'Sertifikat belum terbit')->value('province'));
    }

    public function test_location_shows_in_admin_but_never_on_public_pages(): void
    {
        Ticket::factory()->create(['province' => 'Jawa Timur', 'location' => 'Desa Sukamaju RT 03 rumah Pak Budi', 'region_id' => null]);
        $admin = User::factory()->admin(UserRole::AdminKawasan)->create();

        $this->get('/peta')->assertOk()->assertDontSee('Sukamaju')->assertInertia(fn (Assert $page) => $page
            ->where('provinsi.0', ['provinsi' => 'Jawa Timur', 'total' => 1, 'selesai' => 0, 'berjalan' => 1]));
        $this->get('/tentang')->assertOk()->assertDontSee('Sukamaju');

        $this->actingAs($admin)->get('/admin/kawasan')->assertInertia(fn (Assert $page) => $page
            ->component('admin/sebaran-wilayah')
            ->where('total', 1)
            ->where('rows.0.provinsi', 'Jawa Timur')
            ->where('rows.0.lokasi.0', ['nama' => 'Desa Sukamaju RT 03 rumah Pak Budi', 'total' => 1]));
    }

    public function test_chat_prefill_carries_origin_to_manual_ticket(): void
    {
        $admin = User::factory()->admin(UserRole::SuperAdmin)->create();
        $conversation = ChatConversation::create(['guest_token' => 'tok-wilayah', 'guest_name' => 'Rina', 'province' => 'Bali', 'location' => 'Jembrana']);

        $this->actingAs($admin)->get("/admin/input-manual?percakapan={$conversation->id}")->assertInertia(fn (Assert $page) => $page
            ->where('prefill.provinsi', 'Bali')
            ->where('prefill.lokasi', 'Jembrana'));
    }
}
