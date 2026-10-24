<?php

namespace Tests\Feature\Web;

use App\Enums\UserRole;
use App\Models\AccountActivation;
use App\Models\Category;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\Region;
use App\Models\Ticket;
use App\Models\User;
use App\Services\StaffRegistrationService;
use App\Support\Nik;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Petugas mendaftarkan akun warga dari percakapan chat (warga gaptek):
 * tanpa surel, tautan buat kata sandi dikirim ke chat, lalu warga langsung
 * masuk dengan riwayat chat & tiketnya.
 */
class DaftarkanWargaDariChatTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
        $this->admin = User::factory()->admin(UserRole::SuperAdmin)->create();
    }

    /** Tamu memulai chat lewat widget; mengembalikan percakapannya. */
    private function guestChat(string $name = 'Bu Siti'): ChatConversation
    {
        $this->postJson('/chat/mulai', ['nama' => $name])->assertCreated();
        $this->postJson('/chat/pesan', ['body' => 'Sertifikat lahan saya belum keluar'])->assertCreated();

        return ChatConversation::query()->latest('id')->firstOrFail();
    }

    private function payload(array $override = []): array
    {
        return array_merge([
            'nik' => '3273 0101 0190 0055',
            'nama' => 'Siti Aminah',
            'telepon' => '081234567890',
            'email' => '',
            'konfirmasi' => true,
        ], $override);
    }

    /** Token aktivasi seperti yang diterima widget warga. */
    private function activationUrl(): string
    {
        $messages = $this->getJson('/chat/pesan')->assertOk()->json('messages');
        $notice = collect($messages)->last(fn ($m) => $m['jenis'] === 'aktivasi');
        $this->assertNotNull($notice['aktivasi'] ?? null, 'Widget tamu harus menerima tombol buat kata sandi.');

        return $notice['aktivasi']['url'];
    }

    public function test_staff_registers_guest_and_activation_link_reaches_the_chat(): void
    {
        $conversation = $this->guestChat();

        $this->actingAs($this->admin)
            ->post("/admin/chat/{$conversation->id}/akun", $this->payload())
            ->assertSessionHas('success');

        $user = User::findByNik('3273010101900055');
        $this->assertNotNull($user);
        $this->assertSame(UserRole::Warga, $user->role);
        $this->assertSame($this->admin->id, $user->registered_by);
        $this->assertNull($user->email);
        $this->assertTrue($user->awaitingActivation());
        $this->assertSame('Siti Aminah', $conversation->fresh()->guest_name);
        $this->assertDatabaseHas('activity_logs', ['action' => 'account.registered_by_staff']);

        $notice = ChatMessage::query()->where('conversation_id', $conversation->id)->latest('id')->firstOrFail();
        $this->assertSame('aktivasi', $notice->kind());
        // Token di pesan terenkripsi; database aktivasi hanya menyimpan hash.
        $this->assertArrayNotHasKey('url', $notice->meta['aktivasi']);
        $this->assertSame(1, AccountActivation::query()->where('user_id', $user->id)->whereNull('used_at')->count());

        // Panel admin menampilkan status menunggu aktivasi.
        $this->actingAs($this->admin)->get("/admin/chat?conversation={$conversation->id}")
            ->assertInertia(fn (Assert $page) => $page
                ->where('active.akun.status', 'menunggu')
                ->where('active.akun.nama', 'Siti Aminah')
                ->where('active.akun.nik', '3273********0055'));
    }

    public function test_guest_activates_account_and_lands_in_portal_with_chat_history(): void
    {
        $conversation = $this->guestChat();
        $this->actingAs($this->admin)->post("/admin/chat/{$conversation->id}/akun", $this->payload());
        auth()->logout();

        $url = $this->activationUrl();

        $this->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('public/aktivasi-akun')
            ->where('akun.nama', 'Siti Aminah')
            ->where('akun.nik', '3273********0055'));

        $this->post($url, ['password' => 'sertifikat1', 'password_confirmation' => 'sertifikat1'])
            ->assertRedirect('/portal-warga');

        $user = User::findByNik('3273010101900055');
        $this->assertAuthenticatedAs($user);
        $this->assertTrue(Hash::check('sertifikat1', $user->password));
        $this->assertNotNull($user->activated_at);
        // Tanpa surel pun Portal Warga terbuka (identitas dicek petugas).
        $this->get('/portal-warga')->assertOk();
        // Riwayat chat tamu kini milik akun warga.
        $this->assertSame($user->id, $conversation->fresh()->user_id);
        $this->assertDatabaseHas('activity_logs', ['action' => 'account.activated', 'user_id' => $user->id]);

        // Tautan sekali pakai.
        auth()->logout();
        $this->get($url)->assertInertia(fn (Assert $page) => $page->where('token', null)->where('akun', null));
        $this->post($url, ['password' => 'lainlagi22', 'password_confirmation' => 'lainlagi22'])->assertSessionHasErrors('password');

        // Masuk berikutnya cukup NIK + kata sandi.
        $this->post('/masuk', ['identifier' => '3273010101900055', 'password' => 'sertifikat1'])->assertRedirect('/portal-warga');
    }

    public function test_activation_from_another_device_still_adopts_the_origin_conversation(): void
    {
        $conversation = $this->guestChat();
        $this->actingAs($this->admin)->post("/admin/chat/{$conversation->id}/akun", $this->payload());
        auth()->logout();
        $url = $this->activationUrl();

        // Perangkat lain: sesi baru tanpa token chat tamu.
        $this->flushSession();
        $this->post($url, ['password' => 'sertifikat1', 'password_confirmation' => 'sertifikat1'])->assertRedirect('/portal-warga');

        $this->assertSame(User::findByNik('3273010101900055')->id, $conversation->fresh()->user_id);
    }

    public function test_weak_password_and_expired_link_are_rejected(): void
    {
        $conversation = $this->guestChat();
        $this->actingAs($this->admin)->post("/admin/chat/{$conversation->id}/akun", $this->payload());
        auth()->logout();
        $url = $this->activationUrl();

        $this->post($url, ['password' => 'pendek', 'password_confirmation' => 'pendek'])->assertSessionHasErrors('password');

        $this->travel(StaffRegistrationService::VALID_HOURS + 1)->hours();
        $this->get($url)->assertInertia(fn (Assert $page) => $page->where('akun', null));
        $this->post($url, ['password' => 'sertifikat1', 'password_confirmation' => 'sertifikat1'])->assertSessionHasErrors('password');
        $this->assertGuest();

        // Panel admin: kedaluwarsa → kirim tautan baru.
        $this->actingAs($this->admin)->get("/admin/chat?conversation={$conversation->id}")
            ->assertInertia(fn (Assert $page) => $page->where('active.akun.status', 'kedaluwarsa'));
    }

    public function test_resend_invalidates_previous_link(): void
    {
        $conversation = $this->guestChat();
        $this->actingAs($this->admin)->post("/admin/chat/{$conversation->id}/akun", $this->payload());
        auth()->logout();
        $old = $this->activationUrl();

        $this->actingAs($this->admin)->post("/admin/chat/{$conversation->id}/akun/kirim-ulang")->assertSessionHas('success');
        auth()->logout();
        $new = $this->activationUrl();

        $this->assertNotSame($old, $new);
        $this->get($old)->assertInertia(fn (Assert $page) => $page->where('akun', null));
        $this->get($new)->assertInertia(fn (Assert $page) => $page->where('akun.nama', 'Siti Aminah'));
        $this->assertDatabaseHas('activity_logs', ['action' => 'account.activation_resent']);
    }

    public function test_validation_duplicate_nik_and_already_registered(): void
    {
        $conversation = $this->guestChat();
        User::factory()->warga()->create(['nik' => '3273010101900077']);

        $this->actingAs($this->admin)->post("/admin/chat/{$conversation->id}/akun", $this->payload(['nik' => '3273010101900077']))
            ->assertSessionHasErrors('nik');
        $this->actingAs($this->admin)->post("/admin/chat/{$conversation->id}/akun", $this->payload(['konfirmasi' => false, 'nik' => '123']))
            ->assertSessionHasErrors(['nik', 'konfirmasi']);

        $this->actingAs($this->admin)->post("/admin/chat/{$conversation->id}/akun", $this->payload())->assertSessionHas('success');
        $this->actingAs($this->admin)->post("/admin/chat/{$conversation->id}/akun", $this->payload(['nik' => '3273010101900088']))
            ->assertSessionHas('error');

        $this->assertSame(0, User::query()->where('nik_hash', Nik::hash('3273010101900088'))->count());
    }

    public function test_logged_in_warga_conversation_cannot_be_registered_again(): void
    {
        $warga = User::factory()->warga()->create();
        $conversation = ChatConversation::create(['user_id' => $warga->id, 'handled_by' => 'petugas', 'last_message_at' => now()]);

        $this->actingAs($this->admin)->post("/admin/chat/{$conversation->id}/akun", $this->payload())->assertSessionHas('error');
        $this->assertNull(User::findByNik('3273010101900055'));
    }

    public function test_only_staff_can_register(): void
    {
        $conversation = $this->guestChat();
        $warga = User::factory()->warga()->create();

        $this->actingAs($warga)->post("/admin/chat/{$conversation->id}/akun", $this->payload())->assertRedirect();
        $this->assertNull(User::findByNik('3273010101900055'));
    }

    public function test_tickets_from_the_conversation_are_linked_to_the_new_account(): void
    {
        $conversation = $this->guestChat();
        $this->actingAs($this->admin)->post("/admin/chat/{$conversation->id}/akun", $this->payload());

        $this->actingAs($this->admin)->post('/admin/input-manual', [
            'sumber_laporan' => 'live_chat',
            'nama' => 'Siti Aminah',
            'judul' => 'Sertifikat lahan belum terbit',
            'uraian' => 'Warga SP2 menanyakan sertifikat lahan yang belum terbit sejak 2023.',
            'region_id' => Region::query()->value('id'),
            'category_id' => Category::query()->value('id'),
            'impact' => 'sedang',
            'percakapan_id' => $conversation->id,
        ])->assertRedirect();

        $user = User::findByNik('3273010101900055');
        $ticket = Ticket::query()->latest('id')->firstOrFail();
        $this->assertSame($user->id, $ticket->reporter_id);
        $this->assertSame('3273010101900055', $ticket->reporter_nik);
    }

    public function test_ticket_issued_before_registration_is_linked_too(): void
    {
        $conversation = $this->guestChat();
        $ticket = Ticket::factory()->create(['reporter_id' => null]);
        $conversation->forceFill(['ticket_id' => $ticket->id])->save();

        $this->actingAs($this->admin)->post("/admin/chat/{$conversation->id}/akun", $this->payload());

        $this->assertSame(User::findByNik('3273010101900055')->id, $ticket->fresh()->reporter_id);
    }

    public function test_self_registered_warga_still_needs_email_verification(): void
    {
        $warga = User::factory()->warga()->unverified()->create();

        $this->actingAs($warga)->get('/portal-warga')->assertRedirect('/verifikasi-email');
    }
}
