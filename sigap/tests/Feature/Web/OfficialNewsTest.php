<?php

namespace Tests\Feature\Web;

use App\Services\OfficialNews;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class OfficialNewsTest extends TestCase
{
    use RefreshDatabase;

    private const API = 'https://www.transmigrasi.go.id/wp-json/wp/v2/posts*';

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function newsPost(array $overrides = []): array
    {
        return array_replace_recursive([
            'id' => 1,
            'date' => '2026-10-29T13:40:00',
            'link' => 'https://www.transmigrasi.go.id/berita/sapi-prafi/',
            'title' => ['rendered' => 'TEP UNAIR Periksa 1.000 Sapi &#8211; Ketahanan Pangan'],
            'excerpt' => ['rendered' => '<p>Manokwari &#8211; Peternak sapi di Distrik Prafi masih menghadapi keterbatasan layanan [&hellip;]</p>'],
            '_embedded' => ['wp:featuredmedia' => [[
                'source_url' => 'https://www.transmigrasi.go.id/wp-content/uploads/2026/10/sapi.jpeg',
                'media_details' => ['sizes' => ['medium_large' => ['source_url' => 'https://www.transmigrasi.go.id/wp-content/uploads/2026/10/sapi-768x512.jpeg']]],
            ]]],
        ], $overrides);
    }

    public function test_parses_official_posts_into_cards(): void
    {
        Http::fake([self::API => Http::response([$this->newsPost()])]);

        $item = app(OfficialNews::class)->latest()[0];

        $this->assertSame('TEP UNAIR Periksa 1.000 Sapi – Ketahanan Pangan', $item['judul']);
        $this->assertSame('Manokwari', $item['lokasi']);
        $this->assertSame('Peternak sapi di Distrik Prafi masih menghadapi keterbatasan layanan', $item['ringkasan']);
        $this->assertStringEndsWith('sapi-768x512.jpeg', $item['gambar']);
        Http::assertSent(fn ($r) => str_contains($r->url(), 'categories='.OfficialNews::CATEGORY));
    }

    public function test_links_and_images_outside_the_official_site_are_dropped(): void
    {
        Http::fake([self::API => Http::response([
            $this->newsPost(['link' => 'https://contoh-palsu.example/berita']),
            $this->newsPost(['id' => 2, '_embedded' => ['wp:featuredmedia' => [[
                'source_url' => 'https://cdn.example/x.jpg',
                'media_details' => ['sizes' => ['medium_large' => ['source_url' => 'https://cdn.example/x-768.jpg']]],
            ]]]]),
        ])]);

        $items = app(OfficialNews::class)->latest();

        $this->assertCount(1, $items);
        $this->assertNull($items[0]['gambar']);
    }

    public function test_cached_for_an_hour_and_stale_copy_survives_an_outage(): void
    {
        Http::fake([self::API => Http::sequence()->push([$this->newsPost()])->push('error', 500)]);
        $news = app(OfficialNews::class);

        $news->latest();
        $news->latest();
        Http::assertSentCount(1);

        Carbon::setTestNow(now()->addMinutes(61));
        $this->assertCount(1, $news->latest(), 'Berita lama tetap tampil saat situs resmi gagal.');
        Http::assertSentCount(2);

        // Setelah gagal, pengambilan ulang ditunda agar beranda tidak melambat.
        $news->latest();
        Http::assertSentCount(2);
    }

    public function test_outage_without_cache_returns_nothing(): void
    {
        Http::fake([self::API => Http::response('error', 503)]);

        $this->assertSame([], app(OfficialNews::class)->latest());
    }

    public function test_homepage_defers_news_until_requested(): void
    {
        Http::fake([self::API => Http::response([$this->newsPost()])]);
        Cache::flush();

        $this->get('/')->assertInertia(fn (Assert $page) => $page
            ->component('public/beranda-transi')
            ->missing('berita')
            ->where('beritaSemua', OfficialNews::ALL_URL));
        Http::assertNothingSent();

        $version = $this->get('/')->viewData('page')['version'];
        $this->withHeaders([
            'X-Inertia' => 'true',
            'X-Inertia-Version' => (string) $version,
            'X-Inertia-Partial-Component' => 'public/beranda-transi',
            'X-Inertia-Partial-Data' => 'berita',
        ])->get('/')->assertOk()->assertJsonPath('props.berita.0.lokasi', 'Manokwari');
    }
}
