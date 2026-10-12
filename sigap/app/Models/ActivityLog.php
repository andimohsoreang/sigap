<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Jejak audit tindakan admin (PRD SEC-08).
 *
 * Retensi (D-01): log berumur lebih dari 1 tahun dihapus oleh `model:prune`.
 */
class ActivityLog extends Model
{
    use Prunable;

    protected $fillable = [
        'user_id',
        'username',
        'action',
        'subject_type',
        'subject_id',
        'description',
        'properties',
        'ip_address',
        'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'properties' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Log yang sudah melewati masa retensi 1 tahun. */
    public function prunable(): Builder
    {
        return static::query()->where('created_at', '<', now()->subYear());
    }
}
