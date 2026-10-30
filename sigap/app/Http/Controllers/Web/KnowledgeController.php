<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\KnowledgeArticle;
use App\Models\KnowledgePassage;
use App\Models\User;
use App\Services\AuditService;
use App\Services\Knowledge\KnowledgeRetriever;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Basis Pengetahuan (panel admin): sumber satu-satunya jawaban asisten AI.
 *
 * Aturan dua orang: semua admin boleh menulis & mengusulkan artikel, tetapi
 * hanya Super Admin yang dapat MENERBITKAN (artikel terbit langsung dipakai
 * AI). Suntingan admin kawasan atas artikel terbit mengembalikannya ke
 * status "ditinjau" sampai disetujui lagi.
 */
class KnowledgeController extends Controller
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly KnowledgeRetriever $retriever,
    ) {}

    public function index(Request $request): Response
    {
        $this->authorize('manageMaster', User::class);

        $articles = KnowledgeArticle::query()->with('author:id,name')->latest('updated_at')->get();

        return Inertia::render('admin/pengetahuan', [
            'articles' => $articles->map(fn (KnowledgeArticle $a) => [
                'id' => $a->id,
                'title' => $a->title,
                'body' => $a->body,
                'category' => $a->category,
                'keywords' => $a->keywords,
                'source' => $a->source,
                'source_ref' => $a->source_ref,
                'source_url' => $a->source_url,
                'status' => $a->status,
                'review_at' => $a->review_at?->toDateString(),
                ...$a->legalBasisRow(),
                'review_overdue' => $a->isOverdueForReview(),
                'used_count' => $a->used_count,
                'helpful_rate' => $this->helpfulRate($a),
                'from_document' => $a->knowledge_document_id !== null,
                'author' => $a->author?->name,
                'updated_at' => $a->updated_at?->toIso8601String(),
            ]),
            'stats' => [
                'terbit' => $articles->where('status', KnowledgeArticle::STATUS_PUBLISHED)->count(),
                'ditinjau' => $articles->where('status', KnowledgeArticle::STATUS_REVIEW)->count(),
                'draf' => $articles->where('status', KnowledgeArticle::STATUS_DRAFT)->count(),
                'lewat_tinjau' => $articles->filter(fn (KnowledgeArticle $a) => $a->status === KnowledgeArticle::STATUS_PUBLISHED && $a->isOverdueForReview())->count(),
            ],
            'categories' => $articles->pluck('category')->filter()->unique()->sort()->values(),
            'unanswered' => $this->unanswered(),
            'probe' => $this->probe((string) $request->query('uji', '')),
            'can_publish' => $request->user()->isSuperAdmin(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorize('manageMaster', User::class);

        $data = $this->validated($request);
        $requested = $data['status'];
        $data['status'] = $this->allowedStatus($request->user(), $requested);

        $article = KnowledgeArticle::create($data + ['created_by' => $request->user()->id, 'updated_by' => $request->user()->id]);

        $this->audit->safe('knowledge.created', $article, "Artikel \"{$article->title}\" dibuat ({$article->status}).");

        return back()->with('success', $this->savedMessage($article->status, $requested));
    }

    public function update(Request $request, KnowledgeArticle $article): RedirectResponse
    {
        $this->authorize('manageMaster', User::class);

        $data = $this->validated($request);
        $requested = $data['status'];
        $data['status'] = $this->allowedStatus($request->user(), $requested);

        $article->update($data + ['updated_by' => $request->user()->id]);

        $this->audit->safe('knowledge.updated', $article, "Artikel \"{$article->title}\" diperbarui ({$article->status}).");

        return back()->with('success', $this->savedMessage($article->status, $requested));
    }

    /**
     * GET /admin/pengetahuan/tinjau — tinjau artikel "ditinjau" satu per satu
     * (Super Admin): artikel + tautan sumber, lalu Terbitkan / Kembalikan ke
     * draf / Lewati. Artikel berikutnya langsung tampil.
     */
    public function review(Request $request): Response
    {
        $this->authorize('manageAdmins', User::class);

        $skipped = collect(explode(',', (string) $request->query('lewati', '')))->map(fn ($id) => (int) $id)->filter()->values();
        $queue = KnowledgeArticle::query()->where('status', KnowledgeArticle::STATUS_REVIEW);
        $article = (clone $queue)->whereNotIn('id', $skipped)->orderBy('id')->first();

        return Inertia::render('admin/pengetahuan-tinjau', [
            'article' => $article ? [
                'id' => $article->id,
                'title' => $article->title,
                'body' => $article->body,
                'category' => $article->category,
                'keywords' => $article->keywords,
                'source' => $article->source,
                'source_ref' => $article->source_ref,
                'source_url' => $article->source_url,
                'from_document' => $article->knowledge_document_id !== null,
            ] : null,
            'remaining' => (clone $queue)->count(),
            'skipped' => $skipped,
        ]);
    }

    /** POST /admin/pengetahuan/{article}/kembalikan — tidak lolos tinjauan, kembali ke draf. */
    public function reject(Request $request, KnowledgeArticle $article): RedirectResponse
    {
        $this->authorize('manageAdmins', User::class);
        $data = $request->validate(['catatan' => ['nullable', 'string', 'max:500']]);

        $article->update(['status' => KnowledgeArticle::STATUS_DRAFT, 'updated_by' => $request->user()->id]);
        $note = filled($data['catatan'] ?? null) ? " Catatan: {$data['catatan']}" : '';
        $this->audit->safe('knowledge.rejected', $article, "Artikel \"{$article->title}\" dikembalikan ke draf.{$note}");

        return back()->with('success', 'Artikel dikembalikan ke draf untuk diperbaiki.');
    }

    /** Persetujuan cepat Super Admin atas artikel yang sudah ditinjau. */
    public function publish(Request $request, KnowledgeArticle $article): RedirectResponse
    {
        $this->authorize('manageAdmins', User::class);

        $article->update(['status' => KnowledgeArticle::STATUS_PUBLISHED, 'updated_by' => $request->user()->id]);

        $this->audit->safe('knowledge.published', $article, "Artikel \"{$article->title}\" diterbitkan.");

        return back()->with('success', 'Artikel terbit dan langsung dipakai asisten AI.');
    }

    public function destroy(KnowledgeArticle $article): RedirectResponse
    {
        $this->authorize('manageAdmins', User::class);

        $article->delete();

        $this->audit->safe('knowledge.deleted', null, "Artikel \"{$article->title}\" dihapus.");

        return back()->with('success', 'Artikel dihapus.');
    }

    public const LEGAL_BASIS_MESSAGES = ['diganti_oleh.required_if' => 'Isi peraturan pengganti bila status dasarnya "diganti".'];

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'min:10', 'max:10000'],
            'category' => ['nullable', 'string', 'max:100'],
            'keywords' => ['nullable', 'string', 'max:500'],
            'source' => ['nullable', 'string', 'max:255'],
            'source_ref' => ['nullable', 'string', 'max:100'],
            'source_url' => ['nullable', 'url:https,http', 'max:500'],
            'status' => ['required', Rule::in(KnowledgeArticle::STATUSES)],
            'review_at' => ['nullable', 'date'],
            ...KnowledgeArticle::legalBasisRules(),
        ], self::LEGAL_BASIS_MESSAGES);
    }

    /** Admin kawasan tidak dapat menerbitkan: permintaan "terbit" menjadi "ditinjau". */
    private function allowedStatus(User $user, string $requested): string
    {
        return $requested === KnowledgeArticle::STATUS_PUBLISHED && ! $user->isSuperAdmin()
            ? KnowledgeArticle::STATUS_REVIEW
            : $requested;
    }

    private function savedMessage(string $saved, string $requested): string
    {
        return $saved !== $requested
            ? 'Artikel disimpan dan menunggu persetujuan Super Admin sebelum dipakai AI.'
            : ($saved === KnowledgeArticle::STATUS_PUBLISHED ? 'Artikel terbit dan langsung dipakai asisten AI.' : 'Artikel disimpan.');
    }

    /**
     * Pertanyaan warga 30 hari terakhir yang tidak menemukan sumber (sudah
     * disamarkan saat disimpan), dikelompokkan & diurutkan dari yang tersering.
     *
     * @return list<array{question: string, count: int, last_at: string|null}>
     */
    private function unanswered(): array
    {
        return ChatMessage::query()
            ->where('sender_type', 'ai')
            ->where('created_at', '>=', now()->subDays(30))
            ->latest('id')
            ->limit(500)
            ->get(['meta', 'created_at'])
            ->filter(fn (ChatMessage $m) => $m->kind() === 'tidak_tahu' && filled($m->meta['pertanyaan'] ?? null))
            ->groupBy(fn (ChatMessage $m) => mb_strtolower(trim($m->meta['pertanyaan'])))
            ->map(fn ($group) => [
                'question' => $group->first()->meta['pertanyaan'],
                'count' => $group->count(),
                'last_at' => $group->first()->created_at?->toIso8601String(),
            ])
            ->sortByDesc('count')
            ->take(10)
            ->values()
            ->all();
    }

    /**
     * Uji pencarian: artikel terbit mana yang akan dikirim ke AI untuk
     * pertanyaan ini, beserta skornya. Membantu petugas menilai apakah
     * artikel perlu kata kunci tambahan.
     *
     * Kutipan Sumber Resmi yang ikut dikirim ditampilkan terpisah.
     *
     * @return array{question: string, results: list<array{id: int, title: string, score: float, coverage: int}>, passages: list<array{id: int, title: string, source: string|null, source_id: int|null}>}|null
     */
    private function probe(string $question): ?array
    {
        $question = trim(mb_substr($question, 0, 300));
        if ($question === '') {
            return null;
        }

        return [
            'question' => $question,
            'results' => collect($this->retriever->rank($question))
                ->take(5)
                ->map(fn (array $hit) => [
                    'id' => $hit['article']->id,
                    'title' => $hit['article']->title,
                    'score' => $hit['score'],
                    'coverage' => (int) round($hit['coverage'] * 100),
                ])
                ->all(),
            'passages' => $this->retriever->passages($question)
                ->map(fn (KnowledgePassage $p) => [
                    'id' => $p->id,
                    'title' => $p->displayTitle(),
                    'source' => $p->label(),
                    'source_id' => $p->knowledge_source_id,
                ])
                ->all(),
        ];
    }

    private function helpfulRate(KnowledgeArticle $a): ?int
    {
        $total = $a->helpful_count + $a->unhelpful_count;

        return $total > 0 ? (int) round($a->helpful_count / $total * 100) : null;
    }
}
