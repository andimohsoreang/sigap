<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\KnowledgeArticle;
use App\Models\User;
use Database\Seeders\OfficialKnowledgeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * `sigap:koreksi-artikel-resmi`: koreksi cek fakta 30-10-2026 hanya mengenai
 * artikel "ditinjau" yang isinya masih versi seeder lama, tanpa menerbitkan.
 */
class KoreksiArtikelResmiTest extends TestCase
{
    use RefreshDatabase;

    private const KEWAJIBAN = 'Apa kewajiban transmigran dan apa sanksinya bila dilanggar?';

    /** @return array<string, array{body: string, source: string, source_ref: string, source_url: string}> */
    private function before(): array
    {
        return require database_path('data/koreksi-artikel-2026-10-30.php');
    }

    /** @return array<string, mixed> isi baru menurut OfficialKnowledgeSeeder */
    private function after(string $title): array
    {
        return collect((new OfficialKnowledgeSeeder)->articles())->firstWhere('title', $title);
    }

    private function oldArticle(string $title, array $attributes = []): KnowledgeArticle
    {
        return KnowledgeArticle::create($attributes + ['title' => $title, 'status' => KnowledgeArticle::STATUS_REVIEW] + $this->before()[$title]);
    }

    public function test_correction_data_matches_the_seeder(): void
    {
        $this->assertCount(8, $this->before());

        foreach ($this->before() as $title => $old) {
            $new = $this->after($title);
            $this->assertNotNull($new, $title);
            $this->assertNotSame($old, array_intersect_key($new, $old), "Tidak ada yang dikoreksi: {$title}");
            $this->assertLessThanOrEqual(100, mb_strlen($new['source_ref']), "source_ref maks 100 karakter: {$title}");
        }
        $this->assertStringNotContainsString('PP 3/2014', $this->after('Peraturan apa saja yang menjadi dasar penyelenggaraan transmigrasi?')['body']);
    }

    public function test_updates_untouched_review_articles_without_publishing_and_audits(): void
    {
        foreach (array_keys($this->before()) as $title) {
            $this->oldArticle($title);
        }

        $this->artisan('sigap:koreksi-artikel-resmi', ['--terapkan' => true])
            ->expectsOutputToContain('8 artikel diperbarui, 0 dilewati. Tidak ada artikel yang diterbitkan.')
            ->assertSuccessful();

        foreach (array_keys($this->before()) as $title) {
            $article = KnowledgeArticle::query()->where('title', $title)->sole();
            $this->assertSame(KnowledgeArticle::STATUS_REVIEW, $article->status, $title);
            $this->assertSame(array_intersect_key($this->after($title), array_flip(['body', 'source', 'source_ref', 'source_url'])), $article->only(['body', 'source', 'source_ref', 'source_url']), $title);
        }
        $this->assertSame(8, ActivityLog::query()->where('action', 'knowledge.corrected')->count());
        $log = ActivityLog::query()->where('action', 'knowledge.corrected')->where('subject_id', (string) KnowledgeArticle::query()->where('title', self::KEWAJIBAN)->value('id'))->sole();
        $this->assertContains('body', $log->properties['kolom']);
        $this->assertStringContainsString('dapat dikenai sanksi', $log->properties['sebelum']['body']);

        // Jalan kedua tidak mengubah apa pun.
        $this->artisan('sigap:koreksi-artikel-resmi', ['--terapkan' => true])
            ->expectsOutputToContain('0 artikel diperbarui, 8 dilewati.')
            ->assertSuccessful();
        $this->assertSame(8, ActivityLog::query()->where('action', 'knowledge.corrected')->count());
    }

    public function test_leaves_published_edited_and_staff_touched_articles_alone(): void
    {
        $titles = array_keys($this->before());
        $published = $this->oldArticle($titles[0], ['status' => KnowledgeArticle::STATUS_PUBLISHED]);
        $edited = $this->oldArticle($titles[1], ['body' => 'Disunting petugas.']);
        $touched = $this->oldArticle($titles[2], ['updated_by' => User::factory()->create()->id]);
        $snapshot = fn (KnowledgeArticle $a) => $a->fresh()->only(['body', 'source', 'source_ref', 'source_url', 'status']);
        $expected = [$snapshot($published), $snapshot($edited), $snapshot($touched)];

        $this->artisan('sigap:koreksi-artikel-resmi', ['--terapkan' => true])
            ->expectsOutputToContain('status "terbit", bukan "ditinjau"')
            ->expectsOutputToContain('sudah disunting petugas')
            ->expectsOutputToContain('artikel tidak ada')
            ->expectsOutputToContain('0 artikel diperbarui, 8 dilewati.')
            ->assertSuccessful();

        $this->assertSame($expected, [$snapshot($published), $snapshot($edited), $snapshot($touched)]);
        $this->assertSame(0, ActivityLog::query()->where('action', 'knowledge.corrected')->count());
    }

    public function test_without_apply_only_previews_the_diff(): void
    {
        $article = $this->oldArticle(self::KEWAJIBAN);

        $this->artisan('sigap:koreksi-artikel-resmi')
            ->expectsOutputToContain('- Transmigran yang tidak melaksanakan kewajiban ini dapat dikenai sanksi')
            ->expectsOutputToContain('+ Transmigran yang tidak melaksanakan kewajiban ini dikenakan sanksi')
            ->expectsOutputToContain('1 artikel akan diperbarui (pratinjau; jalankan dengan --terapkan)')
            ->assertSuccessful();

        $this->assertSame($this->before()[self::KEWAJIBAN]['body'], $article->fresh()->body);
        $this->assertSame(0, ActivityLog::query()->where('action', 'knowledge.corrected')->count());
    }
}
