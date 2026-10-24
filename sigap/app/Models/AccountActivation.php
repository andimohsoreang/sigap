<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Tautan sekali pakai untuk warga yang didaftarkan petugas: warga membuat
 * kata sandi sendiri lewat tautan ini (dikirim ke chat). Hanya hash token
 * yang disimpan.
 */
class AccountActivation extends Model
{
    /** Akun baru yang didaftarkan petugas: warga membuat kata sandi pertama. */
    public const PURPOSE_ACTIVATION = 'aktivasi';

    /** Lupa kata sandi: petugas mencocokkan identitas lewat chat lalu mengirim tautan. */
    public const PURPOSE_RECOVERY = 'pemulihan';

    protected $fillable = [
        'user_id',
        'conversation_id',
        'created_by',
        'purpose',
        'token_hash',
        'expires_at',
        'used_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function findUsable(string $token): ?self
    {
        return static::query()
            ->with('user')
            ->where('token_hash', self::hashToken($token))
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->first();
    }

    public function isRecovery(): bool
    {
        return $this->purpose === self::PURPOSE_RECOVERY;
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(ChatConversation::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
