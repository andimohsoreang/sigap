<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;

/**
 * Portal Kementerian Transmigrasi yang dapat dirujuk contact center.
 *
 * - audience `internal` (TC-More, TransCloud, …) tidak pernah ditawarkan ke
 *   warga.
 * - `track_completion` = rujukan ke portal ini punya petugas penanggung jawab
 *   sampai warga mengirim bukti (mis. kode tracking Trans Tuntas).
 */
class Portal extends Model
{
    public const AUDIENCE_PUBLIC = 'publik';

    public const AUDIENCE_INTERNAL = 'internal';

    public const CACHE_KEY = 'portals:public';

    protected $fillable = [
        'code',
        'name',
        'url',
        'action_url',
        'action_label',
        'audience',
        'purpose',
        'description',
        'keywords',
        'steps',
        'prepare',
        'proof_label',
        'track_completion',
        'managed_by',
        'contact',
        'is_active',
        'sort',
    ];

    protected function casts(): array
    {
        return [
            'track_completion' => 'boolean',
            'is_active' => 'boolean',
            'is_reachable' => 'boolean',
            'last_checked_at' => 'datetime',
            'sort' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        $forget = fn () => Cache::forget(self::CACHE_KEY);
        static::saved($forget);
        static::deleted($forget);
    }

    public function scopePublicActive(Builder $query): Builder
    {
        return $query->where('is_active', true)->where('audience', self::AUDIENCE_PUBLIC);
    }

    public function referrals(): HasMany
    {
        return $this->hasMany(Referral::class);
    }

    public function isPublic(): bool
    {
        return $this->audience === self::AUDIENCE_PUBLIC;
    }

    /** Tujuan tombol utama pengantar: halaman layanan bila ada, selain itu beranda portal. */
    public function destination(): string
    {
        return $this->action_url ?: $this->url;
    }

    public function host(): string
    {
        return (string) parse_url($this->destination(), PHP_URL_HOST);
    }

    /** @return list<string> */
    public function stepList(): array
    {
        return self::lines($this->steps);
    }

    /** @return list<string> */
    public function prepareList(): array
    {
        return self::lines($this->prepare);
    }

    /** Kartu portal untuk chat (aman untuk publik). */
    public function card(): array
    {
        return [
            'kode' => $this->code,
            'nama' => $this->name,
            'kegunaan' => $this->purpose,
            'url' => $this->destination(),
            'tombol' => $this->action_label ?: 'Buka '.$this->name,
            'domain' => $this->host(),
            'tersedia' => $this->is_reachable,
        ];
    }

    /** @return list<string> */
    private static function lines(?string $text): array
    {
        return array_values(array_filter(array_map('trim', preg_split('/\R/', (string) $text) ?: [])));
    }
}
