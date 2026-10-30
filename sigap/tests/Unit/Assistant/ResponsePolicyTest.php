<?php

namespace Tests\Unit\Assistant;

use App\Models\KnowledgeArticle;
use App\Models\Portal;
use App\Modules\Assistant\Decision;
use App\Modules\Assistant\ResponsePolicy;
use Illuminate\Support\Collection;
use Tests\TestCase;

/** PRD-AI §10: satu tes per cabang keputusan ResponsePolicy, tanpa database. */
class ResponsePolicyTest extends TestCase
{
    private ResponsePolicy $policy;

    protected function setUp(): void
    {
        parent::setUp();
        $this->policy = new ResponsePolicy;
    }

    /** @return array<string, mixed> */
    private function outcome(array $overrides = []): array
    {
        return $overrides + [
            'jenis' => 'informasi', 'jawaban' => 'Jawaban [1].', 'sumber' => [1], 'beda_sumber' => false, 'kebijakan' => false,
            'portal' => null, 'perlu_petugas' => false, 'alasan_petugas' => null, 'kompleks' => false, 'ringkasan' => '', 'angka_tanpa_dasar' => [],
        ];
    }

    /** @return Collection<int, KnowledgeArticle> */
    private function cited(string ...$statuses): Collection
    {
        return collect($statuses)->mapWithKeys(fn (string $s, int $i) => [$i + 1 => new KnowledgeArticle(['title' => "Artikel {$i}", 'body' => 'Isi.', 'status_dasar' => $s])]);
    }

    private function decide(array $result, ?Collection $cited = null, ?Portal $portal = null, int $terms = 5): Decision
    {
        return $this->policy->decide($this->outcome($result), $cited ?? $this->cited('belum_diketahui'), $portal, $terms);
    }

    private function assertDecision(string $type, bool $answerFirst, Decision $d, ?string $reason = null, ?string $notice = null): void
    {
        $this->assertSame([$type, $answerFirst, $reason, $notice], [$d->type, $d->answerFirst, $d->reason, $d->notice]);
    }

    public function test_informasi_bersumber_dijawab(): void
    {
        $this->assertDecision(Decision::ANSWER, false, $this->decide([]));
    }

    public function test_angka_tanpa_dasar_pada_informasi_diserahkan_dengan_pemberitahuan(): void
    {
        $this->assertDecision(Decision::HANDOFF, false, $this->decide(['angka_tanpa_dasar' => ['49']]), 'angka_tanpa_dasar', 'angka_tanpa_dasar');
    }

    public function test_angka_tanpa_dasar_pada_aduan_tetap_aduan_tanpa_jawaban(): void
    {
        $this->assertDecision(Decision::COMPLAINT, false, $this->decide(['jenis' => 'aduan', 'angka_tanpa_dasar' => ['49']]));
    }

    public function test_sumber_berbeda_tanpa_label_memutuskan_diserahkan_setelah_jawaban(): void
    {
        $this->assertDecision(Decision::CONFLICT, true, $this->decide(['beda_sumber' => true, 'sumber' => [1, 2]], $this->cited('berlaku', 'belum_diketahui')));
    }

    public function test_sumber_berbeda_dinyatakan_model_diserahkan(): void
    {
        $this->assertDecision(Decision::CONFLICT, true, $this->decide(['perlu_petugas' => true, 'alasan_petugas' => 'sumber_berbeda']));
    }

    public function test_sumber_berbeda_yang_diputuskan_label_dijawab(): void
    {
        $this->assertDecision(Decision::ANSWER, false, $this->decide(['beda_sumber' => true, 'sumber' => [1, 2]], $this->cited('berlaku', 'diganti')));
    }

    public function test_diminta_petugas_diserahkan_tanpa_pemberitahuan(): void
    {
        $this->assertDecision(Decision::HANDOFF, false, $this->decide(['perlu_petugas' => true, 'alasan_petugas' => 'diminta']), 'diminta');
    }

    public function test_tanda_perlu_petugas_pada_aduan_diabaikan(): void
    {
        $this->assertDecision(Decision::COMPLAINT, true, $this->decide(['jenis' => 'aduan', 'perlu_petugas' => true]));
    }

    public function test_aduan_kurang_detail_ditanya_dulu(): void
    {
        $this->assertDecision(Decision::ASK_DETAILS, false, $this->decide(['jenis' => 'aduan'], terms: ResponsePolicy::MIN_COMPLAINT_TERMS - 1));
    }

    public function test_aduan_dengan_portal_berpelacak_dirujuk(): void
    {
        $portal = new Portal(['code' => 'trans-tuntas', 'track_completion' => true]);

        $this->assertDecision(Decision::REFER, true, $this->decide(['jenis' => 'aduan', 'portal' => 'trans-tuntas'], portal: $portal));
        $this->assertDecision(Decision::REFER, false, $this->decide(['jenis' => 'pribadi', 'jawaban' => ''], portal: $portal));
    }

    public function test_portal_tanpa_pelacak_tidak_merujuk_aduan(): void
    {
        $this->assertDecision(Decision::COMPLAINT, true, $this->decide(['jenis' => 'aduan'], portal: new Portal(['code' => 'ppid', 'track_completion' => false])));
    }

    public function test_informasi_kompleks_ditelaah_petugas(): void
    {
        $this->assertDecision(Decision::COMPLEX, true, $this->decide(['kompleks' => true]));
        $this->assertDecision(Decision::COMPLAINT, true, $this->decide(['jenis' => 'aduan', 'kompleks' => true]));
    }

    public function test_pribadi_dengan_dan_tanpa_sumber(): void
    {
        $this->assertDecision(Decision::PERSONAL, true, $this->decide(['jenis' => 'pribadi']));
        $this->assertDecision(Decision::PERSONAL, false, $this->decide(['jenis' => 'pribadi', 'jawaban' => '']));
        $this->assertDecision(Decision::PERSONAL, false, $this->decide(['jenis' => 'pribadi'], collect()));
    }

    public function test_tidak_jelas_dan_lainnya(): void
    {
        $this->assertDecision(Decision::UNCLEAR, false, $this->decide(['jenis' => 'tidak_jelas']));
        $this->assertDecision(Decision::OUT_OF_SCOPE, false, $this->decide(['jenis' => 'lainnya']));
    }

    public function test_menunggu_petugas_hanya_menjawab_yang_bersumber_atau_sapaan(): void
    {
        $wait = fn (array $r, ?Collection $c = null) => $this->policy->decideWhileWaiting($this->outcome($r), $c ?? $this->cited('belum_diketahui'))->type;

        $this->assertSame(Decision::ANSWER, $wait([]));
        $this->assertSame(Decision::ANSWER, $wait(['jenis' => 'aduan']));
        $this->assertSame(Decision::RECEIPT, $wait([], collect()));
        $this->assertSame(Decision::RECEIPT, $wait(['perlu_petugas' => true]));
        $this->assertSame(Decision::RECEIPT, $wait(['angka_tanpa_dasar' => ['49']]));
        $this->assertSame(Decision::RECEIPT, $wait(['jenis' => 'tidak_jelas']));
        $this->assertSame(Decision::OUT_OF_SCOPE, $wait(['jenis' => 'lainnya', 'jawaban' => 'Halo!']));
        $this->assertSame(Decision::RECEIPT, $wait(['jenis' => 'lainnya', 'jawaban' => '']));
    }

    public function test_sumber_dikutip_hanya_nomor_yang_dikirim_tanpa_duplikat(): void
    {
        $sources = collect([new KnowledgeArticle(['title' => 'A']), new KnowledgeArticle(['title' => 'B'])]);

        $cited = ResponsePolicy::cited(['sumber' => [2, 2, 7, 1]], $sources);

        $this->assertSame([2 => 'B', 1 => 'A'], $cited->map->title->all());
    }
}
