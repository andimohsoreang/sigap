<?php

namespace App\Modules\Assistant;

use App\Models\KnowledgeArticle;
use App\Models\KnowledgePassage;
use App\Models\Portal;
use Illuminate\Support\Collection;

/**
 * Aturan balasan TARA sebagai fungsi murni (PRD-AI FR-AI-05): tanpa database
 * dan tanpa model. Masukannya hasil {@see Consultation::consult()} dan data
 * yang sudah dimuat; keluarannya {@see Decision}.
 *
 * @phpstan-type Result array{jenis: string, jawaban: string, sumber: list<int>, beda_sumber: bool, kebijakan: bool, portal: string|null, perlu_petugas: bool, alasan_petugas: string|null, kompleks: bool, ringkasan: string, angka_tanpa_dasar: list<string>}
 */
final class ResponsePolicy
{
    /** Aduan dengan kata bermakna sesedikit ini ("saya mau melapor masalah") ditanya detailnya dulu. */
    public const MIN_COMPLAINT_TERMS = 3;

    /**
     * Percakapan masih dilayani TARA.
     *
     * @param  Result  $result
     * @param  Collection<int, KnowledgeArticle|KnowledgePassage>  $cited  sumber yang dikutip ({@see cited()})
     * @param  int  $terms  jumlah kata bermakna pada teks pencarian
     */
    public function decide(array $result, Collection $cited, ?Portal $portal, int $terms): Decision
    {
        $complaint = in_array($result['jenis'], ['aduan', 'pribadi'], true);
        $sourced = $result['jawaban'] !== '' && $cited->isNotEmpty();

        // Angka di jawaban tidak ada di sumber yang dikutip maupun pesan warga
        // (FR-AI-12): jawaban tidak dikirim. Aduan/urusan pribadi tetap
        // diteruskan lewat alurnya sendiri (alasan aduan/pribadi), tanpa jawaban.
        if ($result['angka_tanpa_dasar'] !== []) {
            if (! $complaint) {
                return Decision::handoff('angka_tanpa_dasar', 'angka_tanpa_dasar');
            }
            $sourced = false;
        }

        // Sumber resmi berbeda dan label dasar hukum tidak memutuskan (FR-AI-11):
        // kedua versi tetap ditampilkan, lalu dipastikan petugas.
        if (! $complaint && $this->unresolvedConflict($result, $cited)) {
            return Decision::of(Decision::CONFLICT, $sourced);
        }

        // Model kerap menandai setiap aduan "perlu petugas"; aduan dan urusan
        // pribadi sudah diteruskan oleh alurnya sendiri di bawah.
        if ($result['perlu_petugas'] && ! $complaint) {
            return Decision::handoff('diminta');
        }

        // Niat melapor tanpa detail: tanya dulu masalahnya.
        if ($complaint && $terms < self::MIN_COMPLAINT_TERMS) {
            return Decision::of(Decision::ASK_DETAILS);
        }

        // Aduan/urusan pribadi yang dilayani portal lain: dirujuk dengan pengantar.
        if ($portal?->track_completion && $complaint) {
            return Decision::of(Decision::REFER, $sourced);
        }

        // Informasi yang tidak tuntas dengan ketentuan umum: ditelaah petugas.
        if ($result['kompleks'] && $result['jenis'] === 'informasi') {
            return Decision::of(Decision::COMPLEX, $sourced);
        }

        return match ($result['jenis']) {
            'aduan' => Decision::of(Decision::COMPLAINT, $sourced),
            'pribadi' => Decision::of(Decision::PERSONAL, $sourced),
            'tidak_jelas' => Decision::of(Decision::UNCLEAR),
            'lainnya' => Decision::of(Decision::OUT_OF_SCOPE),
            default => Decision::of(Decision::ANSWER),
        };
    }

    /**
     * Percakapan menunggu petugas: hanya pertanyaan yang ada di sumber resmi
     * (atau sapaan) yang dijawab; selebihnya tanda terima.
     *
     * @param  Result  $result
     * @param  Collection<int, KnowledgeArticle|KnowledgePassage>  $cited
     */
    public function decideWhileWaiting(array $result, Collection $cited): Decision
    {
        $answerable = in_array($result['jenis'], ['informasi', 'aduan', 'pribadi'], true) && ! $result['perlu_petugas']
            && $result['angka_tanpa_dasar'] === [];
        if ($answerable && $result['jawaban'] !== '' && $cited->isNotEmpty()) {
            return Decision::of(Decision::ANSWER);
        }
        // Sapaan atau pertanyaan balik ("masalahnya apa?") tidak butuh sumber.
        if ($result['jenis'] === 'lainnya' && $result['jawaban'] !== '') {
            return Decision::of(Decision::OUT_OF_SCOPE);
        }

        return Decision::of(Decision::RECEIPT);
    }

    /**
     * Sumber yang benar-benar dikutip AI, dengan nomor seperti di jawaban
     * (agar [n] cocok dengan daftar sumber). Nomor di luar yang dikirim dibuang.
     *
     * @param  array{sumber: list<int>}  $result
     * @param  Collection<int, KnowledgeArticle|KnowledgePassage>  $sources
     * @return Collection<int, KnowledgeArticle|KnowledgePassage>
     */
    public static function cited(array $result, Collection $sources): Collection
    {
        return collect($result['sumber'])
            ->unique()
            ->mapWithKeys(fn (int $no) => [$no => $sources->values()->get($no - 1)])
            ->filter();
    }

    /**
     * Sumber berbeda yang belum terputuskan: model menyatakannya, atau model
     * menandai beda sumber padahal label dasar hukum sumber yang dikutipnya
     * tidak memutuskan. Pengaman ini memastikan model tidak memilih sendiri.
     *
     * @param  array{beda_sumber: bool, perlu_petugas: bool, alasan_petugas: string|null}  $result
     * @param  Collection<int, KnowledgeArticle|KnowledgePassage>  $cited
     */
    public function unresolvedConflict(array $result, Collection $cited): bool
    {
        if ($result['perlu_petugas'] && $result['alasan_petugas'] === 'sumber_berbeda') {
            return true;
        }

        return $result['beda_sumber'] && $cited->count() > 1 && ! self::basisDecides($cited);
    }

    /**
     * Label dasar hukum memutuskan bila setiap sumber berlabel dan ada yang
     * BERLAKU sekaligus yang DIGANTI. Kutipan memakai label Sumber Resminya.
     *
     * @param  Collection<int, KnowledgeArticle|KnowledgePassage>  $sources
     */
    public static function basisDecides(Collection $sources): bool
    {
        $statuses = $sources->map(fn (KnowledgeArticle|KnowledgePassage $s) => ($s instanceof KnowledgePassage ? $s->source : $s)?->status_dasar
            ?? KnowledgeArticle::DASAR_BELUM_DIKETAHUI);

        return ! $statuses->contains(KnowledgeArticle::DASAR_BELUM_DIKETAHUI)
            && $statuses->contains(KnowledgeArticle::DASAR_BERLAKU)
            && $statuses->contains(KnowledgeArticle::DASAR_DIGANTI);
    }
}
