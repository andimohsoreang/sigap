<?php

namespace App\Models;

use App\Enums\TicketImpact;
use App\Enums\TicketPriority;
use App\Enums\TicketStatus;
use App\Enums\TicketVisibility;
use App\Support\Nik;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Ticket extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * Pola nomor tiket yang diterima pada pencarian publik (A-03):
     * format baru `TKT-YYMMDD-XXXXXX` dan format lama `TKT-<n>`.
     */
    public const NUMBER_PATTERN = '/^TKT-(\d{1,10}|\d{6}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6})$/';

    /**
     * Format lama `TKT-<n>` berurutan sehingga mudah di-enumerasi. Pada
     * pencarian publik oleh tamu, nomor format lama WAJIB disertai kode
     * akses (`lookup_token`); pemilik tiket & admin berwenang tidak perlu.
     */
    public const LEGACY_NUMBER_PATTERN = '/^TKT-\d{1,10}$/';

    /** Alfabet sufiks acak nomor tiket (tanpa 0/O/1/I/L agar mudah dibaca). */
    public const NUMBER_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

    /** Panjang kode akses pelacakan (alfabet sama dengan nomor tiket). */
    public const LOOKUP_TOKEN_LENGTH = 8;

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
        'reporter_nip',
        'reporter_unit',
        'location',
        'source',
        'source_url',
        'received_by',
        'sla_due_at',
        'responded_at',
        'resolved_at',
        'ews_notified_at',
    ];

    protected $hidden = [
        'reporter_nik',
        'reporter_nik_hash',
        'lookup_token',
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
            'ews_notified_at' => 'datetime',
            // D-01: NIK pelapor dienkripsi; pencarian memakai reporter_nik_hash.
            'reporter_nik' => 'encrypted',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Ticket $ticket) {
            if (empty($ticket->lookup_token)) {
                $ticket->lookup_token = self::generateLookupToken();
            }
        });

        static::saving(function (Ticket $ticket) {
            if ($ticket->isDirty('reporter_nik')) {
                $ticket->reporter_nik_hash = Nik::hash($ticket->reporter_nik);
            }
        });
    }

    /** Normalisasi nomor tiket dari input pengguna (trim + huruf besar). */
    public static function normalizeNo(?string $ticketNo): string
    {
        return strtoupper(trim((string) $ticketNo));
    }

    /** Nomor tiket format lama `TKT-<n>` (butuh kode akses untuk tamu). */
    public static function isLegacyNo(?string $ticketNo): bool
    {
        return (bool) preg_match(self::LEGACY_NUMBER_PATTERN, self::normalizeNo($ticketNo));
    }

    /** Kode akses acak kriptografis untuk pelacakan publik. */
    public static function generateLookupToken(): string
    {
        $alphabet = self::NUMBER_ALPHABET;
        $max = strlen($alphabet) - 1;
        $token = '';

        for ($i = 0; $i < self::LOOKUP_TOKEN_LENGTH; $i++) {
            $token .= $alphabet[random_int(0, $max)];
        }

        return $token;
    }

    /** Bandingkan kode akses secara constant-time (huruf kecil diterima). */
    public function matchesLookupToken(?string $code): bool
    {
        $code = strtoupper(trim((string) $code));

        return $code !== '' && is_string($this->lookup_token) && hash_equals($this->lookup_token, $code);
    }

    /** Nomor tiket berformat sah untuk pelacakan publik. */
    public static function isValidNo(?string $ticketNo): bool
    {
        return (bool) preg_match(self::NUMBER_PATTERN, self::normalizeNo($ticketNo));
    }

    /** Route model binding `{ticket:ticket_no}` menerima huruf kecil. */
    public function resolveRouteBinding($value, $field = null)
    {
        if (($field ?? $this->getRouteKeyName()) === 'ticket_no') {
            $value = self::normalizeNo((string) $value);
        }

        return parent::resolveRouteBinding($value, $field);
    }

    /**
     * Nama tersamar untuk tampilan publik (A-02): huruf pertama tiap kata +
     * "***", mis. "Budi Santoso" -> "B*** S***".
     */
    public static function maskName(?string $name): ?string
    {
        $parts = preg_split('/\s+/u', trim((string) $name)) ?: [];
        $parts = array_values(array_filter($parts, fn ($p) => $p !== ''));

        if ($parts === []) {
            return null;
        }

        return implode(' ', array_map(
            fn (string $p) => mb_strtoupper(mb_substr($p, 0, 1)).'***',
            $parts,
        ));
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
        return Nik::mask($this->reporter_nik);
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
     *
     * A-05: admin kawasan TANPA region_id tidak melihat tiket apa pun
     * (sebelumnya `where region_id = null` tidak terduga perilakunya).
     */
    public function scopeVisibleTo($query, User $user)
    {
        if ($user->isSuperAdmin()) {
            return $query;
        }

        if ($user->isAdmin()) {
            if ($user->region_id === null) {
                return $query->whereRaw('1 = 0');
            }

            return $query->where('region_id', $user->region_id);
        }

        return $query->where('reporter_id', $user->id);
    }
}
