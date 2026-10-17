<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\ChatConversation;
use App\Models\Portal;
use App\Models\Ticket;
use App\Services\AuditService;
use App\Services\ChatService;
use App\Services\ReferralService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
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
        private readonly ReferralService $referrals,
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

    /**
     * POST /admin/chat/{conversation}/rujuk — rujuk warga ke portal lain
     * (mis. aduan lahan → Trans Tuntas). Petugas yang merujuk menjadi
     * penanggung jawab sampai warga berhasil.
     */
    public function refer(Request $request, ChatConversation $conversation): RedirectResponse
    {
        $this->authorize('viewAny', Ticket::class);

        $data = $request->validate([
            'portal' => ['required', Rule::exists('portals', 'code')->where('is_active', true)->where('audience', Portal::AUDIENCE_PUBLIC)],
            'ringkasan' => ['nullable', 'string', 'max:1000'],
        ]);

        if ($conversation->isClosed()) {
            return back()->with('error', 'Percakapan sudah ditutup.');
        }

        $portal = Portal::query()->where('code', $data['portal'])->firstOrFail();
        $user = $request->user();
        $summary = $data['ringkasan'] ?? $conversation->ai_summary;

        $referral = $this->referrals->create($portal, $conversation, $summary, $user);

        $this->chat->send(
            $conversation,
            "Petugas merujuk Anda ke {$portal->name}. Buka pengantar di bawah untuk langkah, hal yang perlu disiapkan, dan ringkasan aduan Anda. "
                .Str::before($user->name, ' ').' mendampingi Anda sampai berhasil.',
            'system',
            null,
            [
                'kind' => 'rujukan',
                'portal' => $portal->card(),
                'rujukan' => ['kode' => $referral->code, 'url' => $referral->publicUrl(), 'pendamping' => Str::before($user->name, ' ')],
            ],
        );
        $this->chat->close($conversation, 'rujuk_portal', $user->id);
        $this->audit->safe('chat.referred', $conversation, "Percakapan #{$conversation->id} dirujuk ke {$portal->name} ({$referral->code}).");

        return back()->with('success', "Warga dirujuk ke {$portal->name}. Pantau di menu Rujukan sampai berhasil.");
    }
}
