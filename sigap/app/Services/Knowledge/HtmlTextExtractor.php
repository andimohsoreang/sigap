<?php

namespace App\Services\Knowledge;

use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;
use Illuminate\Support\Str;

/**
 * Halaman web → judul, bagian-bagian teks (per judul bagian), dan tautan.
 *
 * Menu, kepala/kaki halaman, formulir, dan skrip dibuang; bila halaman punya
 * <main>/<article>, hanya isinya yang dipakai. Tanpa pustaka tambahan (DOM bawaan PHP).
 */
class HtmlTextExtractor
{
    private const NOISE_TAGS = ['script', 'style', 'noscript', 'template', 'svg', 'iframe', 'nav', 'header', 'footer', 'aside', 'form', 'button', 'select', 'dialog'];

    private const NOISE_CLASS = '/(^|[\s_-])(navbar|nav|menu|footer|breadcrumbs?|sidebar|modal|cookie|social|share|offcanvas|topbar|skip)([\s_-]|$)/i';

    private const BLOCK_TAGS = ['p', 'div', 'section', 'article', 'main', 'ul', 'ol', 'dl', 'dd', 'dt', 'table', 'tbody', 'thead', 'blockquote', 'pre', 'figure', 'figcaption', 'hr', 'address', 'center'];

    private const HEADING = "\x1E";

    /** Baris tombol/tautan yang tidak bermakna sebagai isi. */
    private const JUNK_LINE = '/^(•\s*)?(lihat selengkapnya|baca selanjutnya|baca selengkapnya|selengkapnya|read more|scroll to top|kembali ke atas|share|bagikan|\d+\s*(foto|video))$/iu';

    /**
     * `links` = semua tautan (termasuk menu); `content_links` = tautan di dalam
     * isi utama saja (mis. "Baca selanjutnya" di daftar berita).
     *
     * @return array{title: string, sections: list<array{heading: string|null, text: string}>, links: list<string>, content_links: list<string>}
     */
    public function extract(string $html, string $baseUrl): array
    {
        $dom = new DOMDocument;
        $previous = libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="UTF-8">'.$html, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $xpath = new DOMXPath($dom);
        // Tautan diambil sebelum menu dibuang: menu adalah peta halaman situs.
        $links = $this->links($xpath, $baseUrl);
        $title = $this->title($xpath);

        foreach (self::NOISE_TAGS as $tag) {
            $this->removeAll($xpath->query("//{$tag}"));
        }
        $this->removeAll($xpath->query('//*[@role="navigation" or @aria-hidden="true" or @hidden]'));
        $noisy = [];
        foreach ($xpath->query('//*[@class or @id]') as $el) {
            /** @var DOMElement $el */
            if (preg_match(self::NOISE_CLASS, $el->getAttribute('class').' '.$el->getAttribute('id')) === 1 && ! in_array($el->tagName, ['body', 'main', 'article'], true)) {
                $noisy[] = $el;
            }
        }
        $this->removeAll($noisy);

        $root = null;
        foreach (['//main', '//*[@role="main"]', '//article'] as $query) {
            $candidate = $xpath->query($query)->item(0);
            if ($candidate && mb_strlen(trim($candidate->textContent)) >= 200) {
                $root = $candidate;
                break;
            }
        }
        $root ??= $xpath->query('//body')->item(0) ?? $dom->documentElement;

        $raw = $root ? $this->walk($root) : '';
        $contentLinks = $root ? $this->links(new DOMXPath($dom), $baseUrl, $root) : [];

        return ['title' => $title, 'sections' => $this->sections($raw), 'links' => $links, 'content_links' => $contentLinks];
    }

    private function walk(DOMNode $node): string
    {
        if ($node->nodeType === XML_TEXT_NODE) {
            return preg_replace('/\s+/u', ' ', $node->nodeValue ?? '') ?? '';
        }
        if (! $node instanceof DOMElement && $node->nodeType !== XML_DOCUMENT_NODE) {
            return '';
        }

        $tag = $node instanceof DOMElement ? strtolower($node->tagName) : '';
        if ($tag === 'br') {
            return "\n";
        }

        $inner = '';
        foreach ($node->childNodes as $child) {
            $inner .= $this->walk($child);
        }

        return match (true) {
            in_array($tag, ['h1', 'h2', 'h3', 'h4'], true) => "\n".self::HEADING.trim(preg_replace('/\s+/u', ' ', $inner))."\n",
            $tag === 'li' => "\n• ".trim($inner)."\n",
            $tag === 'tr' => "\n".trim($inner, ' |')."\n",
            in_array($tag, ['td', 'th'], true) => ' '.trim($inner).' |',
            in_array($tag, ['h5', 'h6'], true) || in_array($tag, self::BLOCK_TAGS, true) => "\n{$inner}\n",
            default => $inner,
        };
    }

    /**
     * @return list<array{heading: string|null, text: string}>
     */
    private function sections(string $raw): array
    {
        $sections = [];
        $heading = null;
        $lines = [];

        $flush = function () use (&$sections, &$heading, &$lines) {
            $text = trim(implode("\n", $lines));
            if ($text !== '') {
                $sections[] = ['heading' => $heading, 'text' => $text];
            }
            $lines = [];
        };

        foreach (preg_split('/\n+/u', $raw) ?: [] as $line) {
            $line = trim(preg_replace('/[ \t\x{00A0}]+/u', ' ', $line) ?? '');
            if ($line === '' || $line === '•' || preg_match(self::JUNK_LINE, $line) === 1) {
                continue;
            }
            // Judul bagian: <h1>–<h4>, atau baris HURUF KAPITAL pendek yang lazim
            // dipakai situs pemerintah sebagai subjudul ("PERSYARATAN CALON TRANSMIGRAN").
            if (str_starts_with($line, self::HEADING) || $this->looksLikeHeading($line)) {
                $flush();
                $heading = Str::limit(trim(ltrim($line, self::HEADING)), 200, '') ?: null;

                continue;
            }
            $lines[] = $line;
        }
        $flush();

        return $sections;
    }

    private function looksLikeHeading(string $line): bool
    {
        $letters = preg_replace('/[^\p{L}]/u', '', $line) ?? '';

        return mb_strlen($line) <= 120
            && mb_strlen($letters) >= 6
            && (substr_count($line, ' ') >= 1 || mb_strlen($letters) <= 20)
            && ! str_starts_with($line, '•')
            && ! preg_match('/[.;:,]$/u', $line)
            && mb_strtoupper($letters) === $letters;
    }

    private function title(DOMXPath $xpath): string
    {
        foreach (['//h1', '//title', '//meta[@property="og:title"]/@content'] as $query) {
            $node = $xpath->query($query)->item(0);
            // Potongan teks digabung dengan spasi: "Tata Cara<span>Bertransmigrasi</span>".
            $pieces = $node ? array_map(fn (DOMNode $t) => $t->nodeValue, iterator_to_array($xpath->query('.//text()', $node))) : [];
            $text = trim(preg_replace('/\s+/u', ' ', implode(' ', $pieces) ?: (string) $node?->nodeValue) ?? '');
            if ($text !== '') {
                return Str::limit($text, 200, '');
            }
        }

        return '';
    }

    /**
     * @return list<string> alamat absolut tanpa #fragmen, unik
     */
    private function links(DOMXPath $xpath, string $baseUrl, ?DOMNode $within = null): array
    {
        $links = [];
        foreach ($within ? $xpath->query('.//a[@href]', $within) : $xpath->query('//a[@href]') as $a) {
            /** @var DOMElement $a */
            $url = self::resolve(trim($a->getAttribute('href')), $baseUrl);
            if ($url !== null) {
                $links[$url] = true;
            }
        }

        return array_keys($links);
    }

    /** Ubah tautan relatif menjadi absolut. Null untuk mailto:, tel:, javascript:, atau #. */
    public static function resolve(string $href, string $base): ?string
    {
        $href = trim(Str::before($href, '#'));
        if ($href === '' || preg_match('/^(mailto|tel|javascript|data|whatsapp):/i', $href)) {
            return null;
        }
        if (preg_match('#^https?://#i', $href)) {
            return $href;
        }

        $parts = parse_url($base);
        if (! isset($parts['scheme'], $parts['host'])) {
            return null;
        }
        $origin = $parts['scheme'].'://'.$parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : '');

        if (str_starts_with($href, '//')) {
            return $parts['scheme'].':'.$href;
        }
        if (str_starts_with($href, '/')) {
            return $origin.$href;
        }
        if (str_starts_with($href, '?')) {
            return $origin.($parts['path'] ?? '/').$href;
        }

        $dir = preg_replace('#/[^/]*$#', '/', $parts['path'] ?? '/') ?: '/';
        $path = $dir.$href;
        // Rapikan ./ dan ../
        $segments = [];
        foreach (explode('/', $path) as $segment) {
            if ($segment === '..') {
                array_pop($segments);
            } elseif ($segment !== '.') {
                $segments[] = $segment;
            }
        }

        return $origin.'/'.ltrim(implode('/', $segments), '/');
    }

    /** @param iterable<DOMNode> $nodes */
    private function removeAll(iterable $nodes): void
    {
        $list = [];
        foreach ($nodes as $node) {
            $list[] = $node;
        }
        foreach ($list as $node) {
            $node->parentNode?->removeChild($node);
        }
    }
}
