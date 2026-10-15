<?php

namespace App\Jobs;

use App\Models\KnowledgeDocument;
use App\Services\Knowledge\KnowledgeDocumentService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/** Membaca PDF resmi dan meminta AI menyusun usulan artikel (bisa makan waktu). */
class ProcessKnowledgeDocument implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 300;

    public function __construct(public KnowledgeDocument $document) {}

    public function handle(KnowledgeDocumentService $service): void
    {
        $service->process($this->document);
    }
}
