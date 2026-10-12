<?php

namespace App\Models;

use App\Enums\ChannelType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Channel extends Model
{
    protected $fillable = [
        'type',
        'name',
        'account_name',
        'url',
        'status',
        'config',
        'last_synced_at',
    ];

    protected function casts(): array
    {
        return [
            'type' => ChannelType::class,
            'config' => 'array',
            'last_synced_at' => 'datetime',
        ];
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class);
    }
}
