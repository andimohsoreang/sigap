<?php

namespace App\Console\Commands;

use App\Models\KnowledgeSource;
use App\Services\Knowledge\SourceIngestor;
use Illuminate\Console\Command;

/** Ambil ulang situs Sumber Resmi agar kutipan asisten mengikuti isi terbaru. */
class SinkronSumberCommand extends Command
{
    protected $signature = 'sigap:sinkron-sumber {--sumber= : ID satu sumber saja}';

    protected $description = 'Ambil ulang situs resmi Kementerian Transmigrasi untuk kutipan asisten AI';

    public function handle(SourceIngestor $ingestor): int
    {
        $sources = KnowledgeSource::query()
            ->when($this->option('sumber'), fn ($q, $id) => $q->whereKey($id), fn ($q) => $q->active()->where('kind', KnowledgeSource::KIND_SITE))
            ->orderBy('id')
            ->get();

        foreach ($sources as $source) {
            $ingestor->sync($source);
            $source->refresh();
            $this->line(sprintf(
                '%s  %s — %s',
                $source->status === KnowledgeSource::STATUS_READY ? 'OK   ' : 'GAGAL',
                $source->name,
                $source->status === KnowledgeSource::STATUS_READY
                    ? "{$source->pages_count} halaman, {$source->passages_count} kutipan"
                    : $source->error,
            ));
        }

        $this->info("{$sources->count()} sumber diperiksa.");

        return self::SUCCESS;
    }
}
