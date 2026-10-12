<?php

namespace Tests\Feature\Fixes;

use App\Enums\UserRole;
use App\Models\Category;
use App\Models\Region;
use App\Models\Ticket;
use App\Models\User;
use App\Services\AttachmentService;
use App\Services\TicketService;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * A-11 (input manual), A-12 (form internal), A-13 (URL kanal), A-15
 * (koordinat), A-16 (ekstensi lampiran).
 */
class InputValidationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
    }

    private function manualPayload(array $extra = []): array
    {
        return array_merge([
            'sumber_laporan' => 'instagram',
            'admin_penerima' => 'Petugas Piket',
            'tautan' => 'https://instagram.com/p/abc',
            'nama' => 'warga_ig',
            'judul' => 'Aduan via IG',
            'uraian' => 'Keluhan warga lewat Instagram minimal sepuluh',
            'category_id' => Category::query()->value('id'),
            'impact' => 'sedang',
        ], $extra);
    }

    public function test_admin_kawasan_manual_input_is_forced_to_own_region_and_stores_source(): void
    {
        Storage::fake('local');
        $own = Region::factory()->create();
        $other = Region::factory()->create();
        $admin = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => $own->id]);

        $this->actingAs($admin)->post('/admin/input-manual', $this->manualPayload([
            'region_id' => $other->id,
            'attachment' => UploadedFile::fake()->create('bukti.pdf', 10, 'application/pdf'),
        ]))->assertRedirect('/admin/matriks');

        $ticket = Ticket::where('title', 'Aduan via IG')->firstOrFail();
        $this->assertSame($own->id, $ticket->region_id);
        $this->assertSame('instagram', $ticket->source);
        $this->assertSame('https://instagram.com/p/abc', $ticket->source_url);
        // admin_penerima kiriman klien ('Petugas Piket') diabaikan.
        $this->assertSame($admin->name, $ticket->received_by);
        $this->assertNotNull($ticket->attachment_path);
        Storage::disk('local')->assertExists($ticket->attachment_path);

        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/admin/input-manual', $this->manualPayload([
            'judul' => 'Aduan via API',
            'region_id' => $other->id,
        ]))->assertCreated();

        $this->assertSame($own->id, Ticket::where('title', 'Aduan via API')->value('region_id'));
    }

    public function test_internal_form_stores_nip_unit_and_location(): void
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

        $ticket = Ticket::latest('id')->firstOrFail();
        $this->assertSame('199001012015011001', $ticket->reporter_nip);
        $this->assertSame('Biro Umum & TIK', $ticket->reporter_unit);
        $this->assertSame('Gedung A Lantai 2', $ticket->location);
        $this->assertNotNull($ticket->sla_due_at, 'tiket internal juga memiliki SLA (D-06)');
    }

    public function test_channel_and_manual_urls_must_be_http(): void
    {
        $super = User::factory()->admin()->create();

        $this->actingAs($super)->post('/admin/kanal', ['type' => 'sosmed', 'name' => 'X', 'url' => 'javascript:alert(1)'])
            ->assertSessionHasErrors('url');
        $this->actingAs($super, 'sanctum')->postJson('/api/v1/admin/kanal', ['type' => 'sosmed', 'name' => 'X', 'url' => 'ftp://contoh.id/a'])
            ->assertStatus(422)->assertJsonValidationErrors('url');
        $this->actingAs($super, 'sanctum')->postJson('/api/v1/admin/input-manual', $this->manualPayload([
            'region_id' => Region::factory()->create()->id,
            'tautan' => 'javascript:alert(1)',
        ]))->assertStatus(422)->assertJsonValidationErrors('tautan');
    }

    public function test_out_of_range_coordinates_are_validation_errors(): void
    {
        $base = [
            'nik' => '3171010101010001',
            'nama' => 'Warga',
            'judul' => 'Koordinat',
            'uraian' => 'Uji koordinat di luar jangkauan',
            'impact' => 'rendah',
        ];

        $this->postJson('/api/v1/pengaduan', $base + ['koordinat' => '123.5, 140'])
            ->assertStatus(422)->assertJsonValidationErrors('koordinat');
        $this->postJson('/api/v1/pengaduan', $base + ['koordinat' => '-8.5, 999999999999'])
            ->assertStatus(422)->assertJsonValidationErrors('koordinat');
        $this->post('/pengaduan/baru', $base + ['koordinat' => 'bukan koordinat'])
            ->assertSessionHasErrors('koordinat');

        $this->postJson('/api/v1/pengaduan', $base + ['koordinat' => '-8.4991, 140.4011'])->assertCreated();
        $this->assertSame(140.4011, Ticket::firstOrFail()->longitude);
    }

    public function test_attachment_extension_comes_from_file_content(): void
    {
        Storage::fake('local');

        // Nama .php tetapi isi PNG: disimpan sebagai .png, bukan .php.
        $tmp = tempnam(sys_get_temp_dir(), 'upl');
        file_put_contents($tmp, base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
        ));
        $file = new UploadedFile($tmp, 'shell.php', 'application/x-php', null, true);

        $path = app(AttachmentService::class)->store($file);

        $this->assertStringEndsWith('.png', $path);
        Storage::disk('local')->assertExists($path);

        @unlink($tmp);
    }

    public function test_attachment_is_removed_when_ticket_creation_fails(): void
    {
        Storage::fake('local');

        try {
            app(TicketService::class)->create([
                'title' => 'Gagal',
                'description' => 'Dampak tidak valid memicu error',
                'impact' => 'tidak-ada',
                'attachment' => UploadedFile::fake()->create('bukti.pdf', 5, 'application/pdf'),
            ]);
            $this->fail('Seharusnya melempar exception.');
        } catch (\ValueError) {
            // diharapkan
        }

        $this->assertSame([], Storage::disk('local')->allFiles());
    }
}
