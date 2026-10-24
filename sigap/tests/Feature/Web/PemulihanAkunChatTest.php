<?php

namespace Tests\Feature\Web;

use App\Enums\UserRole;
use App\Models\AccountActivation;
use App\Models\ActivityLog;
use App\Models\ChatConversation;
use App\Models\User;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Lupa kata sandi lewat chat: petugas mencocokkan NIK + nomor HP terdaftar,
 * tautan "buat kata sandi baru" dikirim ke chat warga (tanpa surel).
 */
class PemulihanAkunChatTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $warga;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
        $this->admin = User::factory()->admin(UserRole::SuperAdmin)->create();
        $this->warga = User::factory()->warga()->create([
            'nik' => '3273010101900066',
            'name' => 'Pak Yosef',
            'phone' => '081234567890',
            'email' => null,
            'password' => 'lamaSekali1',
        ]);
    }

    private function guestChat(): ChatConversation
    {
        $this->postJson('/chat/mulai', ['nama' => 'Yosef'])->assertCreated();
        $this->postJson('/chat/pesan', ['body' => 'Saya lupa kata sandi dan tidak punya email'])->assertCreated();

        return ChatConversation::query()->latest('id')->firstOrFail();
    }

    private function recover(ChatConversation $conversation, array $override = [])
    {
        $response = $this->actingAs($this->admin)->post("/admin/chat/{$conversation->id}/akun/pulihkan", array_merge([
            'nik' => '3273010101900066',
            'telepon' => '+62 812-3456-7890',
            'konfirmasi' => true,
        ], $override));
        auth()->logout();

        return $response;
    }

    /** @return array{url: string, jenis: string} */
    private function linkInWidget(): array
    {
        $notice = collect($this->getJson('/chat/pesan')->json('messages'))->last(fn ($m) => $m['jenis'] === 'aktivasi');
        $this->assertNotNull($notice['aktivasi'] ?? null);

        return $notice['aktivasi'];
    }

    public function test_matching_phone_sends_recovery_link_and_new_password_works(): void
    {
        $token = $this->warga->createToken('hp-lama')->plainTextToken;
        $conversation = $this->guestChat();

        $this->recover($conversation)->assertSessionHas('success');
        $this->assertDatabaseHas('activity_logs', ['action' => 'account.recovery_sent', 'subject_id' => $this->warga->id]);

        $link = $this->linkInWidget();
        $this->assertSame('pemulihan', $link['jenis']);

        $this->get($link['url'])->assertInertia(fn (Assert $page) => $page
            ->component('public/aktivasi-akun')
            ->where('jenis', 'pemulihan')
            ->where('akun.nama', 'Pak Yosef'));

        $this->post($link['url'], ['password' => 'baruSekali2', 'password_confirmation' => 'baruSekali2'])
            ->assertRedirect('/portal-warga');

        $this->warga->refresh();
        $this->assertAuthenticatedAs($this->warga);
        $this->assertTrue(Hash::check('baruSekali2', $this->warga->password));
        // Token API lama dicabut.
        $this->assertSame(0, $this->warga->tokens()->count(), "Token {$token} seharusnya dicabut.");
        $this->assertSame($this->warga->id, $conversation->fresh()->user_id);
        $this->assertDatabaseHas('activity_logs', ['action' => 'account.password_reset', 'user_id' => $this->warga->id]);

        // Panel admin (sesi petugas sendiri): pemulihan selesai.
        $this->flushSession();
        $this->actingAs($this->admin)->get("/admin/chat?conversation={$conversation->id}")
            ->assertInertia(fn (Assert $page) => $page->where('active.akun.jenis', 'pemulihan')->where('active.akun.status', 'aktif'));

        auth()->logout();
        $this->post('/masuk', ['identifier' => '3273010101900066', 'password' => 'lamaSekali1'])->assertSessionHasErrors();
        $this->post('/masuk', ['identifier' => '3273010101900066', 'password' => 'baruSekali2'])->assertRedirect('/portal-warga');
    }

    public function test_wrong_phone_is_rejected_audited_and_rate_limited(): void
    {
        $conversation = $this->guestChat();

        $this->recover($conversation, ['telepon' => '081299999999'])->assertSessionHasErrors('telepon');
        $this->recover($conversation, ['telepon' => ''])->assertSessionHasErrors('telepon');
        $this->assertSame(0, AccountActivation::query()->count());
        $this->assertSame(1, ActivityLog::query()->where('action', 'account.recovery_failed')->count());

        for ($i = 0; $i < 4; $i++) {
            $this->recover($conversation, ['telepon' => '0812000000'.$i]);
        }

        // Batas tercapai: nomor yang benar pun ditolak sementara.
        $this->recover($conversation)->assertSessionHasErrors(['telepon' => 'Terlalu banyak percobaan yang tidak cocok untuk akun ini. Coba lagi dalam 60 menit.']);
        $this->assertSame(0, AccountActivation::query()->count());
    }

    public function test_account_without_phone_needs_verification_note(): void
    {
        $this->warga->forceFill(['phone' => null])->save();
        $conversation = $this->guestChat();

        $this->recover($conversation, ['telepon' => ''])->assertSessionHasErrors('catatan');

        $this->recover($conversation, ['telepon' => '', 'catatan' => 'Warga datang ke kantor kawasan membawa KTP asli.'])->assertSessionHas('success');
        $log = ActivityLog::query()->where('action', 'account.recovery_sent')->firstOrFail();
        $this->assertSame('Warga datang ke kantor kawasan membawa KTP asli.', $log->properties['catatan']);
    }

    public function test_unknown_inactive_and_staff_accounts_cannot_be_recovered(): void
    {
        $conversation = $this->guestChat();

        $this->recover($conversation, ['nik' => '9999999999999999'])->assertSessionHasErrors('nik');

        $this->warga->forceFill(['is_active' => false])->save();
        $this->recover($conversation)->assertSessionHasErrors('nik');

        $this->assertSame(0, AccountActivation::query()->count());
    }

    public function test_pending_link_blocks_duplicate_and_resend_replaces_it(): void
    {
        $conversation = $this->guestChat();
        $this->recover($conversation)->assertSessionHas('success');
        $old = $this->linkInWidget()['url'];

        $this->recover($conversation)->assertSessionHas('error');

        $this->actingAs($this->admin)->get("/admin/chat?conversation={$conversation->id}")
            ->assertInertia(fn (Assert $page) => $page->where('active.akun.jenis', 'pemulihan')->where('active.akun.status', 'menunggu'));

        $this->actingAs($this->admin)->post("/admin/chat/{$conversation->id}/akun/kirim-ulang")->assertSessionHas('success');
        auth()->logout();
        $new = $this->linkInWidget();

        $this->assertNotSame($old, $new['url']);
        $this->assertSame('pemulihan', $new['jenis']);
        $this->get($old)->assertInertia(fn (Assert $page) => $page->where('akun', null));
    }

    public function test_logged_in_conversation_does_not_need_recovery(): void
    {
        $conversation = ChatConversation::create(['user_id' => $this->warga->id, 'handled_by' => 'petugas', 'last_message_at' => now()]);

        $this->recover($conversation)->assertSessionHas('error');
        $this->assertSame(0, AccountActivation::query()->count());
    }
}
