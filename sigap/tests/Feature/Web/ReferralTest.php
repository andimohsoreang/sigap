<?php

namespace Tests\Feature\Web;

use App\Enums\UserRole;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\Portal;
use App\Models\Referral;
use App\Models\ReferralEvent;
use App\Models\Region;
use App\Models\User;
use App\Services\PortalDirectory;
use App\Services\ReferralService;
use Database\Seeders\MasterSeeder;
use Database\Seeders\PortalSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Contact center sebagai gerbang portal: rujukan aduan lahan ke Trans
 * Tuntas dengan pengantar, dan penanggung jawab sampai warga berhasil.
 */
class ReferralTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([MasterSeeder::class, PortalSeeder::class]);
        config(['services.ai.enabled' => true, 'services.ai.driver' => 'fake']);
        // Selasa 10.00 WIB = jam layanan.
        Carbon::setTestNow(Carbon::parse('2026-10-13 10:00', 'Asia/Jakarta'));
        $this->admin = User::factory()->admin(UserRole::SuperAdmin)->create(['name' => 'Budi Santoso']);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function startGuest(): ChatConversation
    {
        $this->postJson('/chat/mulai', ['nama' => 'Siti Aminah'])->assertCreated();

        return ChatConversation::query()->latest('id')->firstOrFail();
    }

    private function referLandComplaint(): Referral
    {
        $this->startGuest();
        $this->postJson('/chat/pesan', ['body' => 'Lahan saya diserobot orang, sengketa batas lahan di SP2'])->assertCreated();

        return Referral::query()->latest('id')->firstOrFail();
    }

    public function test_land_complaint_is_referred_to_trans_tuntas_with_introduction_and_owner(): void
    {
        $conversation = $this->startGuest();

        $this->postJson('/chat/pesan', ['body' => 'Lahan saya diserobot orang, sengketa batas lahan di SP2'])
            ->assertCreated()
            ->assertJsonPath('balasan.0.sender_type', 'ai')
            ->assertJsonPath('balasan.0.jenis', 'rujukan')
            ->assertJsonPath('balasan.0.portal.kode', 'trans-tuntas')
            ->assertJsonPath('balasan.0.portal.domain', 'tuntas-trans.transmigrasi.go.id')
            ->assertJsonPath('balasan.0.rujukan.pendamping', 'Budi');

        $referral = Referral::query()->firstOrFail();
        $this->assertSame('trans-tuntas', $referral->portal->code);
        $this->assertSame($this->admin->id, $referral->assigned_to);
        $this->assertSame(Referral::STATUS_REFERRED, $referral->status);
        $this->assertSame('Siti Aminah', $referral->citizen_name);
        $this->assertTrue($referral->follow_up_due_at->equalTo(now()->addWeekdays(2)));
        $this->assertSame(['dibuat', 'ditugaskan'], $referral->events->pluck('type')->all());

        // Tidak masuk antrean petugas: warga didampingi lewat rujukan.
        $this->assertSame('ai', $conversation->fresh()->handled_by);
    }

    public function test_internal_portals_are_never_offered_and_invented_codes_are_ignored(): void
    {
        $codes = collect(app(PortalDirectory::class)->forAssistant('absen rapat'))->pluck('kode');

        $this->assertContains('trans-tuntas', $codes);
        $this->assertNotContains('tc-more', $codes);
        $this->assertNotContains('transcloud', $codes);
        $this->assertNull(app(PortalDirectory::class)->find('tc-more'));
        $this->assertNull(app(PortalDirectory::class)->find('portal-karangan'));
    }

    public function test_unreachable_portal_falls_back_to_staff(): void
    {
        Portal::query()->where('code', 'trans-tuntas')->update(['is_reachable' => false]);
        $conversation = $this->startGuest();

        $this->postJson('/chat/pesan', ['body' => 'Lahan saya diserobot orang, sengketa batas lahan'])->assertCreated();

        $this->assertSame(0, Referral::query()->count());
        $conversation->refresh();
        $this->assertSame('petugas', $conversation->handled_by);
        $this->assertSame('portal_gangguan', $conversation->handoff_reason);
    }

    public function test_introduction_page_is_private_and_not_indexed(): void
    {
        $referral = $this->referLandComplaint();

        $this->get('/rujukan/'.$referral->token)
            ->assertOk()
            ->assertHeader('X-Robots-Tag', 'noindex, nofollow')
            ->assertHeader('Referrer-Policy', 'same-origin')
            ->assertInertia(fn (Assert $page) => $page
                ->component('public/rujukan')
                ->where('portal.nama', 'Trans Tuntas')
                ->where('portal.bukti', 'Kode tracking')
                ->where('portal.url', 'https://tuntas-trans.transmigrasi.go.id/dashboard/public/lapor/')
                ->where('rujukan.kode', $referral->code)
                ->where('rujukan.pendamping', 'Budi')
                ->has('portal.langkah', 7));

        $this->get('/rujukan/'.str_repeat('a', 48))->assertNotFound();
        $this->get('/rujukan/pendek')->assertNotFound();
    }

    public function test_citizen_opens_portal_then_submits_tracking_code(): void
    {
        $referral = $this->referLandComplaint();

        $this->postJson('/rujukan/'.$referral->token.'/buka')
            ->assertOk()
            ->assertJsonPath('url', 'https://tuntas-trans.transmigrasi.go.id/dashboard/public/lapor/');
        $this->assertSame(Referral::STATUS_OPENED, $referral->fresh()->status);

        $this->post('/rujukan/'.$referral->token.'/berhasil', ['bukti' => '<script>'])->assertSessionHasErrors('bukti');
        $this->post('/rujukan/'.$referral->token.'/berhasil', ['bukti' => 'tt-2026-00123'])
            ->assertRedirect('/rujukan/'.$referral->token)
            ->assertSessionHas('success');

        $referral->refresh();
        $this->assertSame(Referral::STATUS_DONE, $referral->status);
        $this->assertSame('TT-2026-00123', $referral->external_ref);
        $this->assertNotNull($referral->closed_at);
        $this->assertSame(['dibuat', 'ditugaskan', 'dibuka', 'berhasil'], $referral->events()->pluck('type')->all());
        $this->assertStringContainsString('TT-2026-00123', (string) ChatMessage::query()->latest('id')->value('body'));

        // Rujukan yang sudah selesai tidak dapat diubah lagi.
        $this->post('/rujukan/'.$referral->token.'/berhasil', ['bukti' => 'LAIN-1'])->assertSessionHas('error');
        $this->assertSame('TT-2026-00123', $referral->fresh()->external_ref);
    }

    public function test_help_request_puts_conversation_with_the_owner(): void
    {
        $referral = $this->referLandComplaint();

        $this->post('/rujukan/'.$referral->token.'/bantuan', ['pesan' => 'Saya tidak punya KTP-el', 'kontak' => '081234567890'])
            ->assertSessionHas('success');

        $referral->refresh();
        $this->assertSame(Referral::STATUS_HELP, $referral->status);
        $this->assertSame('081234567890', $referral->contact);
        $this->assertTrue($referral->needsAction());

        $conversation = $referral->conversation;
        $this->assertSame('petugas', $conversation->handled_by);
        $this->assertSame($this->admin->id, $conversation->assigned_to);
        $this->assertSame('rujukan', $conversation->handoff_reason);

        $this->actingAs($this->admin)->get('/admin/rujukan')->assertInertia(fn (Assert $page) => $page
            ->component('admin/rujukan')
            ->where('tab', 'perlu_tindakan')
            ->has('referrals', 1)
            ->where('active.kode', $referral->code)
            ->where('active.kontak', '081234567890')
            ->where('rujukan_perlu', 1));
    }

    public function test_overdue_referral_needs_action_and_owner_is_reminded_once_a_day(): void
    {
        $referral = $this->referLandComplaint();
        $this->assertFalse($referral->needsAction());

        Carbon::setTestNow(now()->addWeekdays(2)->addMinute());
        $this->assertTrue($referral->fresh()->needsAction());

        $this->artisan('sigap:pantau-rujukan')->expectsOutput('1 rujukan perlu tindak lanjut.')->assertSuccessful();
        $this->artisan('sigap:pantau-rujukan')->expectsOutput('0 rujukan perlu tindak lanjut.')->assertSuccessful();
        $this->assertSame(1, ReferralEvent::query()->where('type', 'pengingat')->count());

        // Catatan tindak lanjut memperpanjang batas 2 hari kerja.
        $this->actingAs($this->admin)->post("/admin/rujukan/{$referral->code}/catatan", ['catatan' => 'Sudah ditelepon, warga menyiapkan KTP'])
            ->assertSessionHas('success');
        $this->assertFalse($referral->fresh()->needsAction());
    }

    public function test_only_owner_or_super_admin_can_close_confirm_or_reassign(): void
    {
        $referral = $this->referLandComplaint();
        $regionId = Region::query()->value('id');
        $other = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => $regionId]);
        $colleague = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => $regionId]);

        $this->actingAs($other)->post("/admin/rujukan/{$referral->code}/tutup", ['alasan' => 'Warga tidak dapat dihubungi'])->assertForbidden();
        $this->actingAs($other)->post("/admin/rujukan/{$referral->code}/berhasil", ['bukti' => 'TT-1'])->assertForbidden();
        // Catatan boleh oleh siapa pun (membantu rekan).
        $this->actingAs($other)->post("/admin/rujukan/{$referral->code}/catatan", ['catatan' => 'Membantu menghubungi'])->assertSessionHas('success');

        $this->actingAs($this->admin)->post("/admin/rujukan/{$referral->code}/alihkan", ['admin_id' => $colleague->id])->assertSessionHas('success');
        $this->assertSame($colleague->id, $referral->fresh()->assigned_to);

        $this->actingAs($colleague)->post("/admin/rujukan/{$referral->code}/tutup", ['alasan' => 'pendek'])->assertSessionHasErrors('alasan');
        $this->actingAs($colleague)->post("/admin/rujukan/{$referral->code}/tutup", ['alasan' => 'Warga tidak dapat dihubungi 3 kali'])->assertSessionHas('success');
        $this->assertSame(Referral::STATUS_FAILED, $referral->fresh()->status);

        // Tampilan "saya": kolega tidak lagi punya rujukan terbuka.
        $this->actingAs($colleague)->get('/admin/rujukan?tab=semua')->assertInertia(fn (Assert $page) => $page
            ->where('milik', 'saya')
            ->has('referrals', 1)
            ->where('kpi.aktif', 0));

        $this->actingAs(User::factory()->warga()->create())->get('/admin/rujukan')->assertRedirect('/portal-warga');
    }

    public function test_staff_refers_from_inbox_and_becomes_owner(): void
    {
        $conversation = $this->startGuest();
        $petugas = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => Region::query()->value('id'), 'name' => 'Rina Wulandari']);

        $this->actingAs($petugas)->post("/admin/chat/{$conversation->id}/rujuk", ['portal' => 'tc-more'])->assertSessionHasErrors('portal');
        $this->actingAs($petugas)->post("/admin/chat/{$conversation->id}/rujuk", ['portal' => 'trans-tuntas'])->assertSessionHas('success');

        $referral = Referral::query()->firstOrFail();
        $this->assertSame($petugas->id, $referral->assigned_to);
        $this->assertSame($petugas->id, $referral->created_by);

        $conversation->refresh();
        $this->assertSame('rujuk_portal', $conversation->outcome);
        $notice = ChatMessage::query()->where('conversation_id', $conversation->id)->where('sender_type', 'system')->latest('id')->firstOrFail();
        $this->assertSame('rujukan', $notice->kind());
        $this->assertSame('trans-tuntas', $notice->meta['portal']['kode']);
        $this->assertSame('Rina', $notice->meta['rujukan']['pendamping']);
    }

    public function test_ai_assigns_least_loaded_admin(): void
    {
        $second = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => Region::query()->value('id')]);

        $first = $this->referLandComplaint();
        $this->flushSession();
        $next = $this->referLandComplaint();

        $this->assertSame($this->admin->id, $first->assigned_to);
        $this->assertSame($second->id, $next->assigned_to);
    }

    public function test_portal_catalog_is_managed_by_super_admin_and_checked(): void
    {
        $portal = Portal::query()->where('code', 'sipukat')->firstOrFail();
        $kawasan = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => Region::query()->value('id')]);
        $payload = ['code' => 'sipukat', 'name' => 'SIPUKAT', 'url' => 'https://sipukat.transmigrasi.go.id/', 'audience' => 'internal', 'purpose' => 'Peta kawasan', 'track_completion' => true, 'is_active' => true];

        $this->actingAs($kawasan)->get('/admin/portal')->assertInertia(fn (Assert $page) => $page->component('admin/portal')->where('can_edit', false));
        $this->actingAs($kawasan)->put("/admin/portal/{$portal->id}", $payload)->assertForbidden();

        $this->actingAs($this->admin)->put("/admin/portal/{$portal->id}", $payload)->assertSessionHas('success');
        $portal->refresh();
        $this->assertSame('internal', $portal->audience);
        $this->assertFalse($portal->track_completion);

        Http::fake(['sipukat.transmigrasi.go.id/*' => Http::response('', 503)]);
        $this->actingAs($kawasan)->post("/admin/portal/{$portal->id}/cek")->assertSessionHas('error');
        $this->assertFalse($portal->fresh()->is_reachable);
        $this->assertSame(503, $portal->fresh()->last_status);
    }

    public function test_citizen_can_reply_tracking_code_in_chat(): void
    {
        $referral = $this->referLandComplaint();

        $this->postJson('/chat/pesan', ['body' => 'kodenya tt-2026-00777'])
            ->assertCreated()
            ->assertJsonCount(1, 'balasan')
            ->assertJsonPath('balasan.0.sender_type', 'system')
            ->assertJsonPath('balasan.0.referensi', $referral->code);

        $referral->refresh();
        $this->assertSame(Referral::STATUS_DONE, $referral->status);
        $this->assertSame('TT-2026-00777', $referral->external_ref);
        $this->assertSame('warga', $referral->events()->reorder('id', 'desc')->value('actor'));
    }

    public function test_code_detection_ignores_sentences_phones_and_tickets(): void
    {
        $service = app(ReferralService::class);

        $this->assertSame('TT-2026-00123', $service->extractCode('TT-2026-00123'));
        $this->assertSame('ABC123', $service->extractCode('ini kodenya abc123'));
        $this->assertSame('TT/26/0099', $service->extractCode('Sudah berhasil, kode tracking TT/26/0099'));
        $this->assertNull($service->extractCode('jalan di SP3 rusak sejak tahun 2024, mohon dibantu segera ya pak'));
        $this->assertNull($service->extractCode('081234567890'));
        $this->assertNull($service->extractCode('TKT-261012-7KQ4MZ'));
        $this->assertNull($service->extractCode('terima kasih'));
    }

    public function test_follow_up_message_about_same_problem_goes_to_owner_not_new_referral(): void
    {
        $referral = $this->referLandComplaint();

        $this->postJson('/chat/pesan', ['body' => 'Formulir lahan Trans Tuntas error terus, sengketa lahan saya belum bisa dilaporkan'])->assertCreated();

        $this->assertSame(1, Referral::query()->count());
        $this->assertSame(Referral::STATUS_HELP, $referral->fresh()->status);
    }

    public function test_citizen_is_reminded_in_chat_once_after_a_day(): void
    {
        $referral = $this->referLandComplaint();

        $this->artisan('sigap:pantau-rujukan')->expectsOutput('0 warga diingatkan lewat chat.')->assertSuccessful();

        Carbon::setTestNow(now()->addHours(21));
        $this->artisan('sigap:pantau-rujukan')->expectsOutput('1 warga diingatkan lewat chat.')->assertSuccessful();
        $this->artisan('sigap:pantau-rujukan')->expectsOutput('0 warga diingatkan lewat chat.')->assertSuccessful();

        $reminder = ChatMessage::query()->where('conversation_id', $referral->conversation_id)->latest('id')->firstOrFail();
        $this->assertSame('minta_bukti', $reminder->kind());
        $this->assertStringContainsString('kode tracking', $reminder->body);
        $this->assertSame(1, ReferralEvent::query()->where('type', 'pengingat_warga')->count());
    }
}
