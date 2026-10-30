<?php

namespace Tests\Feature;

use App\Models\KnowledgeArticle;
use App\Models\Portal;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/** Nama aplikasi "SIGAP" → "Contact Center" pada data yang sudah tersimpan. */
class RenameContactCenterMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_migration_renames_brand_in_articles_and_portals_only(): void
    {
        $article = KnowledgeArticle::create([
            'title' => 'Bagaimana cara membuat pengaduan di SIGAP?',
            'body' => 'Buka SIGAP lalu pilih Buat Pengaduan. Nomor tiket SIGAP berawalan TKT.',
            'category' => 'Layanan SIGAP',
            'source' => 'Panduan Layanan SIGAP',
            'status' => KnowledgeArticle::STATUS_PUBLISHED,
        ]);
        $other = KnowledgeArticle::create(['title' => 'Syarat usia', 'body' => 'Usia 19–53 tahun.', 'status' => KnowledgeArticle::STATUS_PUBLISHED]);
        $portal = Portal::query()->create(['code' => 'contoh', 'name' => 'Contoh', 'url' => 'https://www.transmigrasi.go.id/', 'audience' => Portal::AUDIENCE_PUBLIC, 'purpose' => 'Layanan contoh', 'steps' => "Buka portal.\nKembali ke chat SIGAP bila perlu bantuan."]);

        Cache::put(KnowledgeArticle::CACHE_KEY, ['basi'], 600);

        (require database_path('migrations/2026_10_30_000004_rename_sigap_to_contact_center.php'))->up();

        $article->refresh();
        $this->assertSame('Bagaimana cara membuat pengaduan di Contact Center?', $article->title);
        $this->assertSame('Buka Contact Center lalu pilih Buat Pengaduan. Nomor tiket Contact Center berawalan TKT.', $article->body);
        $this->assertSame(['Layanan Contact Center', 'Panduan Layanan Contact Center'], [$article->category, $article->source]);
        $this->assertSame('Usia 19–53 tahun.', $other->fresh()->body);
        $this->assertFalse(Cache::has(KnowledgeArticle::CACHE_KEY));
        $this->assertSame("Buka portal.\nKembali ke chat Contact Center bila perlu bantuan.", $portal->fresh()->steps);
    }
}
