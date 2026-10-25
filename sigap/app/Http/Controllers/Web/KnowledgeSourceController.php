<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Jobs\SyncKnowledgeSource;
use App\Models\KnowledgePassage;
use App\Models\KnowledgeSource;
use App\Models\User;
use App\Services\AuditService;
use App\Services\Knowledge\KnowledgeRetriever;
use App\Services\Knowledge\OfficialWebFetcher;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Sumber Resmi: situs Kementerian Transmigrasi dan berkas unggahan yang
 * dikutip langsung oleh asisten AI, lengkap dengan alamat/halaman asalnya.
 * Situs diambil ulang tiap pekan; sumber bisa dinonaktifkan kapan saja.
 */
class KnowledgeSourceController extends Controller
{
    public function __construct(
        private readonly OfficialWebFetcher $fetcher,
        private readonly KnowledgeRetriever $retriever,
        private readonly AuditService $audit,
    ) {}

    public function index(Request $request): Response
    {
        $this->authorize('manageMaster', User::class);

        $sources = KnowledgeSource::query()->with('document:id,path')->orderBy('kind')->orderBy('name')->get();
        $selected = $request->integer('sumber') ? $sources->firstWhere('id', $request->integer('sumber')) : null;

        return Inertia::render('admin/pengetahuan-sumber', [
            'sources' => $sources->map(fn (KnowledgeSource $s) => $this->row($s))->values(),
            'selected' => $selected ? $this->row($selected) + [
                'error' => $selected->error,
                'kutipan' => $selected->passages()->limit(60)->get()->map(fn (KnowledgePassage $p) => [
                    'id' => $p->id,
                    'judul' => $p->displayTitle(),
                    'isi' => Str::limit($p->body, 600),
                    'halaman' => $p->page,
                    'url' => $p->setRelation('source', $selected)->link(),
                ]),
            ] : null,
            'probe' => $this->probe((string) $request->query('uji', '')),
            'allowed_hosts' => config('services.knowledge.allowed_hosts'),
            'can_delete' => $request->user()->isSuperAdmin(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorize('manageMaster', User::class);

        $data = $request->validate([
            'url' => ['required', 'string', 'max:1000', 'url:http,https'],
            'nama' => ['nullable', 'string', 'max:200'],
            'ikuti_tautan' => ['boolean'],
        ], ['url.url' => 'Tulis alamat lengkap, mis. https://ppid.transmigrasi.go.id/faq.']);

        $url = trim($data['url']);
        if (! $this->fetcher->isAllowed($url)) {
            throw ValidationException::withMessages([
                'url' => 'Hanya situs resmi yang diizinkan: '.implode(', ', config('services.knowledge.allowed_hosts')).' (beserta subdomainnya).',
            ]);
        }
        if (KnowledgeSource::query()->where('kind', KnowledgeSource::KIND_SITE)->where('url', $url)->exists()) {
            throw ValidationException::withMessages(['url' => 'Alamat ini sudah terdaftar.']);
        }

        $source = KnowledgeSource::create([
            'kind' => KnowledgeSource::KIND_SITE,
            'name' => filled($data['nama'] ?? null) ? trim($data['nama']) : Str::limit(preg_replace('#^https?://(www\.)?#', '', rtrim($url, '/')), 200, ''),
            'url' => $url,
            'follow_links' => (bool) ($data['ikuti_tautan'] ?? false),
            'status' => KnowledgeSource::STATUS_QUEUED,
            'created_by' => $request->user()->id,
        ]);

        SyncKnowledgeSource::dispatch($source);
        $this->audit->safe('knowledge.source_added', $source, "Sumber Resmi \"{$source->name}\" ({$url}) ditambahkan.");

        return redirect("/admin/pengetahuan/sumber?sumber={$source->id}")
            ->with('success', 'Sumber ditambahkan. Isinya sedang diambil.');
    }

    public function update(Request $request, KnowledgeSource $source): RedirectResponse
    {
        $this->authorize('manageMaster', User::class);

        $data = $request->validate([
            'nama' => ['sometimes', 'required', 'string', 'max:200'],
            'aktif' => ['sometimes', 'boolean'],
            'ikuti_tautan' => ['sometimes', 'boolean'],
            'tampil_berkas' => ['sometimes', 'boolean'],
        ]);

        $source->fill(array_filter([
            'name' => isset($data['nama']) ? trim($data['nama']) : null,
            'is_active' => $data['aktif'] ?? null,
            'follow_links' => $source->isSite() ? ($data['ikuti_tautan'] ?? null) : null,
            'public_file' => $source->isSite() ? null : ($data['tampil_berkas'] ?? null),
        ], fn ($v) => $v !== null))->save();

        if (array_key_exists('aktif', $data)) {
            $this->audit->safe('knowledge.source_toggled', $source, "Sumber Resmi \"{$source->name}\" ".($source->is_active ? 'diaktifkan' : 'dinonaktifkan').'.');
        }

        return back()->with('success', 'Sumber diperbarui.');
    }

    public function sync(KnowledgeSource $source): RedirectResponse
    {
        $this->authorize('manageMaster', User::class);

        $source->forceFill(['status' => KnowledgeSource::STATUS_QUEUED])->save();
        SyncKnowledgeSource::dispatch($source);

        return back()->with('success', 'Sumber sedang diambil ulang.');
    }

    public function syncAll(): RedirectResponse
    {
        $this->authorize('manageMaster', User::class);

        $sources = KnowledgeSource::query()->active()->where('kind', KnowledgeSource::KIND_SITE)->get();
        foreach ($sources as $source) {
            $source->forceFill(['status' => KnowledgeSource::STATUS_QUEUED])->save();
            SyncKnowledgeSource::dispatch($source);
        }

        return back()->with('success', "{$sources->count()} situs sedang diambil ulang.");
    }

    public function destroy(KnowledgeSource $source): RedirectResponse
    {
        $this->authorize('manageAdmins', User::class);

        if (! $source->isSite()) {
            return back()->with('error', 'Berkas unggahan dihapus dari halaman dokumen resmi. Di sini cukup dinonaktifkan.');
        }

        $source->delete();
        $this->audit->safe('knowledge.source_deleted', null, "Sumber Resmi \"{$source->name}\" ({$source->url}) dihapus beserta kutipannya.");

        return redirect('/admin/pengetahuan/sumber')->with('success', 'Sumber dan kutipannya dihapus.');
    }

    /** Berkas resmi yang dirujuk jawaban asisten, dapat dibuka warga. */
    public function publicFile(KnowledgeSource $source): BinaryFileResponse
    {
        abort_unless($source->publicFileUrl() !== null && $source->document !== null, 404);

        return KnowledgeDocumentController::serve($source->document);
    }

    /**
     * @return array<string, mixed>
     */
    private function row(KnowledgeSource $s): array
    {
        return [
            'id' => $s->id,
            'jenis' => $s->kind,
            'nama' => $s->name,
            'url' => $s->isSite() ? $s->url : null,
            'berkas_url' => $s->isSite() ? null : "/admin/pengetahuan/dokumen/{$s->knowledge_document_id}/berkas",
            'dokumen_id' => $s->knowledge_document_id,
            'aktif' => $s->is_active,
            'ikuti_tautan' => $s->follow_links,
            'tampil_berkas' => $s->public_file,
            'status' => $s->status,
            'gagal' => $s->status === KnowledgeSource::STATUS_FAILED ? $s->error : null,
            'halaman' => $s->pages_count,
            'jumlah_kutipan' => $s->passages_count,
            'dipakai' => $s->used_count,
            'diambil' => $s->fetched_at?->toIso8601String(),
            'berubah' => $s->changed_at?->toIso8601String(),
        ];
    }

    /**
     * @return array{question: string, results: list<array<string, mixed>>}|null
     */
    private function probe(string $question): ?array
    {
        $question = trim(mb_substr($question, 0, 300));
        if ($question === '') {
            return null;
        }

        $scores = collect($this->retriever->rankPassages($question))->keyBy('id');

        return [
            'question' => $question,
            'results' => $this->retriever->passages($question, 5)->map(fn (KnowledgePassage $p) => [
                'id' => $p->id,
                'judul' => $p->displayTitle(),
                'label' => $p->label(),
                'isi' => Str::limit($p->body, 300),
                'url' => $p->link(),
                'sumber_id' => $p->knowledge_source_id,
                'skor' => $scores->get($p->id)['score'] ?? null,
            ])->all(),
        ];
    }
}
