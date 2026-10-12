<?php

namespace Tests\Feature\Web;

use App\Models\Category;
use App\Models\Region;
use App\Models\Ticket;
use App\Models\User;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WebFormsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
    }

    public function test_public_complaint_form_creates_ticket_with_computed_priority(): void
    {
        $this->post('/pengaduan/baru', [
            'nik' => '3171010101010002',
            'nama' => 'Warga Web',
            'judul' => 'Jalan berlubang',
            'uraian' => 'Jalan berlubang di depan balai desa minimal sepuluh',
            'impact' => 'tinggi',
            // Id diambil dari data seed (sekuens PostgreSQL tidak di-reset antar-tes).
            'region_id' => Region::query()->value('id'),
            'category_id' => Category::query()->value('id'),
            'visibility' => 'publik',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $ticket = Ticket::latest('id')->first();
        $this->assertNotNull($ticket);
        $this->assertSame('tinggi', $ticket->impact->value);
        $this->assertNotSame('sedang', $ticket->priority->value, 'impact tinggi tidak boleh default ke sedang (bug B1).');
        $this->assertSame('Warga Web', $ticket->reporter_name);
    }

    public function test_public_complaint_requires_valid_nik(): void
    {
        $this->post('/pengaduan/baru', [
            'nik' => '123',
            'nama' => 'Warga Web',
            'judul' => 'Judul',
            'uraian' => 'Uraian yang cukup panjang',
            'impact' => 'rendah',
        ])->assertSessionHasErrors('nik');
    }

    public function test_internal_complaint_is_marked_internal(): void
    {
        $this->post('/pengaduan/internal', [
            'nip' => '199001012015011001',
            'nama' => 'Pegawai Web',
            'unit' => 'Biro Umum & TIK',
            'kontak' => '08123456789',
            'kategori' => 'Internet / Jaringan',
            'urgensi' => 'Tinggi',
            'lokasi' => 'Gedung A Lantai 2',
            'deskripsi' => 'Jaringan internet terputus sejak pagi',
        ])->assertRedirect('/');

        $ticket = Ticket::latest('id')->first();
        $this->assertTrue($ticket->is_internal);
        $this->assertSame('tinggi', $ticket->impact->value);
    }

    public function test_logged_in_warga_complaint_is_linked_to_account(): void
    {
        $warga = User::factory()->create(['role' => 'warga']);

        $this->actingAs($warga)->post('/pengaduan/baru', [
            'nik' => '3171010101010002',
            'nama' => 'Warga Web',
            'judul' => 'Lampu jalan mati',
            'uraian' => 'Lampu jalan mati sepanjang gang utama',
            'impact' => 'sedang',
            'visibility' => 'publik',
        ])->assertRedirect();

        $this->assertSame($warga->id, Ticket::latest('id')->first()->reporter_id);
    }
}
