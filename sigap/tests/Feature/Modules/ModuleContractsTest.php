<?php

namespace Tests\Feature\Modules;

use App\Modules\Assistant\Listeners\QueueAssistantReply;
use App\Modules\ContactCenter\Events\CitizenMessageReceived;
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

    public function test_assistant_listens_to_citizen_messages_exactly_once(): void
    {
        $listeners = collect(app('events')->getRawListeners()[CitizenMessageReceived::class] ?? []);

        // Dua kali terdaftar = TARA menjawab ganda.
        $this->assertSame([QueueAssistantReply::class], $listeners->all());
    }
}
