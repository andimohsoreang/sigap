<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Master Unit Kerja (PRD-UNIT-KERJA F1). Aditif: kolom teks lama `users.unit`
 * dan `tickets.reporter_unit` tetap ada; kolom FK baru menyusul di sampingnya.
 * Unit tidak pernah dihapus (dinonaktifkan) agar riwayat tetap merujuk unitnya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('units', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->string('name', 200);
            $table->string('short_name', 60)->nullable();
            $table->foreignId('parent_id')->nullable()->constrained('units')->restrictOnDelete();
            $table->string('level', 20)->default('lainnya');
            $table->string('email', 150)->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();

            $table->index(['parent_id', 'sort']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('unit_id')->nullable()->after('unit')->constrained('units')->nullOnDelete();
        });

        Schema::table('tickets', function (Blueprint $table) {
            $table->foreignId('reporter_unit_id')->nullable()->after('reporter_unit')->constrained('units')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reporter_unit_id');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('unit_id');
        });

        Schema::dropIfExists('units');
    }
};
