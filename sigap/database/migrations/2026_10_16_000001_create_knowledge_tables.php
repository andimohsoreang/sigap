<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Basis Pengetahuan: satu-satunya sumber jawaban asisten AI.
 * - knowledge_documents : PDF resmi yang diunggah + usulan artikel dari AI.
 * - knowledge_articles  : artikel tanya-jawab (draf → ditinjau → terbit).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('knowledge_documents', function (Blueprint $table) {
            $table->id();
            $table->string('original_name');
            $table->string('path');
            $table->unsignedInteger('size')->default(0);
            $table->unsignedInteger('pages')->nullable();
            $table->string('status', 20)->default('diproses'); // diproses|siap|gagal
            $table->text('error')->nullable();
            $table->json('proposals')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('knowledge_articles', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('body');
            $table->string('category', 100)->nullable();
            $table->string('source')->nullable();
            $table->string('source_ref', 100)->nullable();
            $table->string('status', 20)->default('draf')->index(); // draf|ditinjau|terbit
            $table->date('review_at')->nullable();
            $table->foreignId('knowledge_document_id')->nullable()->constrained('knowledge_documents')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('used_count')->default(0);
            $table->unsignedInteger('helpful_count')->default(0);
            $table->unsignedInteger('unhelpful_count')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_articles');
        Schema::dropIfExists('knowledge_documents');
    }
};
