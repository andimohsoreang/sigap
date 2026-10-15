<?php

namespace Tests\Feature\Web;

use App\Enums\UserRole;
use App\Models\Category;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\Region;
use App\Models\Ticket;
use App\Models\User;
use App\Services\ContactCenterStats;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ContactCenterTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
        config(['services.ai.enabled' => true]);
        $this->admin = User::factory()->admin(UserRole::SuperAdmin)->create();
    }

    private function conversation(array $attributes = []): ChatConversation
    {
        return ChatConversation::create($attributes + [
            'guest_token' => fake()->uuid(),
            'guest_name' => 'Siti Aminah',
            'handled_by' => 'ai',
            'last_message_at' => now(),
        ]);
    }

    private function handedOff(array $attributes = []): ChatConversation
    {
        return $this->conversation($attributes + [
            'handled_by' => 'petugas',
            'handoff_at' => now(),
            'handoff_reason' => 'aduan',
            'ai_summary' => 'Jalan poros SP3 Bulungan rusak berat sejak Juli. Akses sekolah terganggu.',
            'reference' => 'REF-261016-ABCD',
            'contact' => '081234567890',
        ]);
    }

    public function test_inbox_defaults_to_waiting_tab_and_counts_each_tab(): void
    {
        $waiting = $this->handedOff();
        $this->conversation();
        $this->conversation(['handled_by' => 'petugas', 'outcome' => 'terjawab_petugas', 'closed_at' => now()]);

        $this->actingAs($this->admin)->get('/admin/chat')->assertInertia(fn (Assert $page) => $page
            ->component('admin/chat')
            ->where('tab', 'menunggu')
            ->has('conversations', 1)
            ->where('conversations.0.id', $waiting->id)
            ->where('conversations.0.alasan', 'Aduan')
            ->where('tab_counts.menunggu', 1)
            ->where('tab_counts.ai', 1)
            ->where('tab_counts.selesai', 1)
            ->where('tab_counts.semua', 3)
            ->where('active.ringkasan', 'Jalan poros SP3 Bulungan rusak berat sejak Juli. Akses sekolah terganggu.')
            ->where('active.kontak', '081234567890')
            ->where('active.referensi', 'REF-261016-ABCD'));
    }

    public function test_taking_over_stops_the_assistant(): void
    {
        $conversation = $this->conversation();

        $this->actingAs($this->admin)->post("/admin/chat/{$conversation->id}/ambil")->assertSessionHas('success');

        $conversation->refresh();
        $this->assertSame('petugas', $conversation->handled_by);
        $this->assertSame('diambil_petugas', $conversation->handoff_reason);
        $this->assertSame($this->admin->id, $conversation->assigned_to);
    }

    public function test_replying_to_an_ai_conversation_takes_it_over(): void
    {
        $conversation = $this->conversation();

        $this->actingAs($this->admin)->post("/admin/chat/{$conversation->id}/balas", ['body' => 'Saya bantu, Bu.']);

        $this->assertSame('petugas', $conversation->fresh()->handled_by);
    }

    public function test_closing_with_lapor_notifies_citizen_and_records_outcome(): void
    {
        $conversation = $this->handedOff();

        $this->actingAs($this->admin)->post("/admin/chat/{$conversation->id}/tutup", ['hasil' => 'asal'])->assertSessionHasErrors('hasil');
        $this->actingAs($this->admin)->post("/admin/chat/{$conversation->id}/tutup", ['hasil' => 'lapor'])->assertSessionHas('success');

        $conversation->refresh();
        $this->assertSame('lapor', $conversation->outcome);
        $this->assertNotNull($conversation->closed_at);
        $this->assertSame(1, $conversation->unread_user);
        $this->assertDatabaseHas('chat_messages', ['conversation_id' => $conversation->id, 'sender_type' => 'system']);
        $this->assertStringContainsString('SP4N-LAPOR!', ChatMessage::query()->latest('id')->value('body'));

        $this->actingAs($this->admin)->post("/admin/chat/{$conversation->id}/tutup", ['hasil' => 'wbs'])->assertSessionHas('error');
    }

    public function test_ticket_from_conversation_is_prefilled_and_sent_back_to_chat(): void
    {
        $conversation = $this->handedOff();
        ChatMessage::create(['conversation_id' => $conversation->id, 'sender_type' => 'guest', 'body' => 'Jalan poros rusak parah']);

        $this->actingAs($this->admin)->get("/admin/input-manual?percakapan={$conversation->id}")
            ->assertInertia(fn (Assert $page) => $page
                ->where('prefill.percakapan_id', $conversation->id)
                ->where('prefill.nama', 'Siti Aminah')
                ->where('prefill.telepon', '081234567890')
                ->where('prefill.judul', 'Jalan poros SP3 Bulungan rusak berat sejak Juli'));

        $this->actingAs($this->admin)->post('/admin/input-manual', [
            'sumber_laporan' => 'live_chat',
            'nama' => 'Siti Aminah',
            'judul' => 'Jalan poros SP3 rusak berat',
            'uraian' => 'Ringkasan asisten: jalan poros rusak berat sejak Juli.',
            'region_id' => Region::query()->value('id'),
            'category_id' => Category::query()->value('id'),
            'impact' => 'tinggi',
            'percakapan_id' => $conversation->id,
        ])->assertRedirect("/admin/chat?conversation={$conversation->id}");

        $ticket = Ticket::query()->latest('id')->firstOrFail();
        $conversation->refresh();
        $this->assertSame('live_chat', $ticket->source);
        $this->assertSame($ticket->id, $conversation->ticket_id);
        $this->assertSame('tiket', $conversation->outcome);

        $notice = ChatMessage::query()->where('conversation_id', $conversation->id)->where('sender_type', 'system')->latest('id')->firstOrFail();
        $this->assertSame('tiket_terbit', $notice->kind());
        $this->assertSame($ticket->ticket_no, $notice->meta['tiket']['nomor']);
    }

    public function test_stats_count_ai_only_resolutions_and_median_wait(): void
    {
        Carbon::setTestNow('2026-10-13 10:00');

        $aiOnly = $this->conversation();
        ChatMessage::create(['conversation_id' => $aiOnly->id, 'sender_type' => 'ai', 'body' => 'Jawaban', 'meta' => ['kind' => 'jawaban']]);

        $handed = $this->handedOff(['handoff_at' => now()->subMinutes(30)]);
        $reply = ChatMessage::create(['conversation_id' => $handed->id, 'sender_type' => 'admin', 'body' => 'Halo', 'sender_id' => $this->admin->id]);
        $reply->forceFill(['created_at' => now()->subMinutes(20)])->save();

        $stats = app(ContactCenterStats::class)->overview();

        $this->assertSame(2, $stats['percakapan']);
        $this->assertSame(50, $stats['selesai_tanpa_petugas']);
        $this->assertSame(10, $stats['tunggu_median_menit']);

        Carbon::setTestNow();
    }

    public function test_sidebar_lists_waiting_conversations_and_thread_shows_citizen_tickets(): void
    {
        $warga = User::factory()->warga()->create();
        $ticket = Ticket::factory()->forReporter($warga)->create();
        $waiting = $this->handedOff(['guest_token' => null, 'guest_name' => null, 'user_id' => $warga->id]);
        $this->conversation(); // masih dijawab AI → tidak masuk daftar tunggu

        $this->actingAs($this->admin)->get("/admin/chat?conversation={$waiting->id}")->assertInertia(fn (Assert $page) => $page
            ->has('chat_waiting', 1)
            ->where('chat_waiting.0.id', $waiting->id)
            ->where('active.riwayat_tiket.0.nomor', $ticket->ticket_no));

        $this->actingAs($warga)->get('/portal-warga')->assertInertia(fn (Assert $page) => $page->where('chat_waiting', null));
    }

    public function test_warga_cannot_use_inbox_actions(): void
    {
        $conversation = $this->conversation();
        $warga = User::factory()->warga()->create();

        $this->actingAs($warga)->post("/admin/chat/{$conversation->id}/tutup", ['hasil' => 'lapor'])->assertRedirect('/portal-warga');
        $this->assertNull($conversation->fresh()->outcome);
    }
}
