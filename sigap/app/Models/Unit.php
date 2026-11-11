<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Unit Kerja Kementerian Transmigrasi (PRD-UNIT-KERJA). Disusun induk–anak
 * (Eselon I → Eselon II). Unit yang belum dipakai boleh dihapus; yang sudah
 * dipakai petugas atau tiket hanya dinonaktifkan.
 */
class Unit extends Model
{
    public const LEVEL_ESELON_1 = 'eselon_1';

    public const LEVEL_ESELON_2 = 'eselon_2';

    public const LEVEL_OTHER = 'lainnya';

    public const LEVELS = [
        self::LEVEL_ESELON_1 => 'Eselon I',
        self::LEVEL_ESELON_2 => 'Eselon II',
        self::LEVEL_OTHER => 'Lainnya',
    ];

    protected $fillable = [
        'code',
        'name',
        'short_name',
        'parent_id',
        'level',
        'email',
        'is_active',
        'sort',
    ];

    protected $attributes = [
        'level' => self::LEVEL_OTHER,
        'is_active' => true,
        'sort' => 0,
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'sort' => 'integer',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'unit_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function displayName(): string
    {
        return $this->short_name ?: $this->name;
    }

    /**
     * Id unit ini beserta seluruh turunannya. Dipakai untuk menolak induk yang
     * akan membuat lingkaran (unit menjadi anak dari turunannya sendiri).
     *
     * @return list<int>
     */
    public function selfAndDescendantIds(): array
    {
        $ids = [$this->id];
        $frontier = [$this->id];

        while ($frontier !== []) {
            $frontier = self::query()->whereIn('parent_id', $frontier)->pluck('id')->all();
            $frontier = array_values(array_diff($frontier, $ids));
            $ids = [...$ids, ...$frontier];
        }

        return $ids;
    }

    /**
     * Unit aktif dalam urutan pohon (induk lalu anak-anaknya), untuk pilihan
     * di formulir. `depth` dipakai tampilan untuk indentasi.
     *
     * @return list<array{id: int, name: string, depth: int}>
     */
    public static function activeTree(): array
    {
        $units = self::query()->active()->orderBy('sort')->orderBy('name')->get(['id', 'name', 'parent_id']);
        $byParent = $units->groupBy(fn (self $u) => $u->parent_id ?? 0);
        $ids = $units->pluck('id')->all();
        $rows = [];

        $walk = function (int $parent, int $depth) use (&$walk, &$rows, $byParent): void {
            foreach ($byParent[$parent] ?? [] as $unit) {
                $rows[] = ['id' => $unit->id, 'name' => $unit->name, 'depth' => $depth];
                $walk($unit->id, $depth + 1);
            }
        };

        $walk(0, 0);
        // Unit aktif yang induknya nonaktif tetap bisa dipilih (ditaruh di akar).
        foreach ($units as $unit) {
            if ($unit->parent_id !== null && ! in_array($unit->parent_id, $ids, true)) {
                $rows[] = ['id' => $unit->id, 'name' => $unit->name, 'depth' => 0];
                $walk($unit->id, 1);
            }
        }

        return $rows;
    }
}
