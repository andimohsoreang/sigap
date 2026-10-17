<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Portal;
use App\Models\Referral;
use App\Models\Ticket;
use App\Models\User;
use App\Services\AuditService;
use App\Services\PortalHealthCheck;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Katalog Portal: portal Kementerian Transmigrasi yang dapat dirujuk AI dan
 * petugas. Semua admin dapat melihat; hanya Super Admin yang mengubah.
 */
class PortalController extends Controller
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly PortalHealthCheck $health,
    ) {}

    public function index(Request $request): Response
    {
        $this->authorize('viewAny', Ticket::class);

        $portals = Portal::query()
            ->withCount([
                'referrals as rujukan_30' => fn ($q) => $q->where('created_at', '>=', now()->subDays(30)),
                'referrals as berhasil_30' => fn ($q) => $q->where('status', Referral::STATUS_DONE)->where('closed_at', '>=', now()->subDays(30)),
            ])
            ->orderBy('sort')
            ->orderBy('name')
            ->get();

        return Inertia::render('admin/portal', [
            'portals' => $portals->map(fn (Portal $p) => [
                'id' => $p->id,
                'code' => $p->code,
                'name' => $p->name,
                'url' => $p->url,
                'action_url' => $p->action_url,
                'action_label' => $p->action_label,
                'audience' => $p->audience,
                'purpose' => $p->purpose,
                'description' => $p->description,
                'keywords' => $p->keywords,
                'steps' => $p->steps,
                'prepare' => $p->prepare,
                'proof_label' => $p->proof_label,
                'track_completion' => $p->track_completion,
                'managed_by' => $p->managed_by,
                'contact' => $p->contact,
                'is_active' => $p->is_active,
                'sort' => $p->sort,
                'is_reachable' => $p->is_reachable,
                'last_status' => $p->last_status,
                'last_checked_at' => $p->last_checked_at?->toIso8601String(),
                'rujukan_30' => $p->rujukan_30,
                'berhasil_30' => $p->berhasil_30,
            ]),
            'can_edit' => $request->user()->isSuperAdmin(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorize('manageAdmins', User::class);

        $portal = Portal::create($this->validated($request));
        $this->audit->safe('portal.created', null, "Portal {$portal->name} ditambahkan.");

        return back()->with('success', "Portal {$portal->name} ditambahkan.");
    }

    public function update(Request $request, Portal $portal): RedirectResponse
    {
        $this->authorize('manageAdmins', User::class);

        $portal->update($this->validated($request, $portal));
        $this->audit->safe('portal.updated', null, "Portal {$portal->name} diperbarui.");

        return back()->with('success', "Portal {$portal->name} diperbarui.");
    }

    /** POST /admin/portal/{portal}/cek — cek tautan sekarang. */
    public function check(Portal $portal): RedirectResponse
    {
        $this->authorize('viewAny', Ticket::class);

        return $this->health->check($portal)
            ? back()->with('success', "{$portal->name} dapat diakses.")
            : back()->with('error', "{$portal->name} tidak dapat diakses. AI tidak akan merujuk warga ke portal ini sampai pulih.");
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?Portal $portal = null): array
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:40', 'regex:/^[a-z0-9-]+$/', Rule::unique('portals', 'code')->ignore($portal?->id)],
            'name' => ['required', 'string', 'max:100'],
            'url' => ['required', 'url:https,http', 'max:500'],
            'action_url' => ['nullable', 'url:https,http', 'max:500'],
            'action_label' => ['nullable', 'string', 'max:60'],
            'audience' => ['required', Rule::in([Portal::AUDIENCE_PUBLIC, Portal::AUDIENCE_INTERNAL])],
            'purpose' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'keywords' => ['nullable', 'string', 'max:500'],
            'steps' => ['nullable', 'string', 'max:3000'],
            'prepare' => ['nullable', 'string', 'max:2000'],
            'proof_label' => ['nullable', 'string', 'max:60'],
            'track_completion' => ['boolean'],
            'managed_by' => ['nullable', 'string', 'max:150'],
            'contact' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
            'sort' => ['nullable', 'integer', 'min:0', 'max:999'],
        ]);

        // Portal internal tidak pernah dipakai untuk rujukan warga.
        if ($data['audience'] === Portal::AUDIENCE_INTERNAL) {
            $data['track_completion'] = false;
        }
        $data['sort'] ??= 0;

        return $data;
    }
}
