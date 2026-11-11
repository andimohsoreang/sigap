<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Survey extends Model
{
    /** Versi 1: bintang 1–5 (lama). Versi 2: kuesioner skala 1–4 (SurveyQuestionnaire). */
    protected $fillable = [
        'ticket_id',
        'version',
        'rating',
        'comment',
        'answers',
        'overall',
        'resolved',
        'reuse',
        'good_feedback',
        'improve_feedback',
        'age_group',
        'education',
        'occupation',
        'skm_index',
    ];

    protected $attributes = [
        'version' => 1,
    ];

    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'rating' => 'integer',
            'answers' => 'array',
            'overall' => 'integer',
            'reuse' => 'integer',
            'skm_index' => 'decimal:2',
        ];
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }
}
