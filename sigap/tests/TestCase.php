<?php

namespace Tests;

use App\Support\SurveyQuestionnaire;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Isian survei kepuasan yang sah (semua aspek bernilai $nilai, skala 1–4).
     *
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    protected function surveyPayload(int $nilai = 4, array $extra = []): array
    {
        return array_replace([
            'jawaban' => array_fill_keys(array_keys(SurveyQuestionnaire::ASPECTS), $nilai),
            'keseluruhan' => $nilai,
            'teratasi' => 'penuh',
            'kembali' => $nilai,
        ], $extra);
    }
}
