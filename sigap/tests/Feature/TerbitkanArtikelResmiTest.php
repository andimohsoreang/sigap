<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\KnowledgeArticle;
use Database\Seeders\OfficialKnowledgeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** `sigap:terbitkan-artikel-resmi`: terbit per batch hanya bila isi = seeder terkini. */
class TerbitkanArtikelResmiTest extends TestCase
{
    use RefreshDatabase;

    private const DASAR = 'Keputusan pemilik: cek fakta 30-10-2026';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(OfficialKnowledgeSeeder::class);
    }

    private function total(): int
    {
        return count((new OfficialKnowledgeSeeder)->articles());
    }

    public function test_preview_changes_nothing_and_apply_requires_a_reason(): void
    {
        $this->artisan('sigap:terbitkan-artikel-resmi')
            ->expectsOutputToContain("{$this->total()} artikel akan diterbitkan (pratinjau")
            ->assertSuccessful();
        $this->assertSame(0, KnowledgeArticle::query()->published()->count());

        $this->artisan('sigap:terbitkan-artikel-resmi', ['--terapkan' => true])
            ->expectsOutputToContain('Isi --dasar=')
            ->assertFailed();
        $this->assertSame(0, KnowledgeArticle::query()->published()->count());
    }

    public function test_publishes_review_articles_matching_the_seeder_with_audit(): void
    {
        $this->artisan('sigap:terbitkan-artikel-resmi', ['--terapkan' => true, '--dasar' => self::DASAR])
            ->expectsOutputToContain("{$this->total()} artikel diterbitkan, 0 dilewati.")
            ->assertSuccessful();

        $this->assertSame($this->total(), KnowledgeArticle::query()->published()->count());
        $logs = ActivityLog::query()->where('action', 'knowledge.published')->get();
        $this->assertCount($this->total(), $logs);
        $this->assertStringContainsString('Dasar: '.self::DASAR, $logs->first()->description);

        $this->artisan('sigap:terbitkan-artikel-resmi', ['--terapkan' => true, '--dasar' => self::DASAR])
            ->expectsOutputToContain("0 artikel diterbitkan, {$this->total()} dilewati.")
            ->assertSuccessful();
        $this->assertSame($this->total(), ActivityLog::query()->where('action', 'knowledge.published')->count());
    }

    public function test_skips_edited_draft_and_other_articles(): void
    {
        $titles = array_column((new OfficialKnowledgeSeeder)->articles(), 'title');
        KnowledgeArticle::query()->where('title', $titles[0])->update(['body' => 'Disunting petugas.']);
        KnowledgeArticle::query()->where('title', $titles[1])->update(['status' => KnowledgeArticle::STATUS_DRAFT]);
        KnowledgeArticle::query()->where('title', $titles[2])->update(['keywords' => 'kata kunci lain']);
        KnowledgeArticle::create(['title' => 'Artikel buatan petugas', 'body' => 'Bukan dari seeder resmi.', 'status' => KnowledgeArticle::STATUS_REVIEW]);

        $this->artisan('sigap:terbitkan-artikel-resmi', ['--terapkan' => true, '--dasar' => self::DASAR])
            ->expectsOutputToContain("{$titles[0]} — isi berbeda dari seeder terkini (body)")
            ->expectsOutputToContain("{$titles[1]} — status \"draf\", bukan \"ditinjau\"")
            ->expectsOutputToContain("{$titles[2]} — isi berbeda dari seeder terkini (keywords)")
            ->expectsOutputToContain(($this->total() - 3).' artikel diterbitkan, 3 dilewati.')
            ->assertSuccessful();

        $this->assertSame(KnowledgeArticle::STATUS_REVIEW, KnowledgeArticle::query()->where('title', $titles[0])->value('status'));
        $this->assertSame(KnowledgeArticle::STATUS_DRAFT, KnowledgeArticle::query()->where('title', $titles[1])->value('status'));
        $this->assertSame(KnowledgeArticle::STATUS_REVIEW, KnowledgeArticle::query()->where('title', 'Artikel buatan petugas')->value('status'));
    }
}
