<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Portal;
use Database\Seeders\PortalSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Katalog portal = petunjuk arah, bukan sumber fakta aturan (PRD-AI FR-AI-12),
 * dan `sigap:koreksi-portal` hanya mengubah portal yang belum disunting.
 */
class KoreksiPortalTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string, array<string, string>> */
    private function before(): array
    {
        return require database_path('data/koreksi-portal-2026-10-30.php');
    }

    /** Portal produksi lama: seeder terkini dengan kolom yang dikoreksi versi lama. */
    private function seedOldCatalog(): void
    {
        foreach ((new PortalSeeder)->portals() as $i => $portal) {
            Portal::query()->create(($this->before()[$portal['code']] ?? []) + $portal + ['sort' => $i + 1]);
        }
    }

    public function test_seeded_portal_purpose_and_description_carry_no_numbers(): void
    {
        foreach ((new PortalSeeder)->portals() as $portal) {
            foreach (['purpose', 'description'] as $field) {
                $this->assertDoesNotMatchRegularExpression('/\d/u', (string) ($portal[$field] ?? ''), "{$portal['code']}.{$field}: katalog portal bukan sumber fakta aturan");
            }
        }
    }

    public function test_correction_updates_only_untouched_portals_and_audits(): void
    {
        $this->seedOldCatalog();
        $edited = Portal::query()->where('code', 'ppid')->sole();
        $edited->update(['description' => 'Disunting Super Admin.']);

        $this->artisan('sigap:koreksi-portal')
            ->expectsOutputToContain('2 portal akan diperbarui (pratinjau')
            ->assertSuccessful();
        $this->assertStringContainsString('19–49', Portal::query()->where('code', 'persyaratan-transmigrasi')->value('purpose'));

        $this->artisan('sigap:koreksi-portal', ['--terapkan' => true])
            ->expectsOutputToContain('Dilewati: sudah disunting Super Admin.')
            ->expectsOutputToContain('2 portal diperbarui, 1 dilewati.')
            ->assertSuccessful();

        $this->assertSame('Syarat dan tata cara menjadi transmigran dari Kementerian Transmigrasi', Portal::query()->where('code', 'persyaratan-transmigrasi')->value('purpose'));
        $this->assertStringNotContainsString('30 hari', Portal::query()->where('code', 'pengaduan-wewenang')->value('description'));
        $this->assertSame('Disunting Super Admin.', $edited->fresh()->description);
        $this->assertSame(2, ActivityLog::query()->where('action', 'portal.corrected')->count());

        $this->artisan('sigap:koreksi-portal', ['--terapkan' => true])
            ->expectsOutputToContain('0 portal diperbarui, 3 dilewati.')
            ->assertSuccessful();
    }
}
