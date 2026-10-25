<?php

namespace Tests\Feature\Web;

use App\Enums\TicketStatus;
use App\Http\Controllers\Web\ChatController;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Halaman Chat TARA layar penuh: cookie tamu 30 hari, panel tiket,
 * akhiri chat, transkrip, dan lanjutkan di perangkat lain.
 */
class ChatPageTest extends TestCase
{
    use RefreshDatabase;

    private function startGuest(string $name = 'Siti Aminah'): ChatConversation
    {
        $this->postJson('/chat/mulai', ['nama' => $name])->assertCreated();

        return ChatConversation::query()->latest('id')->firstOrFail();
    }

    public function test_chat_page_renders_with_service_info(): void
    {
        $this->get('/chat')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('public/chat')
            ->has('layanan.jam_label')
            ->has('layanan.petugas_tersedia'));
    }

    public function test_guest_cookie_restores_conversation_after_session_expires(): void
    {
        $response = $this->postJson('/chat/mulai', ['nama' => 'Siti Aminah'])->assertCreated();
        $conversation = ChatConversation::query()->latest('id')->firstOrFail();
        $response->assertCookie(ChatController::COOKIE, $conversation->guest_token);
        $this->postJson('/chat/pesan', ['body' => 'Sertifikat lahan saya belum keluar'])->assertCreated();

        // Sesi habis (2 jam), cookie 30 hari masih ada.
        $this->flushSession();
        $this->withCredentials()
            ->withCookie(ChatController::COOKIE, $conversation->guest_token)
            ->getJson('/chat/pesan')
            ->assertOk()
            ->assertJsonPath('conversation_id', $conversation->id)
            ->assertJsonPath('identitas.nama', 'Siti Aminah');

        // Tanpa cookie & sesi (perangkat lain): percakapan baru.
        $this->flushSession();
        $this->defaultCookies = [];
        $this->getJson('/chat/pesan')->assertJsonPath('conversation_id', null);
    }

    public function test_tampered_cookie_is_ignored(): void
    {
        $this->startGuest();
        $this->flushSession();

        $this->withCredentials()->withCookie(ChatController::COOKIE, 'bukan-uuid')->getJson('/chat/pesan')->assertJsonPath('conversation_id', null);
    }

    public function test_panel_shows_ticket_timeline_staff_and_masked_contact(): void
    {
        $conversation = $this->startGuest();
        $staff = User::factory()->admin()->create(['name' => 'Rina Wulandari', 'unit' => 'Dit. Pertanahan Transmigrasi']);
        $ticket = Ticket::factory()->create(['status' => TicketStatus::Diproses]);
        $ticket->histories()->create(['from_status' => 'baru', 'to_status' => 'diproses', 'actor_id' => $staff->id]);
        $conversation->forceFill([
            'handled_by' => ChatConversation::HANDLED_STAFF,
            'handoff_at' => now()->subMinutes(10),
            'reference' => 'REF-261025-NMAJ',
            'contact' => '081234564471',
            'assigned_to' => $staff->id,
            'ticket_id' => $ticket->id,
        ])->save();

        $this->getJson('/chat/pesan')
            ->assertJsonPath('panel.referensi', 'REF-261025-NMAJ')
            ->assertJsonPath('panel.petugas.nama', 'Rina Wulandari')
            ->assertJsonPath('panel.petugas.unit', 'Dit. Pertanahan Transmigrasi')
            ->assertJsonPath('panel.kontak', '0812 •••• 4471')
            ->assertJsonPath('panel.tiket.nomor', $ticket->ticket_no)
            ->assertJsonPath('panel.tiket.status', 'diproses')
            ->assertJsonPath('panel.tiket.url', '/lacak/'.$ticket->ticket_no)
            ->assertJsonMissingPath('panel.tiket.reporter_nik');

        $this->assertNotNull($this->getJson('/chat/pesan')->json('panel.tiket.diproses_at'));
    }

    public function test_participant_can_end_and_reopen_by_writing_again(): void
    {
        $conversation = $this->startGuest();
        $this->postJson('/chat/pesan', ['body' => 'Halo'])->assertCreated();

        $this->postJson('/chat/akhiri')->assertOk()->assertJsonPath('panel.ditutup', true);
        $conversation->refresh();
        $this->assertNotNull($conversation->closed_at);
        $this->assertContains($conversation->outcome, ['diakhiri_warga', 'terjawab_ai']);
        $this->assertTrue(ChatMessage::query()->where('conversation_id', $conversation->id)->get()->contains(fn ($m) => $m->kind() === 'diakhiri'));

        // Mengakhiri lagi tidak menambah pesan.
        $count = ChatMessage::query()->count();
        $this->postJson('/chat/akhiri')->assertOk();
        $this->assertSame($count, ChatMessage::query()->count());

        // Pesan baru membuka lagi; riwayat tidak dihapus.
        $this->postJson('/chat/pesan', ['body' => 'Saya mau tanya lagi'])->assertCreated();
        $this->assertNull($conversation->fresh()->closed_at);
        $this->assertGreaterThan($count, ChatMessage::query()->count());
    }

    public function test_transcript_downloads_own_conversation_only(): void
    {
        $this->getJson('/chat/transkrip')->assertNotFound();

        $this->startGuest();
        $this->postJson('/chat/pesan', ['body' => 'Sertifikat lahan saya belum keluar'])->assertCreated();

        $res = $this->get('/chat/transkrip')->assertOk();
        $this->assertStringContainsString('attachment;', $res->headers->get('Content-Disposition'));
        $this->assertStringContainsString('Sertifikat lahan saya belum keluar', $res->getContent());
        $this->assertStringContainsString('Anda', $res->getContent());
    }

    public function test_resume_on_another_device_requires_reference_and_contact(): void
    {
        $origin = $this->startGuest();
        $origin->forceFill(['reference' => 'REF-261025-NMAJ', 'contact' => '081234564471', 'handoff_at' => now()])->save();
        $this->postJson('/chat/pesan', ['body' => 'Pesan dari HP lama'])->assertCreated();

        // HP lain: sesi & cookie baru.
        $this->flushSession();
        $this->postJson('/chat/lanjutkan', ['referensi' => 'REF-261025-NMAJ', 'kontak' => '081299999999'])->assertStatus(422);
        $this->postJson('/chat/lanjutkan', ['referensi' => 'REF-000000-XXXX', 'kontak' => '081234564471'])->assertStatus(422);

        $this->postJson('/chat/lanjutkan', ['referensi' => 'ref-261025-nmaj', 'kontak' => '+62 812-3456-4471'])
            ->assertOk()
            ->assertJsonPath('conversation_id', $origin->id)
            ->assertCookie(ChatController::COOKIE, $origin->guest_token);

        $this->getJson('/chat/pesan')->assertJsonPath('conversation_id', $origin->id);
    }

    public function test_resume_is_rate_limited_and_not_for_logged_in_users(): void
    {
        $this->actingAs(User::factory()->warga()->create())
            ->postJson('/chat/lanjutkan', ['referensi' => 'REF-Y', 'kontak' => '081200000099'])
            ->assertStatus(422);
        auth()->logout();

        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/chat/lanjutkan', ['referensi' => 'REF-X'.$i, 'kontak' => '0812000000'.$i]);
        }
        $this->postJson('/chat/lanjutkan', ['referensi' => 'REF-Y', 'kontak' => '081200000099'])->assertStatus(429);
    }

    public function test_login_adopts_cookie_conversation(): void
    {
        $guest = $this->startGuest();
        $this->postJson('/chat/pesan', ['body' => 'Pesan sebagai tamu'])->assertCreated();
        $this->flushSession();

        $warga = User::factory()->warga()->create();
        $this->actingAs($warga)
            ->withCredentials()
            ->withCookie(ChatController::COOKIE, $guest->guest_token)
            ->getJson('/chat/pesan')
            ->assertOk()
            ->assertJsonPath('identitas.tipe', 'warga');

        $this->assertSame($warga->id, $guest->fresh()->user_id);
    }
}
