<?php

namespace App\Modules\Knowledge;

use App\Models\KnowledgeArticle;
use App\Models\KnowledgePassage;
use Illuminate\Support\Collection;

/**
 * Kontrak publik modul Knowledge (PRD-AI §8): modul lain mencari sumber
 * jawaban lewat antarmuka ini, bukan lewat kelas pencarian di dalamnya.
 */
interface KnowledgeSearch
{
    /**
     * Artikel terbit + kutipan Sumber Resmi aktif, artikel lebih dulu.
     *
     * @return Collection<int, KnowledgeArticle|KnowledgePassage>
     */
    public function sources(string $question, int $articles = 3, ?int $passages = null): Collection;

    /**
     * Kata bermakna di teks (kata tanya & sapaan tidak dihitung).
     *
     * @return list<string>
     */
    public function terms(string $text): array;
}
