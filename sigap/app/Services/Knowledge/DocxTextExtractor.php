<?php

namespace App\Services\Knowledge;

use DOMDocument;
use DOMElement;
use DOMXPath;
use Illuminate\Support\Str;
use RuntimeException;
use ZipArchive;

/**
 * Berkas Word (.docx) → bagian-bagian teks per judul (gaya Heading/Judul).
 * DOCX tidak menyimpan nomor halaman, jadi rujukannya memakai judul bagian.
 */
class DocxTextExtractor
{
    private const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    /**
     * @return list<array{heading: string|null, text: string}>
     *
     * @throws RuntimeException bila berkas bukan DOCX yang sah
     */
    public function sections(string $path): array
    {
        $zip = new ZipArchive;
        if ($zip->open($path) !== true) {
            throw new RuntimeException('DOCX tidak dapat dibuka.');
        }
        $xml = $zip->getFromName('word/document.xml');
        $zip->close();
        if ($xml === false) {
            throw new RuntimeException('DOCX tidak memuat isi dokumen.');
        }

        $dom = new DOMDocument;
        if (! @$dom->loadXML($xml, LIBXML_NONET)) {
            throw new RuntimeException('Isi DOCX rusak.');
        }
        $xpath = new DOMXPath($dom);
        $xpath->registerNamespace('w', self::W);

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

        foreach ($xpath->query('/w:document/w:body/*') as $block) {
            /** @var DOMElement $block */
            if ($block->localName === 'tbl') {
                foreach ($xpath->query('.//w:tr', $block) as $row) {
                    $cells = [];
                    foreach ($xpath->query('./w:tc', $row) as $cell) {
                        $cells[] = $this->text($xpath, $cell);
                    }
                    $line = trim(implode(' | ', array_filter($cells, fn ($c) => $c !== '')));
                    if ($line !== '') {
                        $lines[] = $line;
                    }
                }

                continue;
            }
            if ($block->localName !== 'p') {
                continue;
            }

            $text = $this->text($xpath, $block);
            if ($text === '') {
                continue;
            }
            $style = (string) $xpath->query('./w:pPr/w:pStyle/@w:val', $block)->item(0)?->nodeValue;
            if (preg_match('/^(heading|judul|title)/i', $style) === 1) {
                $flush();
                $heading = Str::limit($text, 200, '');

                continue;
            }
            $isList = $xpath->query('./w:pPr/w:numPr', $block)->length > 0;
            $lines[] = ($isList ? '• ' : '').$text;
        }
        $flush();

        return $sections;
    }

    private function text(DOMXPath $xpath, DOMElement $node): string
    {
        $parts = [];
        foreach ($xpath->query('.//w:t|.//w:tab|.//w:br', $node) as $piece) {
            $parts[] = $piece->localName === 't' ? $piece->textContent : ' ';
        }

        return trim(preg_replace('/\s+/u', ' ', implode('', $parts)) ?? '');
    }
}
