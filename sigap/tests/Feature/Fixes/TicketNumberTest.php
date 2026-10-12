<?php

namespace Tests\Feature\Fixes;

use App\Enums\TicketStatus;
use App\Models\Ticket;
use App\Models\User;
use App\Services\AttachmentService;
use App\Services\NotificationService;
use App\Services\SlaCalculator;
use App\Services\TicketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

/**
 * A-03: nomor tiket acak TKT-YYMMDD-XXXXXX, pencarian huruf kecil, nomor lama
 * tetap valid, soft delete tanpa pemakaian ulang nomor.
 */
class TicketNumberTest extends TestCase
{
    use RefreshDatabase;

    private function data(array $overrides = []): array
    {
        return array_merge([
            'title' => 'Jalan rusak',
            'description' => 'Jalan rusak parah di depan balai desa.',
            'impact' => 'sedang',
            'reporter_name' => 'Budi Santoso',
            'reporter_nik' => '3171010101010001',
        ], $overrides);
    }

    public function test_new_number_uses_jakarta_date_and_safe_alphabet(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-12 20:30:00', 'UTC')); // 13 Okt 03:30 WIB

        $ticket = app(TicketService::class)->create($this->data());

        $this->assertMatchesRegularExpression('/^TKT-261013-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/', $ticket->ticket_no);

        Carbon::setTestNow();
    }

    public function test_numbers_are_unique_and_valid(): void
    {
        $service = app(TicketService::class);

        $numbers = collect(range(1, 15))->map(fn () => $service->create($this->data())->ticket_no);

        $this->assertCount(15, $numbers->unique());
        $this->assertTrue($numbers->every(fn ($n) => Ticket::isValidNo($n)));
    }

    public function test_taken_number_including_deleted_ticket_is_never_reused(): void
    {
        $service = Mockery::mock(TicketService::class, [
            app(SlaCalculator::class),
            app(NotificationService::class),
            app(AttachmentService::class),
        ])->makePartial();

        Ticket::factory()->create(['ticket_no' => 'TKT-261012-AAAAAA'])->delete();

        $service->shouldReceive('nextTicketNo')->andReturn('TKT-261012-AAAAAA', 'TKT-261012-BBBBBB');

        $this->assertSame('TKT-261012-BBBBBB', $service->create($this->data())->ticket_no);
    }

    public function test_lookup_accepts_lowercase_whitespace_and_legacy_numbers(): void
    {
        Ticket::factory()->create(['ticket_no' => 'TKT-261012-ABCDEF']);
        $legacy = Ticket::factory()->create(['ticket_no' => 'TKT-42']);

        $this->getJson('/api/v1/tiket/tkt-261012-abcdef')->assertOk()->assertJsonPath('data.nomor', 'TKT-261012-ABCDEF');
        // Format lama: tamu wajib menyertakan kode akses (huruf kecil diterima).
        $this->getJson('/api/v1/tiket/TKT-42')->assertNotFound();
        $this->getJson('/api/v1/tiket/TKT-42?kode=SALAH123')->assertNotFound();
        $this->getJson('/api/v1/tiket/TKT-42?kode='.strtolower($legacy->lookup_token))->assertOk()->assertJsonPath('data.nomor', 'TKT-42');

        $this->get('/lacak?ticket='.urlencode('  tkt-261012-abcdef '))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('ticket.nomor', 'TKT-261012-ABCDEF'));

        $this->get('/lacak/tkt-42')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('ticket', false)->where('butuh_kode', true));

        $this->get('/lacak/tkt-42?kode='.$legacy->lookup_token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('ticket.nomor', 'TKT-42'));
    }

    public function test_invalid_number_format_is_rejected(): void
    {
        $this->getJson('/api/v1/tiket/TKT-261012-ABC0EF')->assertStatus(400); // 0 tidak ada di alfabet
        $this->getJson('/api/v1/tiket/BUKAN')->assertStatus(400);
    }

    public function test_admin_route_binding_accepts_lowercase_number(): void
    {
        $admin = User::factory()->admin()->create();
        Ticket::factory()->create(['ticket_no' => 'TKT-261012-ABCDEF']);

        $this->actingAs($admin)->get('/admin/tiket/tkt-261012-abcdef')->assertOk();
    }

    public function test_warga_delete_is_soft_and_removes_attachment_file(): void
    {
        Storage::fake('local');

        $warga = User::factory()->warga()->create();
        $path = UploadedFile::fake()->image('foto.jpg')->store('lampiran', 'local');
        $ticket = Ticket::factory()->forReporter($warga)->create([
            'status' => TicketStatus::Baru,
            'attachment_path' => $path,
        ]);

        $this->actingAs($warga)->delete("/portal-warga/tiket/{$ticket->ticket_no}")->assertRedirect();

        $this->assertSoftDeleted('tickets', ['id' => $ticket->id]);
        Storage::disk('local')->assertMissing($path);
        $this->assertTrue(Ticket::withTrashed()->where('ticket_no', $ticket->ticket_no)->exists());
        $this->assertDatabaseHas('activity_logs', ['action' => 'ticket.deleted_by_reporter']);

        // Tiket terhapus tidak lagi dapat dilacak.
        $this->getJson("/api/v1/tiket/{$ticket->ticket_no}")->assertNotFound();
    }
}
