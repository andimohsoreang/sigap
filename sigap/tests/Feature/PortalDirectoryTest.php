<?php

namespace Tests\Feature;

use App\Models\Portal;
use App\Services\PortalDirectory;
use Database\Seeders\PortalSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Pertanyaan warga diarahkan ke portal resmi yang tepat (katalog 25 Okt 2026). */
class PortalDirectoryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PortalSeeder::class);
    }

    public static function questions(): array
    {
        return [
            ['Bagaimana cara daftar transmigrasi?', 'sibarduktrans'],
            ['saya mau ikut transmigrasi', 'sibarduktrans'],
            ['lahan saya diserobot orang', 'trans-tuntas'],
            ['sertifikat tanah transmigrasi belum keluar', 'trans-tuntas'],
            ['minta salinan dokumen anggaran', 'ppid'],
            ['peraturan menteri transmigrasi terbaru', 'jdih'],
            ['ada pejabat minta uang pungli', 'pengaduan-wewenang'],
            ['berita hoaks transmigrasi benar tidak', 'cek-fakta'],
            ['syarat jadi transmigran', 'persyaratan-transmigrasi'],
            ['peta kawasan transmigrasi', 'sipukat'],
            ['saya dikasih parsel lebaran sama kontraktor', 'gratifikasi-kpk'],
            ['lapor pemda tidak menanggapi', 'lapor'],
            ['jalan di desa saya rusak', null],
        ];
    }

    /** @dataProvider questions */
    public function test_question_is_matched_to_the_right_portal(string $question, ?string $expected): void
    {
        $this->assertSame($expected, app(PortalDirectory::class)->suggest($question)?->code);
    }

    public function test_internal_portals_are_never_suggested_and_sibarduktrans_is_tracked(): void
    {
        $codes = collect(app(PortalDirectory::class)->forAssistant('transcloud tc more'))->pluck('kode');
        $this->assertNotContains('transcloud', $codes);
        $this->assertNotContains('tc-more', $codes);
        $this->assertTrue((bool) Portal::query()->where('code', 'sibarduktrans')->value('track_completion'));
    }

    public function test_every_public_portal_points_to_an_official_https_address(): void
    {
        foreach (Portal::query()->get() as $portal) {
            $this->assertStringStartsWith('https://', $portal->url, $portal->code);
            $host = parse_url($portal->url, PHP_URL_HOST);
            $this->assertTrue(
                str_ends_with($host, 'transmigrasi.go.id') || in_array($host, ['sp4n.lapor.go.id', 'gol.kpk.go.id'], true),
                "{$portal->code} → {$host}",
            );
        }
    }
}
