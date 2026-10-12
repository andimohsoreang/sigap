<?php

namespace Tests\Feature\Api;

use App\Enums\TicketImpact;
use App\Enums\UserRole;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PengaduanApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_ticket_creation_computes_priority_and_sla(): void
    {
        $response = $this->postJson('/api/v1/pengaduan', [
            'nik' => '3171010101010001',
            'nama' => 'Warga Uji',
            'judul' => 'Jalan rusak parah',
            'uraian' => 'Jalan rusak parah di depan kantor desa.',
            'koordinat' => '-8.4991,140.4011',
            'impact' => 'kritis',
        ]);

        $response->assertCreated()->assertJsonPath('ok', true);

        $ticket = Ticket::firstOrFail();
        $this->assertSame(TicketImpact::Kritis, $ticket->impact);
        $this->assertSame('darurat', $ticket->priority->value);
        $this->assertNotNull($ticket->sla_due_at);
        $this->assertSame(-8.4991, $ticket->latitude);
    }

    public function test_public_ticket_requires_valid_nik_and_impact(): void
    {
        $this->postJson('/api/v1/pengaduan', [
            'nik' => '123',
            'nama' => 'x',
            'judul' => 'y',
            'uraian' => 'pendek',
            'impact' => 'tidak-ada',
        ])->assertStatus(422)->assertJsonValidationErrors(['nik', 'uraian', 'impact']);
    }

    public function test_internal_ticket_never_exposed_publicly(): void
    {
        $this->postJson('/api/v1/pengaduan/internal', [
            'nip' => '198701',
            'nama' => 'Pegawai',
            'unit' => 'Biro Umum',
            'kontak' => '08123',
            'kategori' => 'Jaringan',
            'urgensi' => 'Tinggi',
            'lokasi' => 'Lantai 2',
            'deskripsi' => 'Internet kantor mati total',
        ])->assertCreated();

        $ticket = Ticket::firstOrFail();
        $this->assertTrue($ticket->is_internal);

        $this->getJson("/api/v1/tiket/{$ticket->ticket_no}")->assertNotFound();
    }

    public function test_public_tracking_masks_reporter_nik(): void
    {
        $ticket = Ticket::factory()->create([
            'reporter_nik' => '3171010101010001',
            'is_internal' => false,
        ]);

        $this->getJson("/api/v1/tiket/{$ticket->ticket_no}")
            ->assertOk()
            ->assertJsonPath('data.nik', '3171********0001');
    }

    public function test_public_tracking_rejects_invalid_ticket_format(): void
    {
        $this->getJson('/api/v1/tiket/BUKAN-TIKET')->assertStatus(400);
    }
}