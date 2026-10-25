<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;

/**
 * Sumber Resmi yang dikutip langsung oleh asisten AI: halaman situs
 * Kementerian Transmigrasi (diambil ulang berkala) atau berkas unggahan.
 * Hanya sumber aktif yang kutipannya dipakai.
 */
class KnowledgeSource extends Model
{
    public const KIND_SITE = 'situs';

    public const KIND_FILE = 'berkas';

    public const STATUS_QUEUED = 'antre';

    public const STATUS_PROCESSING = 'diproses';

    public const STATUS_READY = 'siap';

    public const STATUS_FAILED = 'gagal';

    /** Kunci cache indeks kutipan (dipakai pencarian). */
    public const CACHE_KEY = 'knowledge:passages';

    protected $fillable = [
        'kind',
        'name',
        'url',
        'knowledge_document_id',
        'follow_links',
        'is_active',
        'public_file',
        'status',
        'error',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'follow_links' => 'boolean',
            'is_active' => 'boolean',
            'public_file' => 'boolean',
            'pages_count' => 'integer',
            'passages_count' => 'integer',
            'used_count' => 'integer',
            'fetched_at' => 'datetime',
            'changed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        $forget = fn () => Cache::forget(self::CACHE_KEY);
        static::saved($forget);
        static::deleted($forget);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function passages(): HasMany
    {
        return $this->hasMany(KnowledgePassage::class)->orderBy('position');
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(KnowledgeDocument::class, 'knowledge_document_id');
    }

    public function isSite(): bool
    {
        return $this->kind === self::KIND_SITE;
    }

    /** Berkas unggahan yang boleh dibuka warga dari tautan sumber. */
    public function publicFileUrl(): ?string
    {
        return $this->kind === self::KIND_FILE && $this->public_file && $this->is_active
            ? "/sumber/berkas/{$this->id}"
            : null;
    }
}
