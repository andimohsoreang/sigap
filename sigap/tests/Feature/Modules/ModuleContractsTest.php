<?php

namespace Tests\Feature\Modules;

use App\Modules\Knowledge\KnowledgeSearch;
use App\Modules\Knowledge\Retrieval\KnowledgeRetriever;
use Tests\TestCase;

/** Kontrak antarmodul PRD-AI §8 terpasang ke implementasinya (Tahap 4). */
class ModuleContractsTest extends TestCase
{
    public function test_knowledge_search_contract_uses_bm25_retriever(): void
    {
        $this->assertInstanceOf(KnowledgeRetriever::class, app(KnowledgeSearch::class));
    }
}
