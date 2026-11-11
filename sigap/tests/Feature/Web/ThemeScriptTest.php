<?php

namespace Tests\Feature\Web;

use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tema gelap & aksesibilitas dipasang sebelum halaman tampil oleh skrip di
 * <head>. Kunci & kelasnya harus sama dengan resources/js/lib/preferences.ts.
 */
class ThemeScriptTest extends TestCase
{
    use RefreshDatabase;

    public function test_head_script_applies_theme_and_accessibility_before_paint_with_csp_nonce(): void
    {
        $this->seed(MasterSeeder::class);
        $this->app['env'] = 'production';

        $response = $this->get('/')->assertOk();
        $html = (string) $response->getContent();
        preg_match("/'nonce-([^']+)'/", (string) $response->headers->get('Content-Security-Policy'), $m);

        $head = strstr($html, '</head>', true);
        $this->assertIsString($head);
        $this->assertMatchesRegularExpression('/<script nonce="'.preg_quote($m[1], '/').'">\s*\(function \(\) \{/', $head);

        $preferences = file_get_contents(resource_path('js/lib/preferences.ts'));
        foreach (["'cc-theme'", "'cc-a11y'", "'a11y-'", "'dark'", "'contrast', 'links', 'dyslexia', 'motion', 'focus', 'gray'"] as $needle) {
            $this->assertStringContainsString($needle, $head, "Skrip awal tidak memuat {$needle}.");
        }
        foreach (["THEME_KEY = 'cc-theme'", "A11Y_KEY = 'cc-a11y'", "'a11y-gray'"] as $needle) {
            $this->assertStringContainsString($needle, $preferences);
        }
        // Huruf disleksia di-host sendiri (@font-face di app.css), tidak dimuat dari CDN.
        $this->assertStringNotContainsString('fonts.bunny.net', $head);
        $this->assertStringNotContainsString('fonts.bunny.net', $preferences);
    }
}
