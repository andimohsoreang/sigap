<?php

namespace Tests\Feature\Web;

use App\Events\ChatMessageSent;
use App\Events\TicketChanged;
use App\Models\ChatConversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class ChatTest extends TestCase
{
    use RefreshDatabase;

    /** Tamu wajib mengisi nama dulu sebelum mengirim pesan. */
    private function startGuest(string $nama = 'Budi Santoso'): void
    {
        $this->postJson('/chat/mulai', ['nama' => $nama])->assertCreated();
    }

    public function test_guest_can_send_chat_message_and_it_is_stored(): void
    {
        Event::fake([ChatMessageSent::class]);

        $this->startGuest();
        $this->postJson('/chat/pesan', ['body' => 'Halo admin, saya butuh bantuan'])
            ->assertCreated()
            ->assertJsonPath('message.body', 'Halo admin, saya butuh bantuan');

        $this->assertDatabaseHas('chat_messages', ['body' => 'Halo admin, saya butuh bantuan', 'sender_type' => 'guest']);
        $this->assertDatabaseCount('chat_conversations', 1);

        Event::assertDispatched(ChatMessageSent::class);
    }

    public function test_guest_conversation_persists_across_requests_via_session(): void
    {
        $this->startGuest();
        $this->postJson('/chat/pesan', ['body' => 'Pesan pertama'])->assertCreated();
        $this->postJson('/chat/pesan', ['body' => 'Pesan kedua'])->assertCreated();

        $this->assertDatabaseCount('chat_conversations', 1);
        $this->assertDatabaseCount('chat_messages', 2);
    }

    public function test_guest_can_list_messages_only_after_sending(): void
    {
        $this->getJson('/chat/pesan')->assertOk()->assertJsonPath('messages', []);

        $this->startGuest();
        $this->postJson('/chat/pesan', ['body' => 'Pertanyaan'])->assertCreated();

        $this->getJson('/chat/pesan')
            ->assertOk()
            ->assertJsonCount(1, 'messages')
            ->assertJsonPath('messages.0.body', 'Pertanyaan');
    }

    public function test_logged_in_warga_chat_is_linked_to_their_account(): void
    {
        $warga = User::factory()->warga()->create();

        $this->actingAs($warga)->postJson('/chat/pesan', ['body' => 'Bantuan akun'])->assertCreated();

        $this->assertDatabaseHas('chat_conversations', ['user_id' => $warga->id]);
        $this->assertDatabaseHas('chat_messages', ['sender_type' => 'user']);
    }

    public function test_chat_message_body_is_required(): void
    {
        $this->startGuest();
        $this->postJson('/chat/pesan', ['body' => ''])->assertStatus(422)->assertJsonValidationErrors('body');
    }

    public function test_admin_cannot_chat_through_public_widget_without_being_a_participant(): void
    {
        // Admin memakai panel, tetapi bila memanggil endpoint publik ia tetap
        // memiliki percakapan pribadi sendiri (tidak bocor ke pengguna lain).
        $admin = User::factory()->admin()->create();
        $warga = User::factory()->warga()->create();

        $this->actingAs($warga)->postJson('/chat/pesan', ['body' => 'Pesan warga'])->assertCreated();
        $this->actingAs($admin)->postJson('/chat/pesan', ['body' => 'Pesan admin'])->assertCreated();

        $this->assertDatabaseCount('chat_conversations', 2);
        $this->assertDatabaseHas('chat_conversations', ['user_id' => $warga->id]);
        $this->assertDatabaseHas('chat_conversations', ['user_id' => $admin->id]);
    }

    public function test_admin_can_reply_to_chat_and_unread_counter_updates(): void
    {
        $warga = User::factory()->warga()->create();
        $admin = User::factory()->admin()->create();

        $this->actingAs($warga)->postJson('/chat/pesan', ['body' => 'Halo'])->assertCreated();
        $conversation = ChatConversation::firstOrFail();

        $this->actingAs($admin)
            ->post("/admin/chat/{$conversation->id}/balas", ['body' => 'Baik, kami bantu.'])
            ->assertRedirect();

        $this->assertDatabaseHas('chat_messages', [
            'conversation_id' => $conversation->id,
            'sender_type' => 'admin',
            'body' => 'Baik, kami bantu.',
        ]);

        $this->assertSame(1, $conversation->fresh()->unread_user);
    }

    public function test_warga_cannot_reply_via_admin_chat_route(): void
    {
        $warga = User::factory()->warga()->create();
        $conversation = ChatConversation::create(['guest_token' => 'x', 'subject' => 'Live Chat (Tamu)']);

        $this->actingAs($warga)
            ->post("/admin/chat/{$conversation->id}/balas", ['body' => 'Coba'])
            ->assertRedirect('/portal-warga');
    }

    public function test_chat_broadcast_channel_authorizes_participant_and_admin(): void
    {
        // Uji callback otorisasi channel secara langsung. Mengirim ke
        // /broadcasting/auth tidak dipakai di sini karena driver 'null' yang
        // dipasang pada lingkungan pengujian otomatis meloloskan semua kanal.
        $warga = User::factory()->warga()->create();
        $other = User::factory()->warga()->create();
        $admin = User::factory()->admin()->create();

        $this->actingAs($warga)->postJson('/chat/pesan', ['body' => 'Hi'])->assertCreated();
        $conversation = ChatConversation::firstOrFail();

        $channels = Broadcast::getChannels();
        $chatCallback = $channels->get('chat.{conversationId}');
        // A-06: notifikasi admin kini lewat kanal privat per pengguna.
        $userCallback = $channels->get('user.{id}');

        $this->assertIsCallable($chatCallback);
        $this->assertIsCallable($userCallback);

        // Pemilik percakapan & admin diizinkan.
        $this->assertTrue((bool) $chatCallback($warga, $conversation->id));
        $this->assertTrue((bool) $chatCallback($admin, $conversation->id));

        // Warga lain ditolak.
        $this->assertFalse((bool) $chatCallback($other, $conversation->id));

        // Kanal notifikasi per pengguna: hanya pemiliknya.
        $this->assertTrue((bool) $userCallback($admin, $admin->id));
        $this->assertFalse((bool) $userCallback($warga, $admin->id));
    }

    public function test_guest_conversation_is_not_open_to_other_users(): void
    {
        // Tamu mengirim pesan -> percakapan milik tamu (user_id null).
        $this->startGuest();
        $this->postJson('/chat/pesan', ['body' => 'Halo dari tamu'])->assertCreated();
        $conversation = ChatConversation::firstOrFail();
        $this->assertNull($conversation->user_id);
        $this->assertNotNull(session('chat_guest_token'));

        $chatCallback = Broadcast::getChannels()->get('chat.{conversationId}');

        // Warga lain tidak boleh berlangganan percakapan tamu (fallback
        // polling dipakai tamu; kanal privat menolak pengguna anonim).
        $warga = User::factory()->warga()->create();
        $this->assertFalse((bool) $chatCallback($warga, $conversation->id));
    }

    public function test_ticket_creation_dispatches_broadcast_event(): void
    {
        Event::fake([TicketChanged::class]);

        $this->postJson('/api/v1/pengaduan', [
            'nik' => '3171010101010002',
            'nama' => 'Warga Broadcast',
            'judul' => 'Uji broadcast',
            'uraian' => 'Uji siaran tiket baru minimal sepuluh',
            'impact' => 'tinggi',
        ])->assertCreated();

        Event::assertDispatched(TicketChanged::class);
    }

    public function test_ticket_creation_succeeds_even_without_broadcasting(): void
    {
        // broadcast driver 'null' pada testing — pastikan tiket tetap tersimpan.
        $this->postJson('/api/v1/pengaduan', [
            'nik' => '3171010101010003',
            'nama' => 'Warga Tanpa Reverb',
            'judul' => 'Tetap tersimpan',
            'uraian' => 'Laporan harus tetap masuk meski Reverb mati',
            'impact' => 'rendah',
        ])->assertCreated();

        $this->assertDatabaseHas('tickets', ['title' => 'Tetap tersimpan']);
    }
}
