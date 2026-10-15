<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\KnowledgeArticle;
use App\Models\User;
use App\Services\AuditService;
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
    public function __construct(private readonly AuditService $audit) {}

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
                'source' => $a->source,
                'source_ref' => $a->source_ref,
                'status' => $a->status,
                'review_at' => $a->review_at?->toDateString(),
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

    public function destroy(KnowledgeArticle $article): RedirectResponse
    {
        $this->authorize('manageAdmins', User::class);

        $article->delete();

        $this->audit->safe('knowledge.deleted', null, "Artikel \"{$article->title}\" dihapus.");

        return back()->with('success', 'Artikel dihapus.');
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'min:10', 'max:10000'],
            'category' => ['nullable', 'string', 'max:100'],
            'source' => ['nullable', 'string', 'max:255'],
            'source_ref' => ['nullable', 'string', 'max:100'],
            'status' => ['required', Rule::in(KnowledgeArticle::STATUSES)],
            'review_at' => ['nullable', 'date'],
        ]);
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

    private function helpfulRate(KnowledgeArticle $a): ?int
    {
        $total = $a->helpful_count + $a->unhelpful_count;

        return $total > 0 ? (int) round($a->helpful_count / $total * 100) : null;
    }
}
