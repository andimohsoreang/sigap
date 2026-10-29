<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Berita resmi terbaru dari transmigrasi.go.id (WordPress REST API, kategori
 * "Berita") untuk bagian "Berita Transmigrasi" di beranda.
 *
 * Disimpan di cache satu jam. Bila situs resmi gagal diakses, berita terakhir
 * yang berhasil diambil tetap ditampilkan dan pengambilan ulang ditunda
 * sepuluh menit agar beranda tidak ikut melambat.
 */
class OfficialNews
{
    public const SITE = 'https://www.transmigrasi.go.id';

    /** Kategori "Berita" (slug `berita`) di situs resmi. */
    public const CATEGORY = 7;

    public const ALL_URL = self::SITE.'/category/berita/';

    private const CACHE_KEY = 'berita_resmi';

    private const RETRY_KEY = 'berita_resmi_tunda';

    private const FRESH_SECONDS = 3600;

    private const LIMIT = 6;

    /**
     * @return list<array{judul: string, ringkasan: string, lokasi: string|null, tanggal: string, gambar: string|null, url: string}>
     */
    public function latest(): array
    {
        $cached = Cache::get(self::CACHE_KEY);
        if (is_array($cached) && ($cached['at'] ?? 0) > now()->subSeconds(self::FRESH_SECONDS)->getTimestamp()) {
            return $cached['items'];
        }

        if (! Cache::has(self::RETRY_KEY)) {
            try {
                $items = $this->fetch();
                if ($items !== []) {
                    Cache::forever(self::CACHE_KEY, ['at' => now()->getTimestamp(), 'items' => $items]);

                    return $items;
                }
            } catch (Throwable $e) {
                Log::warning('Berita resmi gagal diambil', ['error' => $e->getMessage()]);
            }
            Cache::put(self::RETRY_KEY, true, now()->addMinutes(10));
        }

        return is_array($cached) ? $cached['items'] : [];
    }

    /** @return list<array{judul: string, ringkasan: string, lokasi: string|null, tanggal: string, gambar: string|null, url: string}> */
    private function fetch(): array
    {
        $posts = Http::timeout(6)->acceptJson()->get(self::SITE.'/wp-json/wp/v2/posts', [
            'categories' => self::CATEGORY,
            'per_page' => self::LIMIT,
            '_embed' => 'wp:featuredmedia',
            '_fields' => 'id,date,link,title,excerpt,_links,_embedded',
        ])->throw()->json();

        if (! is_array($posts)) {
            return [];
        }

        $items = [];
        foreach ($posts as $post) {
            $url = (string) ($post['link'] ?? '');
            $title = $this->text($post['title']['rendered'] ?? '');
            if ($title === '' || ! $this->official($url)) {
                continue;
            }

            [$lokasi, $ringkasan] = $this->dateline($this->text($post['excerpt']['rendered'] ?? ''));
            $items[] = [
                'judul' => $title,
                'ringkasan' => Str::limit($ringkasan, 170),
                'lokasi' => $lokasi,
                'tanggal' => (string) ($post['date'] ?? ''),
                'gambar' => $this->image($post['_embedded']['wp:featuredmedia'][0] ?? null),
                'url' => $url,
            ];
        }

        return $items;
    }

    /** HTML WordPress → teks polos tanpa "[…]". */
    private function text(string $html): string
    {
        $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        return trim((string) preg_replace(['/\s*\[(…|&hellip;|\.\.\.)\]\s*$/u', '/\s+/u'], ['', ' '], $text));
    }

    /**
     * Ringkasan berita resmi diawali dateline ("Manokwari – Peternak …").
     *
     * @return array{0: string|null, 1: string}
     */
    private function dateline(string $excerpt): array
    {
        if (preg_match('/^([\p{L}][\p{L}\s.,]{1,38}?)\s+[–—-]\s+(.+)$/u', $excerpt, $m)) {
            $place = trim($m[1]);
            // "JAYAPURA" → "Jayapura"; "Manokwari Selatan" dibiarkan.
            $place = mb_strtoupper($place) === $place ? mb_convert_case(mb_strtolower($place), MB_CASE_TITLE) : $place;

            return [$place, $m[2]];
        }

        return [null, $excerpt];
    }

    /** Gambar unggulan ukuran sedang; hanya dari situs resmi. */
    private function image(mixed $media): ?string
    {
        if (! is_array($media)) {
            return null;
        }
        $sizes = $media['media_details']['sizes'] ?? [];
        foreach (['medium_large', 'large', 'full'] as $size) {
            $src = $sizes[$size]['source_url'] ?? null;
            if (is_string($src) && $this->official($src)) {
                return $src;
            }
        }
        $src = $media['source_url'] ?? null;

        return is_string($src) && $this->official($src) ? $src : null;
    }

    private function official(string $url): bool
    {
        return str_starts_with($url, self::SITE.'/');
    }
}
