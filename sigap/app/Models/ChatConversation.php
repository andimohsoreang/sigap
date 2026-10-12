<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Percakapan live chat.
 *
 * Retensi (D-01): percakapan TAMU (tanpa akun) yang tidak aktif lebih dari
 * 180 hari dihapus oleh `model:prune` (pesan ikut terhapus via cascade).
 */
class ChatConversation extends Model
{
    use Prunable;

    protected $fillable = [
        'user_id',
        'guest_token',
        'guest_name',
        'subject',
        'last_message_at',
        'unread_admin',
        'unread_user',
    ];

    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
            'unread_admin' => 'integer',
            'unread_user' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(ChatMessage::class, 'conversation_id')->orderBy('created_at');
    }

    /** Nama penanya untuk ditampilkan ke petugas. */
    public function participantName(): string
    {
        return $this->user?->name ?? $this->guest_name ?? 'Tamu';
    }

    /** Jumlah pesan belum dibaca petugas di seluruh percakapan (badge sidebar). */
    public static function unreadForAdmins(): int
    {
        return (int) static::query()->sum('unread_admin');
    }

    public function prunable(): Builder
    {
        $cutoff = now()->subDays(180);

        return static::query()
            ->whereNull('user_id')
            ->where(fn ($q) => $q
                ->where('last_message_at', '<', $cutoff)
                ->orWhere(fn ($q) => $q->whereNull('last_message_at')->where('created_at', '<', $cutoff)));
    }
}
