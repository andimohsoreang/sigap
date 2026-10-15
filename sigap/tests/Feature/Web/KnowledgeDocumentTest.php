<?php

namespace Tests\Feature\Web;

use App\Enums\UserRole;
use App\Models\KnowledgeArticle;
use App\Models\KnowledgeDocument;
use App\Models\Region;
use App\Models\User;
use App\Services\Ai\AiException;
use App\Services\Ai\FakeLlmClient;
use App\Services\Ai\LlmClient;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class KnowledgeDocumentTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
        Storage::fake('local');
        $this->admin = User::factory()->admin(UserRole::SuperAdmin)->create();
    }

    /** PDF teks minimal yang valid (satu baris teks per halaman). */
    private function pdf(array $pages): string
    {
        $objects = [1 => '<< /Type /Catalog /Pages 2 0 R >>'];
        $fontId = 3;
        $objects[$fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
        $kids = [];
        $next = 4;

        foreach ($pages as $text) {
            $escaped = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
            $stream = "BT /F1 11 Tf 50 750 Td ({$escaped}) Tj ET";
            $contentId = $next++;
            $pageId = $next++;
            $objects[$contentId] = '<< /Length '.strlen($stream)." >>\nstream\n{$stream}\nendstream";
            $objects[$pageId] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {$contentId} 0 R /Resources << /Font << /F1 {$fontId} 0 R >> >> >>";
            $kids[] = "{$pageId} 0 R";
        }
        $objects[2] = '<< /Type /Pages /Kids ['.implode(' ', $kids).'] /Count '.count($kids).' >>';
        ksort($objects);

        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $id => $body) {
            $offsets[$id] = strlen($pdf);
            $pdf .= "{$id} 0 obj\n{$body}\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= 'xref'."\n0 ".(count($objects) + 1)."\n0000000000 65535 f \n";
        foreach ($offsets as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }

        return $pdf.'trailer << /Size '.(count($objects) + 1)." /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
    }

    private function upload(array $pages, string $name = 'Pedoman Seleksi.pdf'): KnowledgeDocument
    {
        $this->actingAs($this->admin)
            ->post('/admin/pengetahuan/dokumen', ['dokumen' => UploadedFile::fake()->createWithContent($name, $this->pdf($pages))])
            ->assertRedirect();

        return KnowledgeDocument::query()->latest('id')->firstOrFail()->fresh();
    }

    public function test_uploaded_pdf_is_read_page_by_page_into_proposals(): void
    {
        KnowledgeArticle::create(['title' => 'Syarat pendaftaran calon transmigran', 'body' => 'Isi.', 'status' => 'terbit']);

        $document = $this->upload([
            'Daftar isi dokumen.',
            'Syarat pendaftaran calon transmigran meliputi kepala keluarga berusia produktif dan sehat jasmani.',
            'Proses seleksi berlangsung paling lama 30 hari kerja sejak berkas dinyatakan lengkap.',
        ]);

        $this->assertSame('siap', $document->status);
        $this->assertSame(3, $document->pages);
        $proposals = collect($document->proposals);
        $this->assertCount(2, $proposals, 'Halaman pendek (daftar isi) dilewati.');
        $this->assertSame([2, 3], $proposals->pluck('halaman')->all());
        $this->assertTrue($proposals[1]['cek_angka'], 'Usulan berisi angka ditandai untuk dicek.');
        $this->assertSame('Syarat pendaftaran calon transmigran', $proposals[0]['mirip']['judul'] ?? null);
        Storage::disk('local')->assertExists($document->path);

        $this->get("/admin/pengetahuan/dokumen?dokumen={$document->id}")->assertInertia(fn (Assert $page) => $page
            ->component('admin/pengetahuan-dokumen')
            ->where('selected.status', 'siap')
            ->has('selected.usulan', 2));
    }

    public function test_selected_proposals_become_draft_articles_once(): void
    {
        $document = $this->upload(['Syarat pendaftaran calon transmigran meliputi kepala keluarga berusia produktif.']);

        $payload = ['usulan' => [['id' => 0, 'judul' => 'Apa syarat menjadi transmigran?', 'jawaban' => 'Kepala keluarga berusia produktif dan sehat.', 'kategori' => 'Program']]];

        $this->post("/admin/pengetahuan/dokumen/{$document->id}/simpan", $payload)->assertRedirect('/admin/pengetahuan');
        $this->post("/admin/pengetahuan/dokumen/{$document->id}/simpan", $payload);

        $this->assertSame(1, KnowledgeArticle::query()->count());
        $this->assertDatabaseHas('knowledge_articles', [
            'title' => 'Apa syarat menjadi transmigran?',
            'status' => 'draf',
            'source' => 'Pedoman Seleksi',
            'source_ref' => 'Hal. 1',
            'knowledge_document_id' => $document->id,
        ]);
        $this->assertTrue($document->fresh()->proposals[0]['tersimpan']);
    }

    public function test_scanned_or_broken_pdf_fails_with_clear_message(): void
    {
        $document = $this->upload(['']);

        $this->assertSame('gagal', $document->status);
        $this->assertStringContainsString('hasil pindai', (string) $document->error);
    }

    public function test_ai_failure_marks_document_failed_and_can_be_retried(): void
    {
        $this->app->bind(LlmClient::class, fn () => new class implements LlmClient
        {
            public function complete(array $messages, bool $json = false): string
            {
                throw new AiException('mati');
            }
        });

        $document = $this->upload(['Syarat pendaftaran calon transmigran meliputi kepala keluarga berusia produktif.']);
        $this->assertSame('gagal', $document->status);

        $this->app->bind(LlmClient::class, fn () => new FakeLlmClient);
        $this->post("/admin/pengetahuan/dokumen/{$document->id}/ulang");
        $this->assertSame('siap', $document->fresh()->status);
    }

    public function test_only_pdf_is_accepted_and_only_admins_may_upload(): void
    {
        $this->actingAs($this->admin)
            ->post('/admin/pengetahuan/dokumen', ['dokumen' => UploadedFile::fake()->create('catatan.docx', 10)])
            ->assertSessionHasErrors('dokumen');

        $this->actingAs(User::factory()->warga()->create())
            ->post('/admin/pengetahuan/dokumen', ['dokumen' => UploadedFile::fake()->createWithContent('x.pdf', $this->pdf(['abc']))])
            ->assertRedirect('/portal-warga');

        $this->assertSame(0, KnowledgeDocument::query()->count());
    }

    public function test_pdf_can_be_viewed_and_only_super_admin_deletes(): void
    {
        $document = $this->upload(['Syarat pendaftaran calon transmigran meliputi kepala keluarga berusia produktif.']);

        $this->get("/admin/pengetahuan/dokumen/{$document->id}/berkas")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');

        $kawasan = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => Region::query()->value('id')]);
        $this->actingAs($kawasan)->delete("/admin/pengetahuan/dokumen/{$document->id}")->assertForbidden();

        $this->actingAs($this->admin)->delete("/admin/pengetahuan/dokumen/{$document->id}");
        $this->assertModelMissing($document);
        Storage::disk('local')->assertMissing($document->path);
    }
}
