<?php

namespace App\Models;

use App\Models\Concerns\HasLegalBasis;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Cache;

/**
 * Artikel Basis Pengetahuan. Hanya artikel berstatus `terbit` yang dipakai
 * asisten AI dan ditampilkan di FAQ publik.
 */
class KnowledgeArticle extends Model
{
    use HasLegalBasis;

    public const STATUS_DRAFT = 'draf';

    public const STATUS_REVIEW = 'ditinjau';

    public const STATUS_PUBLISHED = 'terbit';

    public const STATUSES = [self::STATUS_DRAFT, self::STATUS_REVIEW, self::STATUS_PUBLISHED];

    /** Kunci cache daftar artikel terbit (dipakai pencarian). */
    public const CACHE_KEY = 'knowledge:published';

    protected $fillable = [
        'title',
        'body',
        'category',
        'keywords',
        'source',
        'source_ref',
        'source_url',
        'status',
        'review_at',
        'knowledge_document_id',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'review_at' => 'date',
            'used_count' => 'integer',
            'helpful_count' => 'integer',
            'unhelpful_count' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        $forget = fn () => Cache::forget(self::CACHE_KEY);
        static::saved($forget);
        static::deleted($forget);
    }

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PUBLISHED);
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(KnowledgeDocument::class, 'knowledge_document_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** Label sumber untuk ditampilkan ke warga, mis. "Pedoman Seleksi · Hal. 12". */
    public function sourceLabel(): ?string
    {
        $label = collect([$this->source, $this->source_ref])->filter()->implode(' · ');

        return $label !== '' ? $label : null;
    }

    public function isOverdueForReview(): bool
    {
        return $this->review_at !== null && $this->review_at->isPast() && ! $this->review_at->isToday();
    }
}
