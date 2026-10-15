<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Dokumen resmi (PDF) yang dirangkum AI menjadi usulan artikel. */
class KnowledgeDocument extends Model
{
    public const STATUS_PROCESSING = 'diproses';

    public const STATUS_READY = 'siap';

    public const STATUS_FAILED = 'gagal';

    protected $fillable = [
        'original_name',
        'path',
        'size',
        'pages',
        'status',
        'error',
        'proposals',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'proposals' => 'array',
            'size' => 'integer',
            'pages' => 'integer',
        ];
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function articles(): HasMany
    {
        return $this->hasMany(KnowledgeArticle::class);
    }
}
