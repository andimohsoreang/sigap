<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChannelSyncLog extends Model
{
    protected $fillable = [
        'channel_id',
        'channel',
        'pulled_count',
        'status',
        'message',
    ];

    protected function casts(): array
    {
        return [
            'pulled_count' => 'integer',
        ];
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }
}