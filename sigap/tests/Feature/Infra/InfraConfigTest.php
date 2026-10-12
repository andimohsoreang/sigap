<?php

namespace Tests\Feature\Infra;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Symfony\Component\Console\Exception\InvalidOptionException;
use Tests\TestCase;

/**
 * N-03 (proxy tepercaya), N-06 (origin Reverb), D-10 (disk privat),
 * N-15 (Sanctum), S-03 (perintah E2E).
 */
class InfraConfigTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Route::get('/_infra/ip', fn (Request $request) => response()->json([
            'ip' => $request->ip(),
            'secure' => $request->isSecure(),
        ]));
    }

    public function test_forwarded_headers_are_ignored_without_trusted_proxies(): void
    {
        config()->set('trustedproxy.proxies', null);

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.10'])
            ->withHeaders(['X-Forwarded-For' => '1.2.3.4', 'X-Forwarded-Proto' => 'https'])
            ->getJson('/_infra/ip')
            ->assertJson(['ip' => '203.0.113.10', 'secure' => false]);
    }

    public function test_forwarded_headers_from_untrusted_peer_are_ignored(): void
    {
        config()->set('trustedproxy.proxies', ['127.0.0.1']);

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.10'])
            ->withHeaders(['X-Forwarded-For' => '1.2.3.4'])
            ->getJson('/_infra/ip')
            ->assertJson(['ip' => '203.0.113.10']);
    }

    public function test_forwarded_headers_from_trusted_proxy_are_used(): void
    {
        config()->set('trustedproxy.proxies', ['127.0.0.1']);

        $this->withServerVariables(['REMOTE_ADDR' => '127.0.0.1'])
            ->withHeaders(['X-Forwarded-For' => '198.51.100.23', 'X-Forwarded-Proto' => 'https'])
            ->getJson('/_infra/ip')
            ->assertJson(['ip' => '198.51.100.23', 'secure' => true]);
    }

    public function test_trusted_proxy_config_never_accepts_wildcard(): void
    {
        $load = function (string $value): mixed {
            $previous = getenv('TRUSTED_PROXIES');
            putenv("TRUSTED_PROXIES={$value}");
            $_ENV['TRUSTED_PROXIES'] = $_SERVER['TRUSTED_PROXIES'] = $value;

            try {
                return (require config_path('trustedproxy.php'))['proxies'];
            } finally {
                $previous === false ? putenv('TRUSTED_PROXIES') : putenv("TRUSTED_PROXIES={$previous}");
                unset($_ENV['TRUSTED_PROXIES'], $_SERVER['TRUSTED_PROXIES']);
            }
        };

        $this->assertNull($load(''));
        $this->assertNull($load('*'));
        $this->assertSame(['127.0.0.1', '10.0.0.0/8'], $load('127.0.0.1, 10.0.0.0/8, **'));
    }

    public function test_reverb_does_not_allow_every_origin_and_limits_are_enabled(): void
    {
        $app = config('reverb.apps.apps.0');

        $this->assertNotContains('*', $app['allowed_origins']);
        $this->assertNotEmpty($app['allowed_origins']);
        $this->assertTrue($app['rate_limiting']['enabled']);
        $this->assertGreaterThan(0, $app['max_connections']);
    }

    public function test_private_disk_is_not_served_publicly(): void
    {
        $this->assertFalse(config('filesystems.disks.local.serve'));
        $this->assertFalse(Route::has('storage.local'));
    }

    public function test_sanctum_tokens_expire(): void
    {
        $this->assertSame(60 * 24 * 7, config('sanctum.expiration'));
    }

    public function test_e2e_setup_refuses_in_production(): void
    {
        $this->app['env'] = 'production';

        $this->artisan('sigap:e2e-setup')
            ->expectsOutputToContain('APP_ENV harus local atau testing')
            ->assertFailed();
    }

    public function test_e2e_setup_refuses_remote_database_host(): void
    {
        $default = config('database.default');
        config()->set('database.default', 'pgsql');
        config()->set('database.connections.pgsql.host', 'db.produksi.example');

        try {
            $this->artisan('sigap:e2e-setup')
                ->expectsOutputToContain('bukan host lokal')
                ->assertFailed()
                ->run();
        } finally {
            config()->set('database.default', $default);
        }
    }

    public function test_e2e_setup_has_no_force_option(): void
    {
        $this->app['env'] = 'production';

        $this->expectException(InvalidOptionException::class);
        $this->artisan('sigap:e2e-setup', ['--force' => true])->run();
    }
}
