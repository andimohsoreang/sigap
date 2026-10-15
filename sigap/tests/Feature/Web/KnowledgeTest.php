<?php

namespace Tests\Feature\Web;

use App\Enums\UserRole;
use App\Models\KnowledgeArticle;
use App\Models\Region;
use App\Models\User;
use App\Services\Knowledge\KnowledgeRetriever;
use Database\Seeders\KnowledgeSeeder;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class KnowledgeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
    }

    private function article(array $attributes = []): KnowledgeArticle
    {
        return KnowledgeArticle::create($attributes + [
            'title' => 'Apa syarat menjadi peserta transmigrasi?',
            'body' => 'Calon peserta mendaftar di dinas kabupaten/kota yang membidangi transmigrasi.',
            'category' => 'Program',
            'source' => 'Pedoman Seleksi',
            'status' => KnowledgeArticle::STATUS_PUBLISHED,
        ]);
    }

    private function payload(array $overrides = []): array
    {
        return $overrides + [
            'title' => 'Bagaimana tahapan sertifikasi lahan?',
            'body' => 'Tahapan sertifikasi lahan transmigran meliputi verifikasi berkas dan pengukuran.',
            'category' => 'Pertanahan',
            'source' => 'Pedoman Trans Tuntas',
            'source_ref' => 'Hal. 4',
            'status' => 'terbit',
            'review_at' => now()->addMonths(6)->toDateString(),
        ];
    }

    public function test_retriever_finds_relevant_published_article_and_ignores_drafts(): void
    {
        $published = $this->article();
        $this->article(['title' => 'Syarat peserta (draf)', 'status' => KnowledgeArticle::STATUS_DRAFT]);
        $this->article(['title' => 'Cara melacak tiket', 'body' => 'Masukkan nomor tiket di menu Lacak.', 'category' => 'Layanan']);

        $found = app(KnowledgeRetriever::class)->search('apa saja syaratnya jadi peserta transmigrasi?');

        $this->assertSame([$published->id], $found->pluck('id')->all());
    }

    public function test_retriever_returns_nothing_for_unrelated_question(): void
    {
        $this->article();

        $this->assertTrue(app(KnowledgeRetriever::class)->search('resep rendang padang')->isEmpty());
    }

    public function test_retriever_matches_word_variants_by_prefix(): void
    {
        $article = $this->article(['title' => 'Tahapan sertifikasi lahan', 'body' => 'Penjelasan tahapan.', 'category' => 'Pertanahan']);

        $this->assertSame([$article->id], app(KnowledgeRetriever::class)->search('sertifikat lahan saya')->pluck('id')->all());
    }

    public function test_super_admin_can_publish_article(): void
    {
        $admin = User::factory()->admin(UserRole::SuperAdmin)->create();

        $this->actingAs($admin)->post('/admin/pengetahuan', $this->payload())->assertSessionHas('success');

        $this->assertDatabaseHas('knowledge_articles', ['title' => 'Bagaimana tahapan sertifikasi lahan?', 'status' => 'terbit', 'created_by' => $admin->id]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'knowledge.created']);
    }

    public function test_admin_kawasan_cannot_publish_directly(): void
    {
        $admin = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => Region::query()->value('id')]);

        $this->actingAs($admin)->post('/admin/pengetahuan', $this->payload());
        $this->assertDatabaseHas('knowledge_articles', ['title' => 'Bagaimana tahapan sertifikasi lahan?', 'status' => 'ditinjau']);

        // Menyunting artikel terbit mengembalikannya ke "ditinjau".
        $article = $this->article();
        $this->actingAs($admin)->put("/admin/pengetahuan/{$article->id}", $this->payload(['title' => 'Judul baru']));
        $this->assertSame('ditinjau', $article->fresh()->status);
    }

    public function test_only_super_admin_can_delete_article(): void
    {
        $article = $this->article();
        $kawasan = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => Region::query()->value('id')]);

        $this->actingAs($kawasan)->delete("/admin/pengetahuan/{$article->id}")->assertForbidden();
        $this->assertModelExists($article);

        $this->actingAs(User::factory()->admin(UserRole::SuperAdmin)->create())->delete("/admin/pengetahuan/{$article->id}");
        $this->assertModelMissing($article);
    }

    public function test_validation_and_access_rules(): void
    {
        $admin = User::factory()->admin(UserRole::SuperAdmin)->create();
        $this->actingAs($admin)->post('/admin/pengetahuan', $this->payload(['body' => 'pendek', 'status' => 'asal']))
            ->assertSessionHasErrors(['body', 'status']);

        $this->actingAs(User::factory()->warga()->create())->get('/admin/pengetahuan')->assertRedirect('/portal-warga');
    }

    public function test_admin_page_lists_articles_and_stats(): void
    {
        $this->article();
        $this->article(['title' => 'Draf', 'status' => KnowledgeArticle::STATUS_DRAFT]);

        $this->actingAs(User::factory()->admin(UserRole::SuperAdmin)->create())
            ->get('/admin/pengetahuan')
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/pengetahuan')
                ->has('articles', 2)
                ->where('stats.terbit', 1)
                ->where('stats.draf', 1)
                ->where('can_publish', true));
    }

    public function test_home_faq_comes_from_published_articles(): void
    {
        $this->article();
        $this->article(['title' => 'Draf tersembunyi', 'status' => KnowledgeArticle::STATUS_DRAFT]);

        $this->get('/')->assertInertia(fn (Assert $page) => $page
            ->has('faqs', 1)
            ->where('faqs.0.question', 'Apa syarat menjadi peserta transmigrasi?'));
    }

    public function test_seeder_only_runs_on_empty_table(): void
    {
        $this->seed(KnowledgeSeeder::class);
        $count = KnowledgeArticle::query()->count();
        $this->assertGreaterThan(5, $count);

        $this->seed(KnowledgeSeeder::class);
        $this->assertSame($count, KnowledgeArticle::query()->count());
    }
}
