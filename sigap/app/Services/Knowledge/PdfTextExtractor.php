<?php

namespace App\Services\Knowledge;

use RuntimeException;
use Smalot\PdfParser\Parser;

/** Mengambil teks per halaman dari PDF (tanpa OCR: PDF hasil pindai tidak terbaca). */
class PdfTextExtractor
{
    /**
     * @return list<string> teks tiap halaman, berurutan
     *
     * @throws RuntimeException bila PDF rusak/terenkripsi
     */
    public function pages(string $path): array
    {
        try {
            $document = (new Parser)->parseFile($path);
        } catch (\Throwable $e) {
            throw new RuntimeException('PDF tidak dapat dibaca: '.$e->getMessage(), previous: $e);
        }

        return array_values(array_map(
            fn ($page) => trim(preg_replace('/[ \t]+/', ' ', (string) $page->getText())),
            $document->getPages(),
        ));
    }
}
