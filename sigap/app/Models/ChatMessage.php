<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatMessage extends Model
{
    protected $fillable = [
        'conversation_id',
        'sender_id',
        'sender_type',
        'body',
        'meta',
        'feedback',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
            'meta' => 'array',
            'feedback' => 'integer',
        ];
    }

    /** Jenis pesan asisten/sistem (jawaban, tidak_tahu, status_tiket, diteruskan, …). */
    public function kind(): ?string
    {
        return $this->meta['kind'] ?? null;
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(ChatConversation::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }
}
