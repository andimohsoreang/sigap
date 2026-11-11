<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu disposisi tiket ke Unit Kerja (PRD-UNIT-KERJA §5). Riwayat tidak
 * pernah dihapus; disposisi yang dialihkan/ditarik ditutup dengan statusnya.
 */
class TicketDisposition extends Model
{
    public const STATUS_WAITING = 'menunggu';

    public const STATUS_ACCEPTED = 'diterima';

    public const STATUS_RETURNED = 'dikembalikan';

    public const STATUS_WITHDRAWN = 'ditarik';

    public const STATUS_DONE = 'selesai';

    /** Disposisi yang masih berjalan (paling banyak satu per tiket). */
    public const ACTIVE = [self::STATUS_WAITING, self::STATUS_ACCEPTED];

    public const LABELS = [
        self::STATUS_WAITING => 'Menunggu diterima',
        self::STATUS_ACCEPTED => 'Diproses unit',
        self::STATUS_RETURNED => 'Dikembalikan',
        self::STATUS_WITHDRAWN => 'Ditarik',
        self::STATUS_DONE => 'Selesai',
    ];

    protected $fillable = [
        'ticket_id',
        'unit_id',
        'assigned_by',
        'accepted_by',
        'closed_by',
        'status',
        'note',
        'due_at',
        'accepted_at',
        'closed_at',
        'return_reason',
    ];

    protected function casts(): array
    {
        return [
            'due_at' => 'datetime',
            'accepted_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function assigner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function acceptor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accepted_by');
    }

    public function closer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', self::ACTIVE);
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::ACTIVE, true);
    }

    public function label(): string
    {
        return self::LABELS[$this->status] ?? $this->status;
    }
}
