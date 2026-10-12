<?php

namespace App\Support;

/**
 * Pencarian teks yang konsisten di SQLite & PostgreSQL (D-03).
 *
 * - Tidak peka huruf besar/kecil: LOWER(kolom) LIKE LOWER(term).
 * - Karakter wildcard `%` dan `_` dari input pengguna di-escape sehingga
 *   diperlakukan sebagai karakter biasa.
 */
final class Search
{
    private const ESCAPE = '!';

    /**
     * Tambahkan klausa OR-LIKE untuk beberapa kolom (nama kolom HARUS berasal
     * dari kode, bukan dari input pengguna).
     *
     * @param  array<int, string>  $columns
     */
    public static function apply($query, array $columns, string $term)
    {
        $term = trim($term);

        if ($term === '') {
            return $query;
        }

        $pattern = '%'.self::escape(mb_strtolower($term)).'%';

        return $query->where(function ($q) use ($columns, $pattern) {
            foreach ($columns as $column) {
                $q->orWhereRaw('LOWER('.$column.') LIKE ? ESCAPE \''.self::ESCAPE.'\'', [$pattern]);
            }
        });
    }

    public static function escape(string $value): string
    {
        return str_replace(
            [self::ESCAPE, '%', '_'],
            [self::ESCAPE.self::ESCAPE, self::ESCAPE.'%', self::ESCAPE.'_'],
            $value,
        );
    }
}
