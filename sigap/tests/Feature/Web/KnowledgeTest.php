<?php

namespace Tests\Feature\Web;

use App\Enums\UserRole;
use App\Models\KnowledgeArticle;
use App\Models\Region;
use App\Models\User;
use App\Services\Knowledge\KnowledgeRetriever;
use Database\Seeders\KnowledgeSeeder;
use Database\Seeders\MasterSeeder;
use Database\Seeders\OfficialKnowledgeSeeder;
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

        $this->get('/beranda-lama')->assertInertia(fn (Assert $page) => $page
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

    public function test_super_admin_publishes_reviewed_article_in_one_click(): void
    {
        $article = $this->article(['status' => KnowledgeArticle::STATUS_REVIEW]);
        $kawasan = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => Region::query()->value('id')]);

        $this->actingAs($kawasan)->post("/admin/pengetahuan/{$article->id}/terbitkan")->assertForbidden();
        $this->assertSame('ditinjau', $article->fresh()->status);

        $this->actingAs(User::factory()->admin(UserRole::SuperAdmin)->create())
            ->post("/admin/pengetahuan/{$article->id}/terbitkan")
            ->assertSessionHas('success');
        $this->assertSame('terbit', $article->fresh()->status);
        $this->assertDatabaseHas('activity_logs', ['action' => 'knowledge.published']);
    }

    public function test_search_probe_shows_which_articles_feed_the_assistant(): void
    {
        $article = $this->article();
        $this->article(['title' => 'Draf syarat', 'status' => KnowledgeArticle::STATUS_DRAFT]);

        $this->actingAs(User::factory()->admin(UserRole::SuperAdmin)->create())
            ->get('/admin/pengetahuan?uji='.urlencode('syarat ikut transmigrasi apa?'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('probe.question', 'syarat ikut transmigrasi apa?')
                ->has('probe.results', 1)
                ->where('probe.results.0.id', $article->id));
    }

    public function test_keywords_and_source_url_are_saved_and_validated(): void
    {
        $admin = User::factory()->admin(UserRole::SuperAdmin)->create();

        $this->actingAs($admin)->post('/admin/pengetahuan', $this->payload(['source_url' => 'bukan tautan']))
            ->assertSessionHasErrors('source_url');

        $this->actingAs($admin)->post('/admin/pengetahuan', $this->payload([
            'keywords' => 'SHM, sertipikat',
            'source_url' => 'https://jdih.transmigrasi.go.id/web/regulations/read/725',
        ]))->assertSessionHas('success');

        $this->assertDatabaseHas('knowledge_articles', [
            'keywords' => 'SHM, sertipikat',
            'source_url' => 'https://jdih.transmigrasi.go.id/web/regulations/read/725',
        ]);
    }

    public function test_official_seeder_adds_articles_for_review_without_overwriting_edits(): void
    {
        $this->seed(OfficialKnowledgeSeeder::class);
        $count = KnowledgeArticle::query()->count();

        $this->assertGreaterThan(20, $count);
        $this->assertSame($count, KnowledgeArticle::query()->where('status', KnowledgeArticle::STATUS_REVIEW)->count());
        $this->assertSame(0, KnowledgeArticle::query()->whereNull('source_url')->count());

        $edited = KnowledgeArticle::query()->first();
        $edited->update(['body' => 'Sudah disunting petugas.', 'status' => KnowledgeArticle::STATUS_PUBLISHED]);

        $this->seed(OfficialKnowledgeSeeder::class);
        $this->assertSame($count, KnowledgeArticle::query()->count());
        $this->assertSame('Sudah disunting petugas.', $edited->fresh()->body);
    }

    public function test_sequential_review_walks_through_articles_one_by_one(): void
    {
        $first = $this->article(['title' => 'Artikel A', 'status' => KnowledgeArticle::STATUS_REVIEW]);
        $second = $this->article(['title' => 'Artikel B', 'status' => KnowledgeArticle::STATUS_REVIEW]);
        $this->article(['title' => 'Sudah terbit']);
        $admin = User::factory()->admin(UserRole::SuperAdmin)->create();

        $this->actingAs($admin)->get('/admin/pengetahuan/tinjau')->assertInertia(fn (Assert $page) => $page
            ->component('admin/pengetahuan-tinjau')
            ->where('article.id', $first->id)
            ->where('remaining', 2));

        // Lewati → artikel berikutnya.
        $this->actingAs($admin)->get('/admin/pengetahuan/tinjau?lewati='.$first->id)->assertInertia(fn (Assert $page) => $page
            ->where('article.id', $second->id)
            ->where('skipped', [$first->id]));

        $this->actingAs($admin)->post("/admin/pengetahuan/{$second->id}/kembalikan", ['catatan' => 'Angka belum cocok'])->assertSessionHas('success');
        $this->assertSame(KnowledgeArticle::STATUS_DRAFT, $second->fresh()->status);
        $this->assertDatabaseHas('activity_logs', ['action' => 'knowledge.rejected']);

        $this->actingAs($admin)->post("/admin/pengetahuan/{$first->id}/terbitkan")->assertSessionHas('success');
        $this->actingAs($admin)->get('/admin/pengetahuan/tinjau')->assertInertia(fn (Assert $page) => $page
            ->where('article', null)
            ->where('remaining', 0));
    }

    public function test_only_super_admin_can_review(): void
    {
        $article = $this->article(['status' => KnowledgeArticle::STATUS_REVIEW]);
        $kawasan = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => Region::query()->value('id')]);

        $this->actingAs($kawasan)->get('/admin/pengetahuan/tinjau')->assertForbidden();
        $this->actingAs($kawasan)->post("/admin/pengetahuan/{$article->id}/kembalikan")->assertForbidden();
    }
}
