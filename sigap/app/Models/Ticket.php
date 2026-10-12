<?php

namespace App\Models;

use App\Enums\TicketImpact;
use App\Enums\TicketPriority;
use App\Enums\TicketStatus;
use App\Enums\TicketVisibility;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Ticket extends Model
{
    use HasFactory;

    protected $fillable = [
        'ticket_no',
        'title',
        'description',
        'status',
        'priority',
        'impact',
        'visibility',
        'latitude',
        'longitude',
        'attachment_path',
        'is_internal',
        'category_id',
        'region_id',
        'channel_id',
        'assignee_id',
        'reporter_id',
        'reporter_name',
        'reporter_nik',
        'reporter_email',
        'reporter_phone',
        'sla_due_at',
        'responded_at',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => TicketStatus::class,
            'priority' => TicketPriority::class,
            'impact' => TicketImpact::class,
            'visibility' => TicketVisibility::class,
            'latitude' => 'float',
            'longitude' => 'float',
            'is_internal' => 'boolean',
            'sla_due_at' => 'datetime',
            'responded_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id');
    }

    public function histories(): HasMany
    {
        return $this->hasMany(TicketHistory::class)->orderBy('created_at');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(TicketReply::class)->orderBy('created_at');
    }

    public function survey(): HasOne
    {
        return $this->hasOne(Survey::class);
    }

    /** NIK pelapor yang disamarkan untuk tampilan publik. */
    public function maskedNik(): ?string
    {
        if (! $this->reporter_nik) {
            return null;
        }

        $nik = $this->reporter_nik;

        return substr($nik, 0, 4).str_repeat('*', 8).substr($nik, -4);
    }

    /** Tiket sudah melewati tenggat SLA. */
    public function isOverdue(): bool
    {
        return $this->sla_due_at !== null
            && $this->status instanceof TicketStatus
            && $this->status->isOpen()
            && $this->sla_due_at->isPast();
    }

    public function scopePublic($query)
    {
        return $query->where('is_internal', false);
    }

    public function scopeInternal($query)
    {
        return $query->where('is_internal', true);
    }

    /**
     * Batasi query sesuai peran (SEC-07): super admin penuh, admin kawasan
     * hanya wilayah tugasnya, warga hanya tiket miliknya.
     */
    public function scopeVisibleTo($query, User $user)
    {
        if ($user->isSuperAdmin()) {
            return $query;
        }

        if ($user->isAdmin()) {
            return $query->where('region_id', $user->region_id);
        }

        return $query->where('reporter_id', $user->id);
    }
}