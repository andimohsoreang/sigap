<?php

namespace App\Jobs;

use App\Models\KnowledgeSource;
use App\Services\Knowledge\SourceIngestor;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/** Ambil ulang satu Sumber Resmi dan perbarui kutipannya (bisa beberapa menit untuk situs). */
class SyncKnowledgeSource implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 900;

    public function __construct(public KnowledgeSource $source) {}

    public function handle(SourceIngestor $ingestor): void
    {
        $ingestor->sync($this->source);
    }
}
