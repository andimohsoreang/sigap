<?php

namespace App\Http\Controllers\Web;

use App\Enums\TicketStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateWargaProfileRequest;
use App\Models\Ticket;
use App\Models\User;
use App\Services\AccountService;
use App\Services\AttachmentService;
use App\Services\AuditService;
use App\Services\TicketService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Portal Warga (Inertia). Riwayat tiket & pengaturan akun memakai data yang
 * SAMA dengan /api/v1/warga (SEC-07) — hanya tiket milik warga yang login.
 */
class WargaPortalController extends Controller
{
    public function __construct(
        private readonly AttachmentService $attachments,
        private readonly AccountService $accounts,
        private readonly TicketService $tickets,
        private readonly AuditService $audit,
    ) {}

    public function index(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        $tickets = $user->tickets()
            ->with(['category', 'region', 'channel', 'assignee', 'histories', 'replies.author'])
            ->latest()
            ->get()
            ->map(fn (Ticket $t) => [
                'nomor' => $t->ticket_no,
                'kode_akses' => $t->lookup_token,
                'tanggal' => $t->created_at?->toIso8601String(),
                'judul' => $t->title,
                'status' => $t->status?->value,
                'status_label' => $t->status?->label(),
                'kategori' => $t->category?->name,
                'kawasan' => $t->region?->name,
                'jenis' => $t->is_internal ? 'Internal' : 'Publik',
                'jumlah_tanggapan' => $t->replies->where('is_public', true)->count(),
            ])
            ->values();

        return Inertia::render('warga/portal', [
            'profile' => [
                'nama' => $user->name,
                // A-21: NIK lengkap tidak pernah dikirim ke browser.
                'nik' => $user->maskedNik(),
                'nik_masked' => $user->maskedNik(),
                'email' => $user->email,
                'telp' => $user->phone,
                'inisial' => $this->initials($user->name),
            ],
            'tickets' => $tickets,
            'statuses' => collect(TicketStatus::cases())->mapWithKeys(
                fn (TicketStatus $s) => [$s->value => $s->label()]
            ),
        ]);
    }

    /** Ubah profil & kata sandi (A-09/A-10) — aturan sama dengan API. */
    public function updateProfile(UpdateWargaProfileRequest $request): RedirectResponse
    {
        $this->accounts->updateProfile(
            $request->user(),
            $request->validated(),
            $request->session()->getId(),
        );

        return back()->with('success', 'Profil dan kata sandi berhasil diperbarui.');
    }

    /** Unduh lampiran tiket milik warga (SEC-09) — bukan URL publik. */
    public function attachment(Request $request, Ticket $ticket): mixed
    {
        abort_unless($ticket->reporter_id === $request->user()->id, 403);

        $file = $this->attachments->file($ticket->attachment_path);
        abort_if($file === null, 404);

        $this->audit->safe('ticket.attachment_downloaded', $ticket, "Lampiran tiket {$ticket->ticket_no} diunduh pelapor.");

        return response()->download($file->getPathname(), basename($ticket->attachment_path));
    }

    /**
     * Warga dapat menghapus laporan yang belum ditindak (status "baru").
     *
     * A-03: soft delete — nomor tiket tidak pernah dipakai ulang — dan file
     * lampiran dihapus dari disk.
     */
    public function destroyTicket(Request $request, Ticket $ticket): RedirectResponse
    {
        abort_unless($ticket->reporter_id === $request->user()->id, 403);
        abort_unless($ticket->status === TicketStatus::Baru, 422);

        $this->tickets->deleteByReporter($ticket, $request->user());

        $this->audit->safe('ticket.deleted_by_reporter', $ticket, "Tiket {$ticket->ticket_no} dihapus oleh pelapor.");

        return back()->with('success', "Tiket {$ticket->ticket_no} berhasil dihapus.");
    }

    private function initials(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name)) ?: [];

        return collect($parts)
            ->filter()
            ->take(2)
            ->map(fn (string $p) => mb_strtoupper(mb_substr($p, 0, 1)))
            ->implode('') ?: '?';
    }
}
