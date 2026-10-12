<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_no', 20)->unique();
            $table->string('title');
            $table->text('description');
            $table->string('status', 20)->default('baru');
            $table->string('priority', 20)->default('umum');
            $table->string('impact', 20)->nullable();
            $table->string('visibility', 20)->default('publik');
            $table->decimal('latitude', 10, 6)->nullable();
            $table->decimal('longitude', 10, 6)->nullable();
            $table->string('attachment_path', 500)->nullable();
            $table->boolean('is_internal')->default(false);

            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->foreignId('region_id')->nullable()->constrained('regions')->nullOnDelete();
            $table->foreignId('channel_id')->nullable()->constrained('channels')->nullOnDelete();
            $table->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reporter_id')->nullable()->constrained('users')->nullOnDelete();

            $table->string('reporter_name', 150)->nullable();
            $table->char('reporter_nik', 16)->nullable();
            $table->string('reporter_email', 150)->nullable();
            $table->string('reporter_phone', 30)->nullable();

            $table->timestamp('sla_due_at')->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('priority');
            $table->index('impact');
            $table->index('is_internal');
            $table->index('sla_due_at');
            $table->index('region_id');
            $table->index('category_id');
        });

        Schema::create('ticket_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('tickets')->cascadeOnDelete();
            $table->string('from_status', 20)->nullable();
            $table->string('to_status', 20);
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index('ticket_id');
        });

        Schema::create('ticket_replies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('tickets')->cascadeOnDelete();
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('body');
            $table->boolean('is_public')->default(true);
            $table->timestamps();

            $table->index('ticket_id');
        });

        Schema::create('surveys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->unique()->constrained('tickets')->cascadeOnDelete();
            $table->smallInteger('rating');
            $table->text('comment')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('surveys');
        Schema::dropIfExists('ticket_replies');
        Schema::dropIfExists('ticket_histories');
        Schema::dropIfExists('tickets');
    }
};
