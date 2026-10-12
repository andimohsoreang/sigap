<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Region extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'province',
        'latitude',
        'longitude',
        'geometry',
        'infrastructure_status',
        'kk_count',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'geometry' => 'array',
            'kk_count' => 'integer',
            'is_active' => 'boolean',
        ];
    }
}
