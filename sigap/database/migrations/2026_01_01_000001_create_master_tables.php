<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Master kategori aduan
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique();
            $table->string('slug', 100)->unique();
            $table->string('priority_default', 20)->default('umum');
            $table->smallInteger('sla_days')->default(14);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Master kawasan transmigrasi (data spasial dummy dulu — PRD D9)
        Schema::create('regions', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->string('name', 150);
            $table->string('province', 100)->nullable();
            $table->decimal('latitude', 10, 6)->nullable();
            $table->decimal('longitude', 10, 6)->nullable();
            $table->json('geometry')->nullable(); // slot GeoJSON, null selama dummy
            $table->string('infrastructure_status', 50)->nullable();
            $table->integer('kk_count')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Master kanal pengaduan
        Schema::create('channels', function (Blueprint $table) {
            $table->id();
            $table->string('type', 20);
            $table->string('name', 120);
            $table->string('account_name', 120)->nullable();
            $table->string('url', 500)->nullable();
            $table->string('status', 30)->default('aktif');
            $table->json('config')->nullable(); // endpoint/key integrasi (stub adapter D7)
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();
        });

        // Konfigurasi key-value (SLA, EWS, notifikasi, kategori aktif)
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 100)->unique();
            $table->json('value')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
        Schema::dropIfExists('channels');
        Schema::dropIfExists('regions');
        Schema::dropIfExists('categories');
    }
};
