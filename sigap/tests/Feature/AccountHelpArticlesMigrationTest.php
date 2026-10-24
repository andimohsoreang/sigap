<?php

namespace Tests\Feature;

use App\Models\KnowledgeArticle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Jawaban asisten tentang akun ikut diperbarui pada basis pengetahuan yang sudah terisi. */
class AccountHelpArticlesMigrationTest extends TestCase
{
    use RefreshDatabase;

    private function runMigration(): void
    {
        (require database_path('migrations/2026_10_25_000003_update_account_help_articles.php'))->up();
    }

    private function article(string $title, string $body): KnowledgeArticle
    {
        return KnowledgeArticle::create(['title' => $title, 'body' => $body, 'status' => KnowledgeArticle::STATUS_PUBLISHED]);
    }

    public function test_default_text_is_updated_and_recovery_article_added(): void
    {
        $masuk = $this->article('Bagaimana cara masuk sebagai warga?', 'Pilih menu Masuk, lalu gunakan NIK atau nama pengguna dan kata sandi Anda. Hak akses admin hanya diberikan kepada pegawai yang terdaftar.');

        $this->runMigration();
        $this->runMigration(); // aman dijalankan ulang

        $this->assertStringContainsString('Tidak punya email?', $masuk->fresh()->body);
        $this->assertSame(1, KnowledgeArticle::query()->where('title', 'Saya lupa kata sandi dan tidak punya email, bagaimana?')->where('status', KnowledgeArticle::STATUS_PUBLISHED)->count());
    }

    public function test_admin_edited_text_is_kept_and_empty_base_is_left_to_seeder(): void
    {
        $this->runMigration();
        $this->assertSame(0, KnowledgeArticle::query()->count());

        $masuk = $this->article('Bagaimana cara masuk sebagai warga?', 'Teks yang sudah disunting admin.');
        $this->runMigration();

        $this->assertSame('Teks yang sudah disunting admin.', $masuk->fresh()->body);
    }
}
