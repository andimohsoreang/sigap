<?php

namespace App\Http\Controllers\Web;

use App\Enums\TicketStatus;
use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\User;
use App\Services\AttachmentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Portal Warga (Inertia). Riwayat tiket & pengaturan akun memakai data yang
 * SAMA dengan /api/v1/warga (SEC-07) — hanya tiket milik warga yang login.
 */
class WargaPortalController extends Controller
{
    public function __construct(private readonly AttachmentService $attachments) {}

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
                'nik' => $user->nik,
                'nik_masked' => $user->nik
                    ? substr($user->nik, 0, 4).str_repeat('*', 8).substr($user->nik, -4)
                    : null,
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

    public function updateProfile(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'email' => ['nullable', 'email', 'max:150'],
            'telp' => ['nullable', 'string', 'max:30'],
            'password' => ['nullable', 'string', 'confirmed', Password::min(8)],
        ]);

        /** @var User $user */
        $user = $request->user();

        if ($request->filled('email')) {
            $user->email = $validated['email'];
        }
        if ($request->filled('telp')) {
            $user->phone = $validated['telp'];
        }
        if ($request->filled('password')) {
            $user->password = $validated['password'];
        }
        $user->save();

        return back()->with('success', 'Profil dan kata sandi berhasil diperbarui.');
    }

    /** Unduh lampiran tiket milik warga (SEC-09) — bukan URL publik. */
    public function attachment(Request $request, Ticket $ticket): mixed
    {
        abort_unless($ticket->reporter_id === $request->user()->id, 403);

        $file = $this->attachments->file($ticket->attachment_path);
        abort_if($file === null, 404);

        return response()->download($file->getPathname(), basename($ticket->attachment_path));
    }

    /**
     * Warga dapat menghapus laporan yang belum ditindak (status "baru").
     * Ini menutup celah "tidak ada endpoint DELETE" pada aplikasi lama.
     */
    public function destroyTicket(Request $request, Ticket $ticket): RedirectResponse
    {
        abort_unless($ticket->reporter_id === $request->user()->id, 403);
        abort_unless($ticket->status === TicketStatus::Baru, 422);

        DB::transaction(function () use ($ticket) {
            $ticket->histories()->delete();
            $ticket->replies()->delete();
            $ticket->delete();
        });

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