<?php

namespace App\Services\Knowledge;

use App\Models\KnowledgePassage;
use App\Models\KnowledgeSource;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Sumber Resmi → kutipan siap dirujuk asisten AI.
 *
 * Situs diambil ulang berkala; kutipan hanya diganti bila isinya berubah
 * (sidik isi), dan kutipan lama tetap dipakai bila pengambilan gagal.
 */
class SourceIngestor
{
    /** Panjang maksimal satu kutipan (≈ satu bagian pendek). */
    private const PASSAGE_CHARS = 1200;

    private const MIN_CHARS = 25;

    /** Bagian sependek ini (mis. satu baris daftar lokasi) digabung dengan bagian pendek lain di halaman yang sama. */
    private const SHORT_SECTION = 100;

    /** Kutipan di bawah jumlah kata ini biasanya sisa tombol/menu ("Scroll to Top"). */
    private const MIN_WORDS = 8;

    /** Tautan yang tidak perlu diikuti (akun, aset, berkas non-teks). */
    private const SKIP_PATH = '#(/(login|logout|masuk|keluar|register|signin|signup|cdn-cgi|wp-admin|wp-json|feed|assets?|storage/app)\b)|\.(jpe?g|png|gif|webp|svg|ico|zip|rar|xlsx?|pptx?|mp4|mp3|css|js)$#i';

    public function __construct(
        private readonly OfficialWebFetcher $fetcher,
        private readonly HtmlTextExtractor $html,
        private readonly PdfTextExtractor $pdf,
        private readonly DocxTextExtractor $docx,
    ) {}

    public function sync(KnowledgeSource $source): void
    {
        $source->forceFill(['status' => KnowledgeSource::STATUS_PROCESSING])->save();

        try {
            [$segments, $pages] = $source->isSite() ? $this->crawl($source) : $this->readFile($source);
        } catch (SourceFetchException|\RuntimeException $e) {
            $this->fail($source, $e instanceof SourceFetchException ? $e->getMessage() : 'Berkas tidak dapat dibaca.', $e);

            return;
        }

        $passages = $this->passages($segments);
        if ($passages === []) {
            $this->fail($source, 'Tidak ada teks yang dapat dibaca. Halaman berupa gambar atau dokumen hasil pindai belum didukung.');

            return;
        }

        $hash = hash('sha256', json_encode($passages, JSON_UNESCAPED_UNICODE));

        DB::transaction(function () use ($source, $passages, $hash, $pages) {
            if ($hash !== $source->content_hash) {
                KnowledgePassage::query()->where('knowledge_source_id', $source->id)->delete();
                $now = now();
                foreach (array_chunk($passages, 200) as $chunk) {
                    KnowledgePassage::query()->insert(array_map(fn (array $p) => $p + [
                        'knowledge_source_id' => $source->id,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ], $chunk));
                }
                $source->forceFill(['changed_at' => $now, 'content_hash' => $hash]);
            }

            $source->forceFill([
                'status' => KnowledgeSource::STATUS_READY,
                'error' => null,
                'pages_count' => $pages,
                'passages_count' => count($passages),
                'fetched_at' => now(),
            ])->save();
        });
    }

    /**
     * @return array{0: list<array{url: string|null, title: string, heading: string|null, page: int|null, text: string}>, 1: int}
     *
     * @throws SourceFetchException
     */
    private function crawl(KnowledgeSource $source): array
    {
        $start = (string) $source->url;
        $limit = $source->follow_links ? max(1, (int) config('services.knowledge.max_pages', 25)) : 1;
        $host = strtolower((string) parse_url($start, PHP_URL_HOST));
        $prefix = preg_replace('#/[^/]*$#', '/', (string) (parse_url($start, PHP_URL_PATH) ?: '/')) ?: '/';

        $queue = [[$start, 0]];
        $seen = [$start => true];
        $segments = [];
        $pages = 0;

        while ($queue !== [] && $pages < $limit) {
            [$url, $depth] = array_shift($queue);

            try {
                $resource = $this->fetcher->fetch($url);
            } catch (SourceFetchException $e) {
                if ($pages === 0 && $url === $start) {
                    throw $e;
                }
                Log::info("Sumber resmi #{$source->id}: {$url} dilewati ({$e->getMessage()}).");

                continue;
            }

            $pages++;
            [$found, $links, $contentLinks] = $this->read($resource, $source->name);
            array_push($segments, ...$found);

            if (! $source->follow_links) {
                continue;
            }
            // Diikuti: halaman di bawah alamat awal, berkas PDF/DOCX, dan — dari
            // halaman awal saja — tautan di isi utama (mis. berita dari daftar Cek Fakta).
            $fromContent = $depth === 0 ? array_flip($contentLinks) : [];
            foreach ($links as $link) {
                if (isset($seen[$link]) || ! $this->fetcher->isAllowed($link) || preg_match(self::SKIP_PATH, (string) parse_url($link, PHP_URL_PATH)) === 1) {
                    continue;
                }
                $isFile = preg_match('/\.(pdf|docx)$/i', (string) parse_url($link, PHP_URL_PATH)) === 1;
                $sameHost = strtolower((string) parse_url($link, PHP_URL_HOST)) === $host;
                $sameSection = $sameHost && str_starts_with((string) (parse_url($link, PHP_URL_PATH) ?: '/'), $prefix);
                if ($isFile || $sameSection || ($sameHost && isset($fromContent[$link]))) {
                    $seen[$link] = true;
                    $queue[] = [$link, $depth + 1];
                }
            }
        }

        return [$segments, $pages];
    }

    /**
     * @param  array{url: string, type: string, body: string}  $resource
     * @return array{0: list<array{url: string|null, title: string, heading: string|null, page: int|null, text: string}>, 1: list<string>, 2: list<string>}
     */
    private function read(array $resource, string $fallbackTitle): array
    {
        $url = $resource['url'];
        $fileTitle = urldecode(Str::of((string) parse_url($url, PHP_URL_PATH))->afterLast('/')->beforeLast('.')->replace(['_', '-'], ' ')->toString());

        if ($resource['type'] === OfficialWebFetcher::TYPE_HTML) {
            $page = $this->html->extract($resource['body'], $url);
            $title = $page['title'] !== '' ? $page['title'] : $fallbackTitle;

            return [array_map(fn (array $s) => ['url' => $url, 'title' => $title, 'heading' => $s['heading'], 'page' => null, 'text' => $s['text']], $page['sections']), $page['links'], $page['content_links']];
        }

        $tmp = tempnam(sys_get_temp_dir(), 'sumber');
        file_put_contents($tmp, $resource['body']);

        try {
            $segments = $resource['type'] === OfficialWebFetcher::TYPE_PDF
                ? $this->pdfSegments($tmp, $url, $fileTitle ?: $fallbackTitle)
                : $this->docxSegments($tmp, $url, $fileTitle ?: $fallbackTitle);
        } catch (\RuntimeException $e) {
            throw new SourceFetchException('Berkas di situs tidak dapat dibaca.', previous: $e);
        } finally {
            @unlink($tmp);
        }

        return [$segments, [], []];
    }

    /**
     * @return array{0: list<array{url: string|null, title: string, heading: string|null, page: int|null, text: string}>, 1: int}
     */
    private function readFile(KnowledgeSource $source): array
    {
        $document = $source->document ?? throw new \RuntimeException('Berkas sumber tidak ditemukan.');
        $path = Storage::disk('local')->path($document->path);
        if (! is_file($path)) {
            throw new \RuntimeException('Berkas sumber tidak ditemukan.');
        }

        $segments = $document->isDocx()
            ? $this->docxSegments($path, null, $source->name)
            : $this->pdfSegments($path, null, $source->name);

        return [$segments, $document->isDocx() ? 1 : count(array_unique(array_column($segments, 'page')))];
    }

    /** @return list<array{url: string|null, title: string, heading: string|null, page: int|null, text: string}> */
    private function pdfSegments(string $path, ?string $url, string $title): array
    {
        $segments = [];
        foreach ($this->pdf->pages($path) as $i => $text) {
            if (mb_strlen($text) >= self::MIN_CHARS) {
                $segments[] = ['url' => $url, 'title' => $title, 'heading' => null, 'page' => $i + 1, 'text' => $text];
            }
        }

        return $segments;
    }

    /** @return list<array{url: string|null, title: string, heading: string|null, page: int|null, text: string}> */
    private function docxSegments(string $path, ?string $url, string $title): array
    {
        return array_map(
            fn (array $s) => ['url' => $url, 'title' => $title, 'heading' => $s['heading'], 'page' => null, 'text' => $s['text']],
            $this->docx->sections($path),
        );
    }

    /**
     * Potong tiap bagian menjadi kutipan ≤ PASSAGE_CHARS di batas baris/kalimat.
     * Bagian-bagian pendek dari halaman yang sama (mis. daftar lokasi) digabung
     * menjadi satu kutipan dengan judul tiap bagian sebagai barisnya. Kutipan
     * yang sama persis (mis. teks berulang di tiap halaman) disimpan sekali.
     *
     * @param  list<array{url: string|null, title: string, heading: string|null, page: int|null, text: string}>  $segments
     * @return list<array{url: string|null, title: string|null, heading: string|null, page: int|null, body: string, position: int}>
     */
    private function passages(array $segments): array
    {
        $passages = [];
        $seen = [];

        $emit = function (array $origin, ?string $heading, string $body) use (&$passages, &$seen) {
            $body = trim($body);
            $key = md5(mb_strtolower($body));
            if (mb_strlen($body) < self::MIN_CHARS || str_word_count(Str::ascii($body)) < self::MIN_WORDS || isset($seen[$key])) {
                return;
            }
            $seen[$key] = true;
            $passages[] = [
                'url' => $origin['url'] ? Str::limit($origin['url'], 1000, '') : null,
                'title' => Str::limit($origin['title'], 250, '') ?: null,
                'heading' => $heading ? Str::limit($heading, 250, '') : null,
                'page' => $origin['page'],
                'body' => $body,
                'position' => count($passages),
            ];
        };

        // Penampung bagian pendek per halaman. Bila ternyata hanya satu bagian,
        // disimpan apa adanya dengan judul bagiannya.
        $small = '';
        $smallOrigin = null;
        $smallCount = 0;
        $flushSmall = function () use (&$small, &$smallOrigin, &$smallCount, $emit) {
            if ($smallOrigin !== null) {
                $smallCount === 1
                    ? $emit($smallOrigin, $smallOrigin['heading'], $smallOrigin['text'])
                    : $emit($smallOrigin, null, $small);
            }
            $small = '';
            $smallOrigin = null;
            $smallCount = 0;
        };

        foreach ($segments as $segment) {
            if ($smallOrigin !== null && ($smallOrigin['url'] !== $segment['url'] || $smallOrigin['page'] !== $segment['page'])) {
                $flushSmall();
            }

            if (mb_strlen($segment['text']) < self::SHORT_SECTION && $segment['heading'] !== null) {
                $entry = $segment['heading'].': '.preg_replace('/\s*\n\s*/u', '; ', $segment['text']);
                if ($small !== '' && mb_strlen($small) + mb_strlen($entry) > self::PASSAGE_CHARS) {
                    $flushSmall();
                }
                $smallOrigin ??= $segment;
                $smallCount++;
                $small .= $entry."\n";

                continue;
            }

            $flushSmall();
            $buffer = '';
            foreach ($this->pieces($segment['text']) as $piece) {
                if ($buffer !== '' && mb_strlen($buffer) + mb_strlen($piece) > self::PASSAGE_CHARS) {
                    $emit($segment, $segment['heading'], $buffer);
                    $buffer = '';
                }
                $buffer .= $piece."\n";
            }
            $emit($segment, $segment['heading'], $buffer);
        }
        $flushSmall();

        return $passages;
    }

    /**
     * Baris teks; baris yang terlalu panjang dipecah per kalimat.
     *
     * @return list<string>
     */
    private function pieces(string $text): array
    {
        $pieces = [];
        foreach (preg_split('/\n+/u', $text) ?: [] as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }
            if (mb_strlen($line) <= self::PASSAGE_CHARS) {
                $pieces[] = $line;

                continue;
            }
            $sentence = '';
            foreach (preg_split('/(?<=[.;!?])\s+/u', $line) ?: [] as $part) {
                if ($sentence !== '' && mb_strlen($sentence) + mb_strlen($part) > self::PASSAGE_CHARS) {
                    $pieces[] = trim($sentence);
                    $sentence = '';
                }
                $sentence .= $part.' ';
            }
            foreach (mb_str_split(trim($sentence), self::PASSAGE_CHARS) as $rest) {
                $pieces[] = $rest;
            }
        }

        return $pieces;
    }

    private function fail(KnowledgeSource $source, string $message, ?\Throwable $e = null): void
    {
        if ($e) {
            Log::warning("Sumber resmi #{$source->id} gagal diambil: ".$e->getMessage());
        }

        // Kutipan lama (bila ada) tetap dipakai sampai pengambilan berikutnya berhasil.
        $source->forceFill(['status' => KnowledgeSource::STATUS_FAILED, 'error' => $message])->save();
    }
}
