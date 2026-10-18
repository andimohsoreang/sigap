<?php

namespace Tests\Feature\Web;

use App\Enums\UserRole;
use App\Models\Category;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\Region;
use App\Models\User;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Terbitkan tiket dari Kotak Masuk dengan isian yang disarankan. */
class TicketSuggestionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
        config(['services.ai.enabled' => true, 'services.ai.driver' => 'fake']);
    }

    private function conversation(): ChatConversation
    {
        $conversation = ChatConversation::create([
            'guest_token' => fake()->uuid(),
            'guest_name' => 'Siti Aminah',
            'handled_by' => 'petugas',
            'ai_summary' => 'Jalan poros SP3 Bulungan rusak berat sejak Juli. Akses anak ke sekolah terganggu.',
            'contact' => '081234567890',
            'last_message_at' => now(),
        ]);
        ChatMessage::create(['conversation_id' => $conversation->id, 'sender_type' => 'guest', 'body' => 'Jalan poros di SP3 Bulungan rusak parah']);

        return $conversation;
    }

    public function test_suggests_region_category_and_impact_from_conversation(): void
    {
        $conversation = $this->conversation();
        $admin = User::factory()->admin(UserRole::SuperAdmin)->create();

        $this->actingAs($admin)->getJson("/admin/chat/{$conversation->id}/saran-tiket")
            ->assertOk()
            ->assertJsonPath('region_id', Region::query()->where('name', 'SP3 Bulungan')->value('id'))
            ->assertJsonPath('category_id', Category::query()->where('name', 'Infrastruktur Dasar')->value('id'))
            ->assertJsonPath('impact', 'tinggi')
            ->assertJsonPath('judul', 'Jalan poros SP3 Bulungan rusak berat sejak Juli')
            ->assertJsonPath('nama', 'Siti Aminah')
            ->assertJsonPath('telepon', '081234567890');
    }

    public function test_admin_kawasan_suggestion_keeps_own_region(): void
    {
        $conversation = $this->conversation();
        $own = Region::query()->where('name', '!=', 'SP3 Bulungan')->value('id');
        $kawasan = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => $own]);

        $this->actingAs($kawasan)->getJson("/admin/chat/{$conversation->id}/saran-tiket")->assertJsonPath('region_id', $own);
        $this->actingAs($kawasan)->get("/admin/chat?conversation={$conversation->id}")->assertInertia(fn (Assert $page) => $page
            ->where('ticket_options.kawasan_tetap', $own)
            ->has('ticket_options.dampak', 4));
    }

    public function test_unknown_place_is_left_for_staff_to_choose(): void
    {
        $conversation = ChatConversation::create(['guest_token' => fake()->uuid(), 'guest_name' => 'Tamu', 'handled_by' => 'petugas', 'ai_summary' => 'Ada pertanyaan soal bantuan bibit.']);

        $this->actingAs(User::factory()->admin(UserRole::SuperAdmin)->create())
            ->getJson("/admin/chat/{$conversation->id}/saran-tiket")
            ->assertJsonPath('region_id', null)
            ->assertJsonPath('category_id', Category::query()->where('name', 'Bantuan Sosial')->value('id'));
    }

    public function test_warga_cannot_request_suggestions(): void
    {
        $conversation = $this->conversation();

        $this->actingAs(User::factory()->warga()->create())->getJson("/admin/chat/{$conversation->id}/saran-tiket")->assertForbidden();
    }
}
