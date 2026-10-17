<?php

namespace App\Http\Controllers\Web;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Referral;
use App\Models\ReferralEvent;
use App\Models\Ticket;
use App\Models\User;
use App\Services\AuditService;
use App\Services\ReferralService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Rujukan portal di panel admin: daftar kerja penanggung jawab.
 *
 * Semua admin dapat melihat & mencatat tindak lanjut (seperti Kotak Masuk),
 * tetapi menutup, mencatat berhasil atas nama warga, atau mengalihkan hanya
 * boleh oleh penanggung jawabnya atau Super Admin, agar tanggung jawab tidak
 * berpindah diam-diam.
 */
class ReferralController extends Controller
{
    private const TABS = ['perlu_tindakan', 'menunggu', 'selesai', 'semua'];

    public function __construct(
        private readonly ReferralService $referrals,
        private readonly AuditService $audit,
    ) {}

    public function index(Request $request): Response
    {
        $this->authorize('viewAny', Ticket::class);

        $user = $request->user();
        $mine = $request->query('milik', 'saya') !== 'semua';
        $tab = in_array($request->query('tab'), self::TABS, true) ? $request->query('tab') : 'perlu_tindakan';

        $scope = fn (): Builder => Referral::query()->when($mine, fn ($q) => $q->where('assigned_to', $user->id));

        $list = $this->applyTab($scope(), $tab)
            ->with(['portal:id,name', 'assignee:id,name', 'user:id,name'])
            ->orderByRaw("CASE WHEN status = 'butuh_bantuan' THEN 0 ELSE 1 END")
            ->orderBy('follow_up_due_at')
            ->latest('id')
            ->limit(100)
            ->get();

        $active = $request->filled('rujukan')
            ? Referral::query()->where('code', $request->query('rujukan'))->first()
            : $list->first();

        return Inertia::render('admin/rujukan', [
            'tab' => $tab,
            'milik' => $mine ? 'saya' : 'semua',
            'tab_counts' => collect(self::TABS)->mapWithKeys(fn (string $t) => [$t => $this->applyTab($scope(), $t)->count()]),
            'referrals' => $list->map(fn (Referral $r) => $this->row($r))->values(),
            'active' => $active ? $this->detail($active, $user) : null,
            'kpi' => $this->kpi($scope()),
            'board' => $user->isSuperAdmin() ? $this->board() : null,
            'admins' => User::query()->where('is_active', true)->whereIn('role', UserRole::adminValues())->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function note(Request $request, Referral $referral): RedirectResponse
    {
        $this->authorize('viewAny', Ticket::class);
        $data = $request->validate(['catatan' => ['required', 'string', 'min:3', 'max:1000']]);

        $this->referrals->note($referral, $request->user(), $data['catatan']);

        return back()->with('success', 'Catatan tindak lanjut disimpan. Batas tindak lanjut diperpanjang 2 hari kerja.');
    }

    public function message(Request $request, Referral $referral): RedirectResponse
    {
        $this->authorize('viewAny', Ticket::class);
        $data = $request->validate(['pesan' => ['required', 'string', 'min:2', 'max:2000']]);

        if (! $this->referrals->message($referral, $request->user(), $data['pesan'])) {
            return back()->with('error', 'Rujukan ini tidak berasal dari chat. Hubungi warga lewat kontak yang tercatat.');
        }

        return back()->with('success', 'Pesan terkirim ke chat warga.');
    }

    public function confirm(Request $request, Referral $referral): RedirectResponse
    {
        $this->authorizeOwner($request->user(), $referral);
        $data = $request->validate(['bukti' => ['required', 'string', 'min:3', 'max:100']]);

        if (! $referral->isOpen()) {
            return back()->with('error', 'Rujukan sudah ditutup.');
        }

        $this->referrals->confirm($referral, $data['bukti'], $request->user());
        $this->audit->safe('referral.confirmed', null, "Rujukan {$referral->code} berhasil ({$data['bukti']}).");

        return back()->with('success', 'Rujukan ditandai berhasil.');
    }

    public function reassign(Request $request, Referral $referral): RedirectResponse
    {
        $this->authorizeOwner($request->user(), $referral);
        $data = $request->validate([
            'admin_id' => ['required', Rule::exists('users', 'id')->where('is_active', true)->whereIn('role', UserRole::adminValues())],
        ]);

        $to = User::findOrFail($data['admin_id']);
        $this->referrals->reassign($referral, $request->user(), $to);
        $this->audit->safe('referral.reassigned', null, "Rujukan {$referral->code} dialihkan ke {$to->name}.");

        return back()->with('success', "Rujukan dialihkan ke {$to->name}.");
    }

    public function close(Request $request, Referral $referral): RedirectResponse
    {
        $this->authorizeOwner($request->user(), $referral);
        $data = $request->validate(['alasan' => ['required', 'string', 'min:10', 'max:1000']]);

        if (! $referral->isOpen()) {
            return back()->with('error', 'Rujukan sudah ditutup.');
        }

        $this->referrals->fail($referral, $request->user(), $data['alasan']);
        $this->audit->safe('referral.failed', null, "Rujukan {$referral->code} ditutup tidak berhasil.");

        return back()->with('success', 'Rujukan ditutup dengan alasan tercatat.');
    }

    private function authorizeOwner(User $user, Referral $referral): void
    {
        $this->authorize('viewAny', Ticket::class);
        abort_unless($user->isSuperAdmin() || $referral->assigned_to === $user->id, 403, 'Hanya penanggung jawab atau Super Admin.');
    }

    private function applyTab(Builder $query, string $tab): Builder
    {
        return match ($tab) {
            'perlu_tindakan' => $query->needsAction(),
            'menunggu' => $query->open()->where('status', '!=', Referral::STATUS_HELP)
                ->where(fn ($q) => $q->whereNull('follow_up_due_at')->orWhere('follow_up_due_at', '>=', now())),
            'selesai' => $query->whereNotIn('status', Referral::OPEN),
            default => $query,
        };
    }

    private function row(Referral $r): array
    {
        return [
            'kode' => $r->code,
            'nama' => $r->citizenName(),
            'portal' => $r->portal?->name,
            'status' => $r->status,
            'status_label' => $r->label(),
            'perlu_tindakan' => $r->needsAction(),
            'batas' => $r->follow_up_due_at?->toIso8601String(),
            'pendamping' => $r->assignee?->name,
            'dibuat' => $r->created_at?->toIso8601String(),
        ];
    }

    private function detail(Referral $r, User $viewer): array
    {
        // Daftar memuat portal sebagian (id, nama); detail butuh tautannya.
        $r->load(['portal', 'assignee:id,name', 'events.user:id,name', 'user:id,name,email,phone']);

        return $this->row($r) + [
            'ringkasan' => $r->summary,
            'kontak' => $r->contact ?? $r->user?->phone ?? $r->user?->email,
            'bukti' => $r->external_ref,
            'bukti_label' => $this->referrals->proofLabel($r),
            'alasan_tutup' => $r->close_reason,
            'tautan_warga' => $r->publicUrl(),
            'portal_url' => $r->portal?->destination(),
            'percakapan_id' => $r->conversation_id,
            'assigned_to' => $r->assigned_to,
            'bisa_kelola' => $viewer->isSuperAdmin() || $r->assigned_to === $viewer->id,
            'terbuka' => $r->isOpen(),
            'jejak' => $r->events->map(fn (ReferralEvent $e) => [
                'id' => $e->id,
                'jenis' => $e->type,
                'label' => ReferralEvent::LABELS[$e->type] ?? $e->type,
                'oleh' => match ($e->actor) {
                    'petugas' => $e->user?->name ?? 'Petugas',
                    'warga' => 'Warga',
                    'ai' => 'Asisten SIGAP',
                    default => 'Sistem',
                },
                'catatan' => $e->note,
                'pada' => $e->created_at?->toIso8601String(),
            ])->values(),
        ];
    }

    /** @return array<string, int|null> */
    private function kpi(Builder $scope): array
    {
        $since = now()->subDays(30);
        $closed = (clone $scope)->whereNotIn('status', Referral::OPEN)->where('closed_at', '>=', $since)->get(['status', 'created_at', 'confirmed_at']);
        $done = $closed->where('status', Referral::STATUS_DONE);

        return [
            'aktif' => (clone $scope)->open()->count(),
            'perlu_tindakan' => (clone $scope)->needsAction()->count(),
            'berhasil_30' => $done->count(),
            'tingkat_berhasil' => $closed->isEmpty() ? null : (int) round($done->count() / $closed->count() * 100),
            'median_jam' => $this->medianHours($done),
        ];
    }

    /**
     * Papan akuntabilitas per penanggung jawab (Super Admin).
     *
     * @return list<array{nama: string, aktif: int, perlu_tindakan: int, berhasil_30: int}>
     */
    private function board(): array
    {
        return User::query()
            ->where('is_active', true)
            ->whereIn('role', UserRole::adminValues())
            ->withCount([
                'assignedReferrals as aktif' => fn ($q) => $q->open(),
                'assignedReferrals as perlu_tindakan' => fn ($q) => $q->needsAction(),
                'assignedReferrals as berhasil_30' => fn ($q) => $q->where('status', Referral::STATUS_DONE)->where('closed_at', '>=', now()->subDays(30)),
            ])
            ->orderByDesc('perlu_tindakan')
            ->orderBy('name')
            ->get()
            ->filter(fn (User $u) => $u->aktif + $u->berhasil_30 > 0)
            ->map(fn (User $u) => ['nama' => $u->name, 'aktif' => $u->aktif, 'perlu_tindakan' => $u->perlu_tindakan, 'berhasil_30' => $u->berhasil_30])
            ->values()
            ->all();
    }

    /** @param Collection<int, Referral> $done */
    private function medianHours(Collection $done): ?int
    {
        $hours = $done->filter(fn (Referral $r) => $r->confirmed_at && $r->created_at)
            ->map(fn (Referral $r) => $r->created_at->diffInMinutes($r->confirmed_at) / 60)
            ->sort()
            ->values();

        return $hours->isEmpty() ? null : (int) round($hours[intdiv($hours->count(), 2)]);
    }
}
