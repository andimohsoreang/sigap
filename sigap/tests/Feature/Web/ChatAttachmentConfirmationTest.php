<?php

namespace Tests\Feature\Web;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Fase 2 chat: lampiran foto/dokumen dan kartu konfirmasi data. */
class ChatAttachmentConfirmationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    private function startGuest(string $name = 'Siti Aminah'): ChatConversation
    {
        $this->postJson('/chat/mulai', ['nama' => $name])->assertCreated();

        return ChatConversation::query()->latest('id')->firstOrFail();
    }

    /** JPEG valid dengan segmen APP1 "Exif" berisi penanda rahasia. */
    private function jpegWithExif(string $marker): UploadedFile
    {
        $img = imagecreatetruecolor(40, 30);
        ob_start();
        imagejpeg($img);
        $jpeg = (string) ob_get_clean();
        $payload = "Exif\0\0".$marker;
        $app1 = "\xFF\xE1".pack('n', strlen($payload) + 2).$payload;
        $path = tempnam(sys_get_temp_dir(), 'exif').'.jpg';
        file_put_contents($path, substr($jpeg, 0, 2).$app1.substr($jpeg, 2));

        return new UploadedFile($path, 'foto_SKPT.jpg', 'image/jpeg', null, true);
    }

    public function test_guest_uploads_photo_metadata_is_stripped_and_only_owner_can_view(): void
    {
        $conversation = $this->startGuest();

        $res = $this->post('/chat/lampiran', ['lampiran' => $this->jpegWithExif('GPS-RAHASIA-123'), 'body' => 'Ini foto SKPT saya'], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('message.lampiran.gambar', true)
            ->assertJsonPath('message.lampiran.nama', 'foto_SKPT.jpg')
            ->assertJsonPath('message.body', 'Ini foto SKPT saya');

        $message = ChatMessage::query()->where('conversation_id', $conversation->id)->where('meta->kind', 'lampiran')->firstOrFail();
        $path = $message->meta['lampiran']['path'];
        $this->assertStringStartsWith("chat/{$conversation->id}/", $path);
        Storage::disk('local')->assertExists($path);
        $this->assertStringNotContainsString('GPS-RAHASIA-123', Storage::disk('local')->get($path));
        $this->assertArrayNotHasKey('path', $res->json('message.lampiran'));

        $this->get($res->json('message.lampiran.url'))
            ->assertOk()
            ->assertHeader('Content-Type', 'image/jpeg')
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        // Tamu lain (sesi baru) tidak bisa membuka lampiran ini.
        $this->flushSession();
        $this->startGuest('Orang Lain');
        $this->get('/chat/lampiran/'.$message->id)->assertNotFound();

        // Petugas bisa lewat rute admin; warga tidak.
        $this->actingAs(User::factory()->admin()->create())->get('/admin/chat/lampiran/'.$message->id)->assertOk();
        $this->actingAs(User::factory()->warga()->create())->get('/admin/chat/lampiran/'.$message->id)->assertRedirect();
    }

    public function test_pdf_is_downloaded_as_attachment(): void
    {
        $this->startGuest();
        $pdf = UploadedFile::fake()->createWithContent('surat.pdf', "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

        $url = $this->post('/chat/lampiran', ['lampiran' => $pdf], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('message.lampiran.gambar', false)
            ->json('message.lampiran.url');

        $this->assertStringContainsString('attachment;', $this->get($url)->assertOk()->headers->get('Content-Disposition'));
    }

    public function test_disguised_or_oversized_files_are_rejected(): void
    {
        $this->startGuest();

        $fake = UploadedFile::fake()->createWithContent('foto.jpg', '<html><script>alert(1)</script></html>');
        $this->post('/chat/lampiran', ['lampiran' => $fake], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('lampiran');

        $big = UploadedFile::fake()->create('besar.pdf', 6000, 'application/pdf');
        $this->post('/chat/lampiran', ['lampiran' => $big], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('lampiran');

        $this->assertSame(0, ChatMessage::query()->where('meta->kind', 'lampiran')->count());
    }

    public function test_attachment_requires_identity(): void
    {
        $this->post('/chat/lampiran', ['lampiran' => UploadedFile::fake()->image('a.jpg')], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'identity_required');
    }

    public function test_ai_mode_tells_guest_that_attachments_need_staff(): void
    {
        config(['services.ai.enabled' => true]);
        $this->startGuest();

        $this->post('/chat/lampiran', ['lampiran' => UploadedFile::fake()->image('a.jpg')], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('balasan.0.jenis', 'lampiran_ai');
    }

    public function test_staff_confirmation_card_flow_marks_data_verified(): void
    {
        $conversation = $this->startGuest();
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->post("/admin/chat/{$conversation->id}/konfirmasi-data", [
            'nama' => 'Ahmad Sujarwo',
            'nik' => '7324010101900012',
            'lokasi' => 'UPT Mahalona SP2, Luwu Timur',
            'kategori' => 'Pertanahan · Sertifikat',
        ])->assertSessionHas('success');
        auth()->logout();

        $card = ChatMessage::query()->where('meta->kind', 'konfirmasi_data')->firstOrFail();
        $this->assertStringNotContainsString('7324010101900012', json_encode($card->meta).$card->body);
        $this->assertSame('7324 •••• •••• 0012', collect($card->meta['data'])->firstWhere('label', 'NIK')['nilai']);

        $state = $this->getJson('/chat/pesan')->assertOk();
        $this->assertSame('menunggu', collect($state->json('messages'))->firstWhere('id', $card->id)['konfirmasi']['status']);
        $state->assertJsonPath('panel.konfirmasi', 'menunggu');

        $this->postJson("/chat/konfirmasi/{$card->id}", ['jawaban' => 'benar'])
            ->assertOk()
            ->assertJsonPath('kartu.konfirmasi.status', 'benar')
            ->assertJsonPath('message.body', 'Data sudah benar.')
            ->assertJsonPath('panel.konfirmasi', 'benar');
        $this->assertNotNull($conversation->fresh()->data_verified_at);

        $this->postJson("/chat/konfirmasi/{$card->id}", ['jawaban' => 'ubah'])->assertStatus(422);
    }

    public function test_guest_can_request_correction(): void
    {
        $conversation = $this->startGuest();
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->post("/admin/chat/{$conversation->id}/konfirmasi-data", ['nama' => 'Ahmad', 'lokasi' => 'SP2']);
        auth()->logout();
        $card = ChatMessage::query()->where('meta->kind', 'konfirmasi_data')->firstOrFail();

        $this->postJson("/chat/konfirmasi/{$card->id}", ['jawaban' => 'ubah', 'koreksi' => 'Lokasi yang benar SP3'])
            ->assertOk()
            ->assertJsonPath('kartu.konfirmasi.status', 'ubah')
            ->assertJsonPath('message.body', 'Data perlu diubah: Lokasi yang benar SP3');
        $this->assertNull($conversation->fresh()->data_verified_at);
    }

    public function test_other_guest_cannot_answer_card(): void
    {
        $conversation = $this->startGuest();
        $this->actingAs(User::factory()->admin()->create())->post("/admin/chat/{$conversation->id}/konfirmasi-data", ['nama' => 'Ahmad']);
        auth()->logout();
        $card = ChatMessage::query()->where('meta->kind', 'konfirmasi_data')->firstOrFail();

        $this->flushSession();
        $this->startGuest('Penyusup');
        $this->postJson("/chat/konfirmasi/{$card->id}", ['jawaban' => 'benar'])->assertNotFound();
    }

    public function test_pruning_guest_conversation_deletes_its_files(): void
    {
        $conversation = $this->startGuest();
        $this->post('/chat/lampiran', ['lampiran' => UploadedFile::fake()->image('a.jpg')], ['Accept' => 'application/json'])->assertCreated();
        $this->assertNotEmpty(Storage::disk('local')->files('chat/'.$conversation->id));

        $conversation->forceFill(['last_message_at' => now()->subDays(200)])->saveQuietly();
        $this->artisan('model:prune', ['--model' => [ChatConversation::class]])->assertSuccessful();

        $this->assertEmpty(Storage::disk('local')->files('chat/'.$conversation->id));
    }
}
