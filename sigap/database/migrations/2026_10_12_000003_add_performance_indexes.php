<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * D-04: index untuk kueri yang sering dipakai + FK users.region_id.
     * Index yang sudah ada dilewati agar migrasi aman dijalankan ulang.
     *
     * @var array<string, array<int, string>>
     */
    private array $indexes = [
        'tickets' => ['created_at', 'reporter_id', 'assignee_id', 'channel_id'],
        'chat_conversations' => ['guest_token', 'user_id'],
        'users' => ['region_id'],
    ];

    public function up(): void
    {
        foreach ($this->indexes as $table => $columns) {
            foreach ($columns as $column) {
                if (! Schema::hasIndex($table, [$column])) {
                    Schema::table($table, fn (Blueprint $t) => $t->index($column));
                }
            }
        }

        if (! $this->hasRegionForeignKey()) {
            // Bersihkan referensi yatim sebelum constraint dipasang.
            DB::table('users')
                ->whereNotNull('region_id')
                ->whereNotIn('region_id', DB::table('regions')->select('id'))
                ->update(['region_id' => null]);

            Schema::table('users', function (Blueprint $table) {
                $table->foreign('region_id')->references('id')->on('regions')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if ($this->hasRegionForeignKey()) {
            Schema::table('users', fn (Blueprint $t) => $t->dropForeign(['region_id']));
        }

        foreach ($this->indexes as $table => $columns) {
            foreach ($columns as $column) {
                $name = $table.'_'.$column.'_index';

                if (Schema::hasIndex($table, $name)) {
                    Schema::table($table, fn (Blueprint $t) => $t->dropIndex($name));
                }
            }
        }
    }

    private function hasRegionForeignKey(): bool
    {
        foreach (Schema::getForeignKeys('users') as $fk) {
            if ($fk['columns'] === ['region_id']) {
                return true;
            }
        }

        return false;
    }
};
