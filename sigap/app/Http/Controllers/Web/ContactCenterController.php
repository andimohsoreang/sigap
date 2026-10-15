<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\ChatConversation;
use App\Models\Ticket;
use App\Services\AuditService;
use App\Services\ChatService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Aksi petugas di Kotak Masuk contact center: mengambil percakapan dan
 * menutupnya dengan satu hasil. Penerbitan tiket dari percakapan memakai
 * alur Input Manual (lihat AdminController::storeManual).
 *
 * Otorisasi mengikuti live chat (A-05): semua admin dapat menangani semua
 * percakapan karena warga belum memilih kawasan saat membuka chat.
 */
class ContactCenterController extends Controller
{
    /** Hasil yang dapat dipilih petugas saat menutup (tiket punya alurnya sendiri). */
    private const CLOSABLE = ['terjawab_petugas', 'lapor', 'wbs', 'tidak_selesai'];

    public function __construct(
        private readonly ChatService $chat,
        private readonly AuditService $audit,
    ) {}

    /** POST /admin/chat/{conversation}/ambil — petugas mengambil alih (AI berhenti menjawab). */
    public function take(Request $request, ChatConversation $conversation): RedirectResponse
    {
        $this->authorize('viewAny', Ticket::class);

        $this->chat->takeOver($conversation, $request->user()->id);
        $this->audit->safe('chat.taken', $conversation, "Percakapan #{$conversation->id} diambil {$request->user()->name}.");

        return back()->with('success', 'Percakapan Anda tangani.');
    }

    /** POST /admin/chat/{conversation}/tutup — tutup dengan hasil. */
    public function close(Request $request, ChatConversation $conversation): RedirectResponse
    {
        $this->authorize('viewAny', Ticket::class);

        $data = $request->validate(['hasil' => ['required', Rule::in(self::CLOSABLE)]]);

        if ($conversation->isClosed()) {
            return back()->with('error', 'Percakapan sudah ditutup.');
        }

        $notice = match ($data['hasil']) {
            'lapor' => 'Petugas menyarankan laporan Anda disampaikan melalui SP4N-LAPOR! (www.lapor.go.id) karena juga menyangkut instansi lain. Anda dapat memakai ringkasan percakapan ini saat melapor.',
            'wbs' => 'Untuk dugaan pelanggaran atau pungutan liar, silakan laporkan melalui Whistleblowing System (WBS) Kementerian Transmigrasi. Identitas pelapor dilindungi.',
            'terjawab_petugas' => 'Percakapan ditutup oleh petugas. Tulis pesan baru bila masih ada yang ingin ditanyakan.',
            default => null,
        };
        if ($notice !== null) {
            $this->chat->send($conversation, $notice, 'system', null, ['kind' => 'ditutup', 'hasil' => $data['hasil']]);
        }

        $this->chat->close($conversation, $data['hasil'], $request->user()->id);
        $this->audit->safe('chat.closed', $conversation, "Percakapan #{$conversation->id} ditutup: ".ChatConversation::OUTCOMES[$data['hasil']].'.');

        return back()->with('success', 'Percakapan ditutup: '.ChatConversation::OUTCOMES[$data['hasil']].'.');
    }
}
