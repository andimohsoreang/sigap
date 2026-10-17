<?php

namespace App\Models;

use App\Enums\UserRole;
use App\Support\Nik;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'nik',
        'username',
        'name',
        'email',
        'phone',
        'role',
        'region_id',
        'unit',
        'is_active',
        'password',
    ];

    /** Nilai default model baru (sama dengan default kolom DB). */
    protected $attributes = [
        'is_active' => true,
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'nik',
        'nik_hash',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'is_active' => 'boolean',
            // D-01: NIK dienkripsi; login/pencarian memakai nik_hash.
            'nik' => 'encrypted',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (User $user) {
            if ($user->isDirty('nik')) {
                $user->nik_hash = Nik::hash($user->nik);
            }
        });
    }

    /** Cari pengguna berdasarkan NIK lewat blind index. */
    public static function findByNik(string $nik): ?self
    {
        return static::query()->where('nik_hash', Nik::hash($nik))->first();
    }

    /** NIK tersamar untuk tampilan. */
    public function maskedNik(): ?string
    {
        return Nik::mask($this->nik);
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }

    /** Rujukan portal yang menjadi tanggung jawab admin ini. */
    public function assignedReferrals(): HasMany
    {
        return $this->hasMany(Referral::class, 'assigned_to');
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class, 'reporter_id');
    }

    public function isAdmin(): bool
    {
        return $this->role instanceof UserRole && $this->role->isAdmin();
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === UserRole::SuperAdmin;
    }
}
