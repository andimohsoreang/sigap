<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Rujukan warga ke portal lain (mis. aduan lahan → Trans Tuntas).
 *
 * Setiap rujukan punya SATU petugas penanggung jawab. Rujukan baru dianggap
 * selesai bila warga berhasil (kode bukti dari portal tujuan tercatat) atau
 * petugas menutupnya dengan alasan tertulis. Selama terbuka, rujukan yang
 * melewati batas tindak lanjut atau warga yang meminta bantuan muncul di
 * daftar "Perlu tindakan" milik penanggung jawabnya.
 */
class Referral extends Model
{
    /** Warga sudah diberi pengantar, belum membuka portal tujuan. */
    public const STATUS_REFERRED = 'dirujuk';

    /** Warga sudah menekan tombol ke portal tujuan. */
    public const STATUS_OPENED = 'dibuka';

    /** Warga melaporkan kendala → petugas wajib membantu. */
    public const STATUS_HELP = 'butuh_bantuan';

    /** Bukti dari portal tujuan sudah tercatat. */
    public const STATUS_DONE = 'berhasil';

    /** Ditutup petugas tanpa bukti (alasan wajib). */
    public const STATUS_FAILED = 'gagal';

    public const OPEN = [self::STATUS_REFERRED, self::STATUS_OPENED, self::STATUS_HELP];

    public const LABELS = [
        self::STATUS_REFERRED => 'Dirujuk',
        self::STATUS_OPENED => 'Portal dibuka',
        self::STATUS_HELP => 'Butuh bantuan',
        self::STATUS_DONE => 'Berhasil',
        self::STATUS_FAILED => 'Tidak berhasil',
    ];

    protected $fillable = [
        'token',
        'code',
        'portal_id',
        'conversation_id',
        'user_id',
        'citizen_name',
        'contact',
        'summary',
        'status',
        'external_ref',
        'assigned_to',
        'created_by',
        'opened_at',
        'confirmed_at',
        'follow_up_due_at',
        'reminded_at',
        'closed_at',
        'closed_by',
        'close_reason',
    ];

    protected $hidden = ['token'];

    protected function casts(): array
    {
        return [
            'contact' => 'encrypted',
            'opened_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'follow_up_due_at' => 'datetime',
            'reminded_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'code';
    }

    public function portal(): BelongsTo
    {
        return $this->belongsTo(Portal::class);
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(ChatConversation::class, 'conversation_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function events(): HasMany
    {
        return $this->hasMany(ReferralEvent::class)->orderBy('id');
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereIn('status', self::OPEN);
    }

    /** Terbuka dan (warga minta bantuan, atau batas tindak lanjut lewat). */
    public function scopeNeedsAction(Builder $query): Builder
    {
        return $query->open()->where(fn ($q) => $q
            ->where('status', self::STATUS_HELP)
            ->orWhere('follow_up_due_at', '<', now()));
    }

    public function isOpen(): bool
    {
        return in_array($this->status, self::OPEN, true);
    }

    public function needsAction(): bool
    {
        return $this->isOpen() && ($this->status === self::STATUS_HELP || ($this->follow_up_due_at !== null && $this->follow_up_due_at->isPast()));
    }

    public function label(): string
    {
        return self::LABELS[$this->status] ?? $this->status;
    }

    public function citizenName(): string
    {
        return $this->user?->name ?? $this->citizen_name ?? 'Warga';
    }

    public function publicUrl(): string
    {
        return url('/rujukan/'.$this->token);
    }
}
