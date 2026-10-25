<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sumber Resmi: halaman situs Kementerian Transmigrasi dan berkas yang
 * diunggah, dipotong menjadi kutipan yang dapat langsung dirujuk asisten AI.
 * - knowledge_sources  : satu situs/halaman (diambil berkala) atau satu berkas unggahan.
 * - knowledge_passages : potongan teks beserta alamat & halaman asalnya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('knowledge_sources', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 20); // situs|berkas
            $table->string('name');
            $table->string('url', 1000)->nullable();
            $table->foreignId('knowledge_document_id')->nullable()->unique()->constrained()->cascadeOnDelete();
            $table->boolean('follow_links')->default(false);
            $table->boolean('is_active')->default(true);
            $table->boolean('public_file')->default(true);
            $table->string('status', 20)->default('antre'); // antre|diproses|siap|gagal
            $table->text('error')->nullable();
            $table->unsignedInteger('pages_count')->default(0);
            $table->unsignedInteger('passages_count')->default(0);
            $table->unsignedInteger('used_count')->default(0);
            $table->string('content_hash', 64)->nullable();
            $table->timestamp('fetched_at')->nullable();
            $table->timestamp('changed_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('knowledge_passages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('knowledge_source_id')->constrained()->cascadeOnDelete();
            $table->string('url', 1000)->nullable();
            $table->string('title')->nullable();
            $table->string('heading')->nullable();
            $table->unsignedInteger('page')->nullable();
            $table->text('body');
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_passages');
        Schema::dropIfExists('knowledge_sources');
    }
};
