<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ChatConversation extends Model
{
    protected $fillable = [
        'user_id',
        'guest_token',
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
}