<?php

namespace Tests\Unit\Architecture;

use App\Modules\Ai\AiTask;
use Database\Seeders\OfficialKnowledgeSeeder;
use Tests\TestCase;

/**
 * PRD-AI §0.9: contoh di prompt tidak boleh memakai fakta domain sungguhan
 * (angka, pasal, nama program). Contoh nyata (mis. batas usia 19–49) pernah
 * bocor ke jawaban TARA walau tidak ada di SUMBER.
 */
class PromptExamplesTest extends TestCase
{
    /** Nama program, portal, dan halaman resmi yang tidak boleh muncul sebagai contoh. */
    private const NAMES = [
        'SIBARDUKTRANS', 'Persyaratan Transmigrasi', 'Trans Tuntas', 'Translok', 'Trans Lokal', 'Transmigrasi Patriot',
        'Trans Patriot', 'Trans Karya Nusa', 'Trans Gotong Royong', 'Program 5T', 'Komcad', 'SP4N', 'LAPOR!',
    ];

    /** @return list<string> nama program dari artikel resmi "Apa itu (program) X?" */
    private static function programNames(): array
    {
        $names = [];
        foreach ((new OfficialKnowledgeSeeder)->articles() as $article) {
            if (preg_match('/^Apa itu (?:program )?(.+?)(?: Kementerian Transmigrasi)?(?: \(.+\))?\?$/u', $article['title'], $m)) {
                $names[] = $m[1];
            }
        }

        return $names;
    }

    public function test_prompts_carry_no_real_domain_facts(): void
    {
        $this->assertNotEmpty(self::programNames());

        foreach (AiTask::cases() as $task) {
            $prompt = $task->systemPrompt();

            foreach ([...self::NAMES, ...self::programNames()] as $name) {
                $this->assertStringNotContainsStringIgnoringCase($name, $prompt, "{$task->value}: nama program/portal \"{$name}\"");
            }
            foreach ([
                'rujukan peraturan' => '/\b(UU|PP|Perpres|Permentrans|Permendesa|Peraturan Menteri)\s*(Nomor|No\.?)?\s*\d/iu',
                'pasal' => '/\bPasal\s+\d/iu',
                'nomor/tahun peraturan' => '/\b\d{1,3}\s*\/\s*(19|20)\d{2}\b/u',
                'angka dengan satuan domain' => '/\d\s*(tahun|bulan|hari|hektar|ha\b|KK\b|jiwa|transmigran|%)/iu',
            ] as $label => $pattern) {
                $this->assertDoesNotMatchRegularExpression($pattern, $prompt, "{$task->value}: {$label}");
            }
        }
    }

    public function test_detector_catches_the_example_that_once_leaked(): void
    {
        $leaked = 'misalnya: "Menurut SIBARDUKTRANS, usia 19–53 tahun [1]. Menurut halaman Persyaratan Transmigrasi, usia 19–49 tahun [2]."';

        $this->assertMatchesRegularExpression('/\d\s*(tahun|bulan|hari|hektar|ha\b|KK\b|jiwa|transmigran|%)/iu', $leaked);
        $this->assertStringContainsString('SIBARDUKTRANS', $leaked);
    }
}
