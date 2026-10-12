<?php

namespace Tests\Feature\Web;

use App\Events\ChatUnreadChanged;
use App\Models\ChatConversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Live chat: identitas penanya (tamu wajib isi nama; warga pakai akun),
 * posisi pesan (`mine`), penggabungan saat login, dan badge belum-dibaca admin.
 */
class ChatIdentityTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_send_message_before_entering_name(): void
    {
        $this->postJson('/chat/pesan', ['body' => 'Halo'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'identity_required');

        $this->assertDatabaseCount('chat_messages', 0);
    }

    public function test_guest_name_is_required_and_validated(): void
    {
        $this->postJson('/chat/mulai', ['nama' => ''])->assertStatus(422)->assertJsonValidationErrors('nama');
        $this->postJson('/chat/mulai', ['nama' => 'A'])->assertStatus(422)->assertJsonValidationErrors('nama');
        $this->postJson('/chat/mulai', ['nama' => '<script>x</script>'])->assertStatus(422)->assertJsonValidationErrors('nama');
        $this->postJson('/chat/mulai', ['nama' => str_repeat('a', 101)])->assertStatus(422)->assertJsonValidationErrors('nama');

        $this->assertDatabaseCount('chat_conversations', 0);
    }

    public function test_guest_starts_chat_with_name_and_identity_is_returned(): void
    {
        $this->postJson('/chat/mulai', ['nama' => "  Siti   Nur'aini  "])
            ->assertCreated()
            ->assertJsonPath('identitas.nama', "Siti Nur'aini")
            ->assertJsonPath('identitas.tipe', 'tamu');

        $this->assertDatabaseHas('chat_conversations', ['guest_name' => "Siti Nur'aini", 'user_id' => null]);

        $this->postJson('/chat/pesan', ['body' => 'Kapan sertifikat terbit?'])
            ->assertCreated()
            ->assertJsonPath('message.mine', true);

        $this->getJson('/chat/pesan')
            ->assertOk()
            ->assertJsonPath('identitas.nama', "Siti Nur'aini")
            ->assertJsonPath('messages.0.mine', true);
    }

    public function test_officer_reply_is_not_mine_and_shows_officer_name(): void
    {
        $admin = User::factory()->admin()->create(['name' => 'Rina Petugas']);
        $this->postJson('/chat/mulai', ['nama' => 'Budi'])->assertCreated();
        $this->postJson('/chat/pesan', ['body' => 'Halo'])->assertCreated();
        $conversation = ChatConversation::firstOrFail();

        // Admin membalas (akun lain), lalu tamu memuat ulang pesan.
        $this->actingAs($admin)->post("/admin/chat/{$conversation->id}/balas", ['body' => 'Siap dibantu']);
        auth()->guard('web')->logout();

        $this->getJson('/chat/pesan')
            ->assertOk()
            ->assertJsonPath('messages.1.mine', false)
            ->assertJsonPath('messages.1.penulis', 'Rina Petugas')
            ->assertJsonPath('belum_dibaca', 1);

        // Membuka widget (?baca=1) menandai balasan petugas sudah dibaca.
        $this->getJson('/chat/pesan?baca=1')->assertOk()->assertJsonPath('belum_dibaca', 0);
        $this->assertSame(0, $conversation->fresh()->unread_user);
        $this->assertNotNull($conversation->messages()->where('sender_type', 'admin')->first()->read_at);
    }

    public function test_logged_in_warga_needs_no_identity_step(): void
    {
        $warga = User::factory()->warga()->create(['name' => 'Ahmad Warga']);

        $this->actingAs($warga)->getJson('/chat/pesan')
            ->assertOk()
            ->assertJsonPath('identitas.nama', 'Ahmad Warga')
            ->assertJsonPath('identitas.tipe', 'warga');

        $this->actingAs($warga)->postJson('/chat/pesan', ['body' => 'Halo'])->assertCreated();
        $this->assertDatabaseHas('chat_conversations', ['user_id' => $warga->id, 'guest_name' => null]);
    }

    public function test_guest_chat_is_adopted_by_account_after_login(): void
    {
        $this->postJson('/chat/mulai', ['nama' => 'Budi'])->assertCreated();
        $this->postJson('/chat/pesan', ['body' => 'Pesan sebagai tamu'])->assertCreated();
        $guest = ChatConversation::firstOrFail();

        $warga = User::factory()->warga()->create();
        $this->actingAs($warga)->getJson('/chat/pesan')
            ->assertOk()
            ->assertJsonPath('messages.0.body', 'Pesan sebagai tamu');

        $this->assertSame($warga->id, $guest->fresh()->user_id);
        $this->assertNull($guest->fresh()->guest_token);
        $this->assertNull(session('chat_guest_token'));
    }

    public function test_guest_chat_is_merged_into_existing_account_conversation(): void
    {
        $warga = User::factory()->warga()->create();
        $own = ChatConversation::create(['user_id' => $warga->id, 'subject' => 'Live Chat', 'unread_admin' => 1]);
        $own->messages()->create(['sender_type' => 'user', 'sender_id' => $warga->id, 'body' => 'Lama']);

        $this->postJson('/chat/mulai', ['nama' => 'Budi'])->assertCreated();
        $this->postJson('/chat/pesan', ['body' => 'Baru sebagai tamu'])->assertCreated();

        $this->actingAs($warga)->getJson('/chat/pesan')->assertOk()->assertJsonCount(2, 'messages');

        $this->assertDatabaseCount('chat_conversations', 1);
        $this->assertSame(2, $own->fresh()->unread_admin);
    }

    public function test_admin_sees_guest_name_and_type(): void
    {
        $admin = User::factory()->admin()->create();
        $this->postJson('/chat/mulai', ['nama' => 'Budi Tamu'])->assertCreated();
        $this->postJson('/chat/pesan', ['body' => 'Halo'])->assertCreated();

        $this->actingAs($admin)->get('/admin/chat')
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/chat')
                ->where('conversations.0.nama', 'Budi Tamu')
                ->where('conversations.0.tipe', 'tamu')
                ->where('active.nama', 'Budi Tamu')
                ->where('active.messages.0.penulis', 'Budi Tamu'));
    }

    public function test_unread_badge_counts_and_clears_when_conversation_is_opened(): void
    {
        $admin = User::factory()->admin()->create();
        $a = ChatConversation::create(['guest_token' => 'a', 'guest_name' => 'A', 'subject' => 'x', 'unread_admin' => 2, 'last_message_at' => now()->subMinute()]);
        $b = ChatConversation::create(['guest_token' => 'b', 'guest_name' => 'B', 'subject' => 'x', 'unread_admin' => 3, 'last_message_at' => now()]);

        // Shared prop badge sidebar = total belum dibaca (sebelum membuka chat).
        $this->actingAs($admin)->get('/admin/matriks')
            ->assertInertia(fn (Assert $page) => $page->where('chat_unread', 5));

        // Membuka percakapan A: badge-nya langsung 0 pada respons yang sama, B tetap.
        $this->actingAs($admin)->get("/admin/chat?conversation={$a->id}")
            ->assertInertia(fn (Assert $page) => $page
                ->where('active.id', $a->id)
                ->where('conversations.1.id', $a->id)
                ->where('conversations.1.unread', 0)
                ->where('conversations.0.unread', 3)
                ->where('chat_unread', 3));

        $this->assertSame(0, $a->fresh()->unread_admin);
        $this->assertSame(3, $b->fresh()->unread_admin);

        $this->actingAs($admin)->getJson('/admin/chat/belum-dibaca')->assertOk()->assertJsonPath('total', 3);
        $this->actingAs($admin)->postJson("/admin/chat/{$b->id}/baca")->assertOk()->assertJsonPath('total', 0);
    }

    public function test_unread_event_is_broadcast_on_incoming_message_and_on_read(): void
    {
        Event::fake([ChatUnreadChanged::class]);
        $admin = User::factory()->admin()->create();

        $this->postJson('/chat/mulai', ['nama' => 'Budi'])->assertCreated();
        $this->postJson('/chat/pesan', ['body' => 'Halo'])->assertCreated();
        Event::assertDispatchedTimes(ChatUnreadChanged::class, 1);

        $conversation = ChatConversation::firstOrFail();
        $this->actingAs($admin)->postJson("/admin/chat/{$conversation->id}/baca")->assertOk();
        Event::assertDispatchedTimes(ChatUnreadChanged::class, 2);

        // Sudah 0: membuka lagi tidak menyiarkan ulang.
        $this->actingAs($admin)->postJson("/admin/chat/{$conversation->id}/baca")->assertOk();
        Event::assertDispatchedTimes(ChatUnreadChanged::class, 2);
    }

    public function test_unread_payload_and_admin_channel_authorization(): void
    {
        ChatConversation::create(['guest_token' => 'a', 'subject' => 'x', 'unread_admin' => 4]);
        $event = new ChatUnreadChanged(1);
        $this->assertSame('private-admin.chat', $event->broadcastOn()[0]->name);
        $this->assertSame(4, $event->broadcastWith()['total']);

        $callback = Broadcast::getChannels()->get('admin.chat');
        $this->assertTrue((bool) $callback(User::factory()->admin()->create()));
        $this->assertFalse((bool) $callback(User::factory()->warga()->create()));
    }

    public function test_non_admin_has_no_chat_unread_prop_and_cannot_poll_it(): void
    {
        $warga = User::factory()->warga()->create();

        $this->actingAs($warga)->getJson('/admin/chat/belum-dibaca')->assertStatus(403);
        $this->get('/')->assertInertia(fn (Assert $page) => $page->where('chat_unread', null));
    }

    public function test_chat_has_its_own_rate_limit_separate_from_complaints(): void
    {
        $this->postJson('/chat/mulai', ['nama' => 'Budi'])->assertCreated();

        // Kuota lama (pengaduan) 10/10 menit; chat kini 20/menit per sesi.
        for ($i = 0; $i < 12; $i++) {
            $this->postJson('/chat/pesan', ['body' => "Pesan {$i}"])->assertCreated();
        }
    }
}
