<?php

namespace App\Services\Knowledge;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\UriInterface;

/**
 * Mengambil halaman/berkas dari situs resmi untuk Sumber Resmi.
 *
 * Hanya domain di `services.knowledge.allowed_hosts` (beserta subdomainnya)
 * yang boleh diambil — termasuk tujuan pengalihan — agar fitur ini tidak bisa
 * dipakai untuk mengakses jaringan internal atau situs sembarang.
 */
class OfficialWebFetcher
{
    public const TYPE_HTML = 'html';

    public const TYPE_PDF = 'pdf';

    public const TYPE_DOCX = 'docx';

    public function isAllowed(string $url): bool
    {
        $parts = parse_url($url);
        if ($parts === false || ! in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true)) {
            return false;
        }
        if (isset($parts['user']) || isset($parts['pass']) || ! in_array($parts['port'] ?? null, [null, 80, 443], true)) {
            return false;
        }

        $host = rtrim(strtolower($parts['host'] ?? ''), '.');
        if ($host === '') {
            return false;
        }

        foreach (config('services.knowledge.allowed_hosts', []) as $allowed) {
            $allowed = strtolower(trim($allowed));
            if ($allowed !== '' && ($host === $allowed || str_ends_with($host, '.'.$allowed))) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array{url: string, type: string, body: string}
     *
     * @throws SourceFetchException
     */
    public function fetch(string $url): array
    {
        if (! $this->isAllowed($url)) {
            throw new SourceFetchException('Alamat ini bukan situs resmi yang diizinkan.');
        }

        $maxBytes = (int) config('services.knowledge.max_bytes');

        try {
            $response = Http::withHeaders([
                'User-Agent' => 'SIGAP-Kementrans/1.0 (Sumber Resmi; '.config('app.url').')',
                'Accept' => 'text/html,application/xhtml+xml,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document;q=0.9,*/*;q=0.5',
            ])
                ->timeout((int) config('services.knowledge.timeout', 30))
                ->withOptions([
                    'allow_redirects' => [
                        'max' => 5,
                        'on_redirect' => function ($request, $response, UriInterface $uri) {
                            if (! $this->isAllowed((string) $uri)) {
                                throw new SourceFetchException('Halaman dialihkan ke situs di luar daftar resmi.');
                            }
                        },
                    ],
                    'on_headers' => function (ResponseInterface $response) use ($maxBytes) {
                        if ((int) $response->getHeaderLine('Content-Length') > $maxBytes) {
                            throw new SourceFetchException('Berkas terlalu besar.');
                        }
                    },
                ])
                ->get($url);
        } catch (\Throwable $e) {
            throw $this->unwrap($e);
        }

        if (! $response->successful()) {
            throw new SourceFetchException("Situs membalas dengan kode {$response->status()}.");
        }

        $body = $response->body();
        if (strlen($body) > $maxBytes) {
            throw new SourceFetchException('Berkas terlalu besar.');
        }

        $finalUrl = (string) ($response->effectiveUri() ?? $url);
        if (! $this->isAllowed($finalUrl)) {
            throw new SourceFetchException('Halaman dialihkan ke situs di luar daftar resmi.');
        }

        $type = $this->detectType((string) $response->header('Content-Type'), $finalUrl, $body);
        if ($type === null) {
            throw new SourceFetchException('Jenis isi tidak didukung (hanya halaman web, PDF, atau DOCX).');
        }

        return ['url' => $finalUrl, 'type' => $type, 'body' => $body];
    }

    private function detectType(string $contentType, string $url, string $body): ?string
    {
        $contentType = strtolower($contentType);
        $path = strtolower((string) parse_url($url, PHP_URL_PATH));

        return match (true) {
            str_contains($contentType, 'pdf') || str_starts_with($body, '%PDF') => self::TYPE_PDF,
            str_contains($contentType, 'wordprocessingml') || (str_ends_with($path, '.docx') && str_starts_with($body, 'PK')) => self::TYPE_DOCX,
            str_contains($contentType, 'html') || ($contentType === '' && Str::contains(Str::lower(substr($body, 0, 500)), '<html')) => self::TYPE_HTML,
            default => null,
        };
    }

    private function unwrap(\Throwable $e): SourceFetchException
    {
        for ($cause = $e; $cause !== null; $cause = $cause->getPrevious()) {
            if ($cause instanceof SourceFetchException) {
                return $cause;
            }
        }

        return new SourceFetchException('Situs tidak dapat dihubungi.', previous: $e);
    }
}
