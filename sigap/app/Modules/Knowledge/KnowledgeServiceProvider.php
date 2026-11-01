<?php

namespace App\Modules\Knowledge;

use App\Modules\Knowledge\Retrieval\KnowledgeRetriever;
use Illuminate\Support\ServiceProvider;

/** Modul Knowledge: kontrak pencarian dipasang ke implementasi BM25. */
final class KnowledgeServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(KnowledgeSearch::class, KnowledgeRetriever::class);
    }
}
