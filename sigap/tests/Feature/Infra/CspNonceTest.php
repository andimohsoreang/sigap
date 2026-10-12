<?php

namespace Tests\Feature\Infra;

use App\Models\User;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * N-01 / N-07: CSP produksi berbasis nonce & connect-src yang persis.
 */
class CspNonceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
    }

    private function asProduction(): void
    {
        $this->app['env'] = 'production';
        $this->assertTrue($this->app->environment('production'));
    }

    private function nonceFrom(TestResponse $response): string
    {
        $csp = (string) $response->headers->get('Content-Security-Policy');
        $this->assertMatchesRegularExpression("/script-src 'self' 'nonce-[A-Za-z0-9+\/=]{20,}'/", $csp);
        preg_match("/'nonce-([^']+)'/", $csp, $m);

        return $m[1];
    }

    /** @return list<string> atribut setiap tag <script> di HTML. */
    private function scriptTags(string $html): array
    {
        preg_match_all('/<script\b([^>]*)>/i', $html, $matches);

        return $matches[1];
    }

    public function test_every_script_tag_carries_the_csp_nonce_in_production(): void
    {
        $this->asProduction();

        foreach (['/', '/lacak', '/pengaduan/baru', '/masuk'] as $url) {
            $response = $this->get($url)->assertOk();
            $nonce = $this->nonceFrom($response);
            $tags = $this->scriptTags((string) $response->getContent());

            $this->assertNotEmpty($tags, "Halaman {$url} harus memuat <script> (Ziggy + Vite).");

            foreach ($tags as $attributes) {
                $this->assertStringContainsString(
                    'nonce="'.$nonce.'"',
                    $attributes,
                    "Tag <script{$attributes}> di {$url} tidak membawa nonce CSP."
                );
            }

            $csp = (string) $response->headers->get('Content-Security-Policy');
            $this->assertStringNotContainsString("'unsafe-inline' 'unsafe-eval'", $csp);
            $this->assertDoesNotMatchRegularExpression("/script-src[^;]*'unsafe-(inline|eval)'/", $csp);
        }
    }

    public function test_nonce_differs_per_request(): void
    {
        $this->asProduction();

        $first = $this->nonceFrom($this->get('/'));
        $second = $this->nonceFrom($this->get('/'));

        $this->assertNotSame($first, $second);
    }

    public function test_connect_src_lists_exact_reverb_origin_without_bare_schemes(): void
    {
        $this->asProduction();
        config()->set('reverb.client', ['host' => 'app1.andimohamad.my.id', 'port' => 443, 'scheme' => 'https']);

        $csp = (string) $this->get('/')->headers->get('Content-Security-Policy');

        $this->assertStringContainsString("connect-src 'self' wss://app1.andimohamad.my.id;", $csp);
        $this->assertDoesNotMatchRegularExpression('/connect-src[^;]*\s(ws|wss):(\s|;)/', $csp);
    }

    public function test_connect_src_in_local_allows_configured_dev_reverb_port(): void
    {
        config()->set('reverb.client', ['host' => 'localhost', 'port' => 8080, 'scheme' => 'http']);

        $csp = (string) $this->get('/')->headers->get('Content-Security-Policy');

        $this->assertStringContainsString('ws://localhost:8080', $csp);
        $this->assertStringContainsString('ws://127.0.0.1:8080', $csp);
        $this->assertDoesNotMatchRegularExpression('/connect-src[^;]*\s(ws|wss):(\s|;)/', $csp);
    }

    public function test_recaptcha_domains_are_allowed_only_when_site_key_is_set(): void
    {
        $this->asProduction();

        $without = (string) $this->get('/')->headers->get('Content-Security-Policy');
        $this->assertStringNotContainsString('google.com/recaptcha', $without);
        $this->assertStringContainsString("frame-src 'none'", $without);

        config()->set('services.recaptcha.site_key', 'site-key-uji');
        $with = (string) $this->get('/pengaduan/baru')->headers->get('Content-Security-Policy');

        $this->assertMatchesRegularExpression('#script-src [^;]*https://www\.google\.com/recaptcha/ https://www\.gstatic\.com/recaptcha/#', $with);
        $this->assertStringContainsString('frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/', $with);
    }

    public function test_recaptcha_site_key_is_shared_with_inertia(): void
    {
        config()->set('services.recaptcha.site_key', 'site-key-uji');

        $this->get('/pengaduan/baru')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('recaptcha.site_key', 'site-key-uji'));

        config()->set('services.recaptcha.site_key', null);

        $this->get('/pengaduan/baru')
            ->assertInertia(fn ($page) => $page->where('recaptcha.site_key', null));
    }

    public function test_ziggy_routes_are_filtered_by_role(): void
    {
        $guest = (string) $this->get('/')->getContent();
        $this->assertStringContainsString('"lacak.show"', $guest);
        $this->assertStringNotContainsString('admin.tiket', $guest);
        $this->assertStringNotContainsString('warga.portal', $guest);
        $this->assertStringNotContainsString('.legacy', $guest);

        $admin = User::factory()->admin()->create(['is_active' => true]);
        $adminHtml = (string) $this->actingAs($admin)->get('/admin/tiket')->assertOk()->getContent();
        $this->assertStringContainsString('"admin.tiket.show"', $adminHtml);
        $this->assertStringNotContainsString('warga.portal', $adminHtml);
    }
}
