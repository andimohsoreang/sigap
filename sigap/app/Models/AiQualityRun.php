<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Ringkasan satu uji kualitas Asisten (`sigap:uji-asisten --simpan`) — PRD-AI
 * FR-AI-07/08. Hanya angka; pertanyaan paket uji ada di
 * database/data/uji-asisten.php dan jawaban model tidak disimpan.
 *
 * @property string|null $model
 * @property bool $with_model
 * @property bool|null $passed
 * @property int $retrieval_hits
 * @property int $retrieval_total
 * @property int $classification_hits
 * @property int $classification_total
 * @property int $unsourced
 * @property int $failed_calls
 * @property int $number_rejections
 * @property int|null $median_ms
 * @property int|null $p95_ms
 * @property string|null $failures
 * @property int $duration_s
 */
class AiQualityRun extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'model', 'with_model', 'passed', 'retrieval_hits', 'retrieval_total',
        'classification_hits', 'classification_total', 'unsourced', 'failed_calls',
        'number_rejections', 'median_ms', 'p95_ms', 'failures', 'duration_s',
    ];

    protected function casts(): array
    {
        return [
            'with_model' => 'boolean',
            'passed' => 'boolean',
            'retrieval_hits' => 'integer',
            'retrieval_total' => 'integer',
            'classification_hits' => 'integer',
            'classification_total' => 'integer',
            'unsourced' => 'integer',
            'failed_calls' => 'integer',
            'number_rejections' => 'integer',
            'median_ms' => 'integer',
            'p95_ms' => 'integer',
            'duration_s' => 'integer',
        ];
    }
}
