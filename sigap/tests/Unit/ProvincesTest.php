<?php

namespace Tests\Unit;

use App\Support\Provinces;
use PHPUnit\Framework\TestCase;

/** Daftar provinsi PHP, TypeScript, dan GeoJSON peta harus sama persis. */
class ProvincesTest extends TestCase
{
    private function root(string $path): string
    {
        return dirname(__DIR__, 2).'/'.$path;
    }

    public function test_php_list_matches_geojson_and_typescript(): void
    {
        $geo = json_decode((string) file_get_contents($this->root('public/geo/indonesia-provinsi.geojson')), true);
        $fromGeo = array_map(fn (array $f) => $f['properties']['provinsi'], $geo['features']);

        preg_match_all("/^\\s+'([^']+)',$/m", (string) file_get_contents($this->root('resources/js/lib/provinces.ts')), $m);

        $this->assertCount(38, Provinces::ALL);
        $this->assertEqualsCanonicalizing($fromGeo, Provinces::ALL);
        $this->assertSame(Provinces::ALL, $m[1]);
    }

    public function test_normalize_accepts_common_variants(): void
    {
        $this->assertSame('Jawa Barat', Provinces::normalize('  prov. jawa   barat '));
        $this->assertSame('Nusa Tenggara Barat', Provinces::normalize('NTB'));
        $this->assertSame('DI Yogyakarta', Provinces::normalize('Daerah Istimewa Yogyakarta'));
        $this->assertSame('Papua Selatan', Provinces::normalize('Papua Selatan'));
        $this->assertNull(Provinces::normalize('Nevada'));
        $this->assertNull(Provinces::normalize(''));
        $this->assertNull(Provinces::normalize(null));
    }
}
