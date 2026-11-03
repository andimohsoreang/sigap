<?php

namespace Tests\Feature\Web;

use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\Ticket;
use App\Models\User;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Diagram tambahan Matriks Rekapitulasi: corong layanan TARA (percakapan →
 * selesai oleh TARA / ditangani petugas → hasil akhir) dan kinerja petugas.
 */
class MatriksDiagramTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-15 10:00:00');
        $this->seed(MasterSeeder::class);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** @param  array<string, mixed>  $attributes */
    private function conversation(array $attributes, bool $answeredByAi = false): ChatConversation
    {
        $conversation = ChatConversation::create($attributes + [
            'guest_token' => Str::random(20),
            'subject' => 'Percakapan',
            'handled_by' => ChatConversation::HANDLED_AI,
        ]);
        $conversation->forceFill(['created_at' => $attributes['created_at'] ?? now()->subDay()])->save();

        if ($answeredByAi) {
            ChatMessage::create(['conversation_id' => $conversation->id, 'sender_type' => 'ai', 'body' => 'Jawaban', 'meta' => ['kind' => 'jawaban']]);
        }

        return $conversation;
    }

    public function test_service_funnel_splits_every_conversation_once(): void
    {
        $ticket = Ticket::factory()->create(['created_at' => now()->subDay()]);

        // Selesai oleh TARA: dijawab dengan sumber, tidak pernah diteruskan.
        $this->conversation([], answeredByAi: true);
        // Tanpa jawaban: hanya menyapa lalu pergi.
        $this->conversation([]);
        // Ditangani petugas (diteruskan setelah TARA menjawab tetap dihitung petugas).
        $this->conversation(['handoff_at' => now()->subDay(), 'ticket_id' => $ticket->id, 'outcome' => 'tiket', 'closed_at' => now()], answeredByAi: true);
        $this->conversation(['handled_by' => ChatConversation::HANDLED_STAFF, 'outcome' => 'rujuk_portal', 'closed_at' => now()]);
        $this->conversation(['handoff_at' => now()->subDay(), 'outcome' => 'wbs', 'closed_at' => now()]);
        $this->conversation(['handoff_at' => now()->subDay()]);
        $this->conversation(['handoff_at' => now()->subDay(), 'outcome' => 'diakhiri_warga', 'closed_at' => now()]);
        // Bulan lalu: di luar periode bawaan (bulan berjalan).
        $this->conversation(['created_at' => now()->subMonth()], answeredByAi: true);

        $this->actingAs(User::factory()->admin(UserRole::SuperAdmin)->create())
            ->get('/admin/matriks')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('rekap.layanan.percakapan', 7)
                ->where('rekap.layanan.tahap', [
                    ['key' => 'tara', 'label' => 'Selesai oleh TARA', 'total' => 1],
                    ['key' => 'petugas', 'label' => 'Ditangani petugas', 'total' => 5],
                    ['key' => 'tanpa_jawaban', 'label' => 'Tanpa jawaban / ditinggalkan', 'total' => 1],
                ])
                ->where('rekap.layanan.hasil_petugas', [
                    ['key' => 'tiket', 'label' => 'Jadi tiket', 'total' => 1],
                    ['key' => 'rujuk_portal', 'label' => 'Dirujuk ke portal', 'total' => 1],
                    ['key' => 'diarahkan', 'label' => 'Diarahkan ke LAPOR! / Inspektorat', 'total' => 1],
                    ['key' => 'terjawab_petugas', 'label' => 'Dijawab petugas', 'total' => 0],
                    ['key' => 'berjalan', 'label' => 'Masih ditangani', 'total' => 1],
                    ['key' => 'lainnya', 'label' => 'Tidak selesai / diakhiri warga', 'total' => 1],
                ])
            );
    }

    public function test_staff_performance_splits_tickets_and_averages_first_response(): void
    {
        $rina = User::factory()->admin(UserRole::SuperAdmin)->create(['name' => 'Rina']);
        $dimas = User::factory()->admin(UserRole::SuperAdmin)->create(['name' => 'Dimas']);
        $created = now()->subDays(3);
        $ticket = fn (array $a) => Ticket::factory()->create($a + ['created_at' => $created, 'assignee_id' => $rina->id]);

        // Rina: selesai tepat waktu, selesai terlambat, berjalan, lewat tenggat, ditolak.
        $ticket(['status' => TicketStatus::Selesai, 'sla_due_at' => now()->addDay(), 'resolved_at' => now()->subDay(), 'responded_at' => $created->copy()->addHours(2)]);
        $ticket(['status' => TicketStatus::Selesai, 'sla_due_at' => now()->subDays(2), 'resolved_at' => now()->subDay(), 'responded_at' => $created->copy()->addHours(4)]);
        $ticket(['status' => TicketStatus::Diproses, 'sla_due_at' => now()->addDays(2)]);
        $ticket(['status' => TicketStatus::Baru, 'sla_due_at' => now()->subHour()]);
        $ticket(['status' => TicketStatus::Ditolak]);
        // Dimas: satu tiket berjalan. Satu tiket belum ditugaskan.
        $ticket(['status' => TicketStatus::Verifikasi, 'assignee_id' => $dimas->id, 'sla_due_at' => now()->addDay()]);
        $ticket(['status' => TicketStatus::Baru, 'assignee_id' => null, 'sla_due_at' => now()->addDay()]);

        $this->actingAs($rina)
            ->get('/admin/matriks')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('rekap.petugas', 3)
                ->where('rekap.petugas.0.label', 'Rina')
                ->where('rekap.petugas.0.total', 5)
                ->where('rekap.petugas.0.nilai', ['selesai_tepat' => 1, 'selesai_lambat' => 1, 'berjalan' => 1, 'lewat' => 1, 'ditolak' => 1])
                ->where('rekap.petugas.0.sla_pct', 50)
                ->where('rekap.petugas.0.respons_jam', 3)
                ->where('rekap.petugas.1.label', 'Dimas')
                ->where('rekap.petugas.1.respons_jam', null)
                // "Belum ditugaskan" selalu paling bawah dan bisa dibuka sebagai saringan.
                ->where('rekap.petugas.2.key', 'none')
                ->where('rekap.petugas.2.label', 'Belum ditugaskan')
            );
    }
}
