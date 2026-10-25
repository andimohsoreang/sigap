<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessKnowledgeDocument;
use App\Models\KnowledgeDocument;
use App\Models\User;
use App\Services\AuditService;
use App\Services\Knowledge\KnowledgeDocumentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Dokumen resmi (PDF/DOCX):
 * - isinya langsung menjadi kutipan Sumber Resmi yang dirujuk asisten AI
 *   (dapat dinonaktifkan di halaman Sumber Resmi);
 * - AI mengusulkan tanya-jawab dengan rujukan halaman → petugas memilih →
 *   tersimpan sebagai DRAF yang baru dipakai setelah diterbitkan Super Admin.
 */
class KnowledgeDocumentController extends Controller
{
    public function __construct(
        private readonly KnowledgeDocumentService $documents,
        private readonly AuditService $audit,
    ) {}

    public function index(Request $request): Response
    {
        $this->authorize('manageMaster', User::class);

        $documents = KnowledgeDocument::query()->with('uploader:id,name')->latest('id')->limit(20)->get();
        $selected = $request->integer('dokumen')
            ? $documents->firstWhere('id', $request->integer('dokumen')) ?? KnowledgeDocument::query()->find($request->integer('dokumen'))
            : $documents->first();

        return Inertia::render('admin/pengetahuan-dokumen', [
            'documents' => $documents->map(fn (KnowledgeDocument $d) => [
                'id' => $d->id,
                'nama' => $d->original_name,
                'status' => $d->status,
                'halaman' => $d->pages,
                'usulan' => count($d->proposals ?? []),
                'tersimpan' => collect($d->proposals ?? [])->where('tersimpan', true)->count(),
                'pengunggah' => $d->uploader?->name,
                'diunggah' => $d->created_at?->toIso8601String(),
            ]),
            'selected' => $selected ? [
                'id' => $selected->id,
                'nama' => $selected->original_name,
                'status' => $selected->status,
                'error' => $selected->error,
                'halaman' => $selected->pages,
                'ukuran' => $selected->size,
                'berkas_url' => "/admin/pengetahuan/dokumen/{$selected->id}/berkas",
                'usulan' => $selected->proposals ?? [],
            ] : null,
            'can_delete' => $request->user()->isSuperAdmin(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorize('manageMaster', User::class);

        $request->validate(['dokumen' => ['required', 'file', 'mimes:pdf,docx', 'max:20480']], [
            'dokumen.mimes' => 'Hanya berkas PDF atau Word (.docx) yang dapat diproses.',
            'dokumen.max' => 'Ukuran berkas paling besar 20 MB.',
        ]);

        $file = $request->file('dokumen');
        $extension = $file->guessExtension() === 'docx' ? 'docx' : 'pdf';
        $path = $file->storeAs('knowledge', Str::uuid().'.'.$extension, 'local');

        $document = KnowledgeDocument::create([
            'original_name' => Str::limit($file->getClientOriginalName(), 250, ''),
            'path' => $path,
            'size' => $file->getSize(),
            'status' => KnowledgeDocument::STATUS_PROCESSING,
            'uploaded_by' => $request->user()->id,
        ]);

        ProcessKnowledgeDocument::dispatch($document);
        $this->audit->safe('knowledge.document_uploaded', $document, "Dokumen \"{$document->original_name}\" diunggah untuk Basis Pengetahuan.");

        return redirect("/admin/pengetahuan/dokumen?dokumen={$document->id}")
            ->with('success', 'Dokumen diunggah. Isinya sedang dibaca untuk kutipan asisten dan usulan artikel.');
    }

    public function saveDrafts(Request $request, KnowledgeDocument $document): RedirectResponse
    {
        $this->authorize('manageMaster', User::class);

        $data = $request->validate([
            'usulan' => ['required', 'array', 'min:1', 'max:50'],
            'usulan.*.id' => ['required', 'integer'],
            'usulan.*.judul' => ['required', 'string', 'max:250'],
            'usulan.*.jawaban' => ['required', 'string', 'min:10', 'max:10000'],
            'usulan.*.kategori' => ['nullable', 'string', 'max:100'],
        ], ['usulan.required' => 'Pilih minimal satu usulan.']);

        $saved = $this->documents->saveDrafts($document, $data['usulan'], $request->user());
        $this->audit->safe('knowledge.drafts_from_document', $document, "{$saved} artikel draf dibuat dari \"{$document->original_name}\".");

        return redirect('/admin/pengetahuan')->with('success', "{$saved} artikel disimpan sebagai draf. Tinjau lalu terbitkan agar dipakai AI.");
    }

    public function retry(KnowledgeDocument $document): RedirectResponse
    {
        $this->authorize('manageMaster', User::class);

        $document->forceFill(['status' => KnowledgeDocument::STATUS_PROCESSING, 'error' => null])->save();
        ProcessKnowledgeDocument::dispatch($document);

        return back()->with('success', 'Dokumen diproses ulang.');
    }

    /** PDF ditampilkan inline untuk dicocokkan dengan usulan (`#page=N`). */
    public function file(KnowledgeDocument $document): BinaryFileResponse
    {
        $this->authorize('manageMaster', User::class);

        return self::serve($document);
    }

    /** Kirim berkas dokumen: PDF inline, DOCX sebagai unduhan. */
    public static function serve(KnowledgeDocument $document): BinaryFileResponse
    {
        abort_unless(Storage::disk('local')->exists($document->path), 404);

        // Nama berkas berasal dari pengguna: hanya karakter aman yang masuk header.
        $name = preg_replace('/[^\w .()-]/u', '_', Str::ascii($document->original_name)) ?: 'dokumen';
        $docx = $document->isDocx();

        return response()->file(Storage::disk('local')->path($document->path), [
            'Content-Type' => $docx ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf',
            'Content-Disposition' => ($docx ? 'attachment' : 'inline').'; filename="'.$name.'"',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function destroy(KnowledgeDocument $document): RedirectResponse
    {
        $this->authorize('manageAdmins', User::class);

        Storage::disk('local')->delete($document->path);
        $document->source?->delete(); // kutipannya ikut terhapus
        $document->delete();
        $this->audit->safe('knowledge.document_deleted', null, "Dokumen \"{$document->original_name}\" dihapus beserta kutipannya (artikel yang sudah dibuat tetap ada).");

        return redirect('/admin/pengetahuan/dokumen')->with('success', 'Dokumen dan kutipannya dihapus. Artikel yang sudah dibuat tetap ada.');
    }
}
