<?php

namespace Tests\Unit;

use App\Models\KnowledgeArticle;
use App\Models\KnowledgePassage;
use App\Models\KnowledgeSource;
use App\Modules\Ai\Prompts\JawabPrompt;
use App\Services\Ai\AssistantService;
use Tests\TestCase;

/** Label dasar hukum dan aturan "label memutuskan" (PRD-AI FR-AI-11). */
class LegalBasisTest extends TestCase
{
    private function article(array $basis): KnowledgeArticle
    {
        return new KnowledgeArticle($basis + ['title' => 'Syarat usia', 'body' => 'Isi.']);
    }

    private function passage(?KnowledgeSource $source): KnowledgePassage
    {
        $passage = new KnowledgePassage(['body' => 'Berusia 19 s/d 49 tahun.']);
        $passage->setRelation('source', $source);

        return $passage;
    }

    public function test_label_shows_basis_year_and_status(): void
    {
        $this->assertSame('Dasar: tidak dicatat — BELUM DIKETAHUI', $this->article([])->legalBasisLabel());
        $this->assertSame('Dasar: Peraturan A — BELUM DIKETAHUI', $this->article(['dasar_hukum' => 'Peraturan A'])->legalBasisLabel());
        $this->assertSame(
            'Dasar: Peraturan Baru 2/2024 (2024) — BERLAKU',
            $this->article(['dasar_hukum' => 'Peraturan Baru 2/2024', 'tanggal_dasar' => '2024-12-09', 'status_dasar' => 'berlaku'])->legalBasisLabel(),
        );
        $this->assertSame(
            'Dasar: Peraturan Lama 11/2017 (2017) — DIGANTI oleh Peraturan Baru 2/2024',
            $this->article(['dasar_hukum' => 'Peraturan Lama 11/2017', 'tanggal_dasar' => '2017-07-24', 'status_dasar' => 'diganti', 'diganti_oleh' => 'Peraturan Baru 2/2024'])->legalBasisLabel(),
        );
        $this->assertSame('Dasar: Peraturan Lama — DIGANTI', $this->article(['dasar_hukum' => 'Peraturan Lama', 'status_dasar' => 'diganti'])->legalBasisLabel());
    }

    public function test_labels_decide_only_with_both_current_and_replaced_and_no_unknown(): void
    {
        $current = $this->article(['status_dasar' => 'berlaku']);
        $replaced = new KnowledgeSource(['status_dasar' => 'diganti', 'diganti_oleh' => 'Peraturan Baru']);

        $this->assertTrue(AssistantService::basisDecides(collect([$current, $this->passage($replaced)])));
        $this->assertFalse(AssistantService::basisDecides(collect([$current, $this->passage(new KnowledgeSource)])), 'sumber belum diketahui');
        $this->assertFalse(AssistantService::basisDecides(collect([$current, $this->passage(null)])), 'kutipan tanpa sumber');
        $this->assertFalse(AssistantService::basisDecides(collect([$current, $this->article(['status_dasar' => 'berlaku'])])), 'keduanya berlaku');
        $this->assertFalse(AssistantService::basisDecides(collect([$current, $this->passage($replaced), $this->article([])])), 'ada yang belum diketahui');
    }

    /** Contoh nyata (mis. batas usia) di prompt pernah bocor ke jawaban tanpa ada di SUMBER. */
    public function test_jawab_prompt_examples_carry_no_domain_facts(): void
    {
        $prompt = JawabPrompt::system();

        foreach (['19–53', '19–49', '19 - 53', 'SIBARDUKTRANS', 'Persyaratan Transmigrasi'] as $fact) {
            $this->assertStringNotContainsString($fact, $prompt);
        }
        $this->assertStringContainsString('"dasar"', $prompt);
        $this->assertStringContainsString('"alasan_petugas"', $prompt);
    }

    public function test_unresolved_conflict_follows_model_flag_and_labels(): void
    {
        $service = app(AssistantService::class);
        $sources = collect([$this->article(['status_dasar' => 'berlaku']), $this->passage(new KnowledgeSource)]);
        $result = fn (array $r) => $r + ['sumber' => [1, 2], 'beda_sumber' => false, 'perlu_petugas' => false, 'alasan_petugas' => null];

        $this->assertFalse($service->unresolvedConflict($result([]), $sources), 'tidak ada beda sumber');
        $this->assertTrue($service->unresolvedConflict($result(['beda_sumber' => true]), $sources), 'label tidak memutuskan');
        $this->assertFalse($service->unresolvedConflict($result(['beda_sumber' => true, 'sumber' => [1]]), $sources), 'hanya satu sumber dikutip');
        $this->assertTrue($service->unresolvedConflict($result(['perlu_petugas' => true, 'alasan_petugas' => 'sumber_berbeda', 'sumber' => [1]]), $sources), 'model menyatakannya');

        $decided = collect([$this->article(['status_dasar' => 'berlaku']), $this->passage(new KnowledgeSource(['status_dasar' => 'diganti']))]);
        $this->assertFalse($service->unresolvedConflict($result(['beda_sumber' => true]), $decided), 'label memutuskan');
    }
}
