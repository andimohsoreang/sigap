<?php

namespace App\Http\Controllers\Web;

use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreInputManualRequest;
use App\Http\Requests\UpdateTicketStatusRequest;
use App\Models\Category;
use App\Models\ActivityLog;
use App\Models\Channel;
use App\Models\ChannelSyncLog;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\Region;
use App\Models\Setting;
use App\Models\Ticket;
use App\Models\User;
use App\Services\AttachmentService;
use App\Services\AuditService;
use App\Services\Channels\ChannelAdapterManager;
use App\Services\ChatService;
use App\Services\TicketService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Panel admin SIGAP (Inertia). Memakai Service/Request yang SAMA dengan
 * /api/v1/admin (PRD D1) dan scoping peran yang SAMA (SEC-07).
 */
class AdminController extends Controller
{
    public function __construct(
        private readonly TicketService $tickets,
        private readonly ChannelAdapterManager $adapters,
        private readonly AttachmentService $attachments,
        private readonly ChatService $chat,
        private readonly AuditService $audit,
    ) {}

    /* --------------------------- Matriks Rekap --------------------------- */

    public function matriks(Request $request): Response
    {
        $this->authorize('viewAny', Ticket::class);

        $query = $this->scopedTickets(Ticket::query())
            ->with(['category', 'region', 'channel', 'assignee']);

        $this->applyFilters($query, $request);

        $perPage = min(max($request->integer('per_page', 10), 1), 100);
        if (! $this->applySorting($query, $request, $this->ticketSortMap())) {
            $this->defaultOrder($query);
        }
        $paginator = $query->paginate($perPage)->withQueryString();

        $counts = $this->scopedTickets(Ticket::query());

        return Inertia::render('admin/matriks', [
            'tickets' => [
                'data' => collect($paginator->items())->map(fn (Ticket $t) => $this->ticketRow($t)),
                'meta' => $this->paginationMeta($paginator),
            ],
            'rekap' => [
                'total' => (clone $counts)->count(),
                'ews' => (clone $counts)
                    ->whereIn('status', [TicketStatus::Baru->value, TicketStatus::Verifikasi->value, TicketStatus::Diproses->value])
                    ->whereNotNull('sla_due_at')
                    ->where('sla_due_at', '<', now())
                    ->count(),
                'sla_pct' => $this->slaPercentage(),
                'by_status' => collect(TicketStatus::cases())->mapWithKeys(
                    fn (TicketStatus $s) => [$s->value => (clone $counts)->where('status', $s->value)->count()]
                ),
            ],
            'filters' => $this->filterProps($request),
            'options' => $this->formOptions(),
        ]);
    }

    /* -------------------------- Manajemen Tiket ------------------------- */

    public function tickets(Request $request): Response
    {
        $this->authorize('viewAny', Ticket::class);

        $query = $this->scopedTickets(Ticket::query())
            ->public()
            ->with(['category', 'region', 'channel', 'assignee']);

        $this->applyFilters($query, $request);

        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        if (! $this->applySorting($query, $request, $this->ticketSortMap())) {
            $this->defaultOrder($query);
        }
        $paginator = $query->paginate($perPage)->withQueryString();

        return Inertia::render('admin/tiket', [
            'tickets' => [
                'data' => collect($paginator->items())->map(fn (Ticket $t) => $this->ticketRow($t)),
                'meta' => $this->paginationMeta($paginator),
            ],
            'filters' => $this->filterProps($request),
            'statuses' => collect(TicketStatus::cases())->mapWithKeys(fn (TicketStatus $s) => [$s->value => $s->label()]),
        ]);
    }

    public function showTicket(Ticket $ticket): Response
    {
        $this->authorize('view', $ticket);

        $ticket->load(['category', 'region', 'channel', 'assignee', 'histories.actor', 'replies.author']);

        return Inertia::render('admin/tiket-detail', [
            'ticket' => $this->ticketDetail($ticket),
            'statuses' => collect(TicketStatus::cases())->mapWithKeys(fn (TicketStatus $s) => [$s->value => $s->label()]),
        ]);
    }

    public function updateStatus(UpdateTicketStatusRequest $request, Ticket $ticket): RedirectResponse
    {
        $this->authorize('update', $ticket);

        $this->tickets->changeStatus(
            $ticket,
            TicketStatus::from($request->validated('status')),
            $request->user(),
            $request->validated('note'),
        );

        $this->audit->safe('ticket.status_changed', $ticket, "Status tiket {$ticket->ticket_no} diubah.", [
            'status' => $request->validated('status'),
        ]);

        return back()->with('success', 'Status tiket diperbarui.');
    }

    public function reply(Request $request, Ticket $ticket): RedirectResponse
    {
        $this->authorize('reply', $ticket);

        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            'is_public' => ['nullable', 'boolean'],
        ]);

        $this->tickets->reply($ticket, $data['body'], $request->user(), $data['is_public'] ?? true);

        $this->audit->safe('ticket.replied', $ticket, "Tanggapan pada tiket {$ticket->ticket_no}.");

        return back()->with('success', 'Tanggapan terkirim.');
    }

    /** Unduh lampiran tiket (SEC-09) — hanya petugas ter-otorisasi. */
    public function attachment(Ticket $ticket): mixed
    {
        $this->authorize('view', $ticket);

        $file = $this->attachments->file($ticket->attachment_path);
        abort_if($file === null, 404);

        return response()->download($file->getPathname(), basename($ticket->attachment_path));
    }

    /* --------------------------- Tiket Internal -------------------------- */

    public function internal(Request $request): Response
    {
        $this->authorize('viewAny', Ticket::class);

        $query = $this->scopedTickets(Ticket::query())->internal();

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('q')) {
            $term = '%'.$request->string('q').'%';
            $query->where(fn ($q) => $q->where('title', 'like', $term)
                ->orWhere('ticket_no', 'like', $term)
                ->orWhere('reporter_name', 'like', $term));
        }

        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        if (! $this->applySorting($query, $request, $this->ticketSortMap())) {
            $this->defaultOrder($query);
        }
        $paginator = $query->paginate($perPage)->withQueryString();

        $base = $this->scopedTickets(Ticket::query())->internal();
        $resolved = (clone $base)->where('status', TicketStatus::Selesai->value)->whereNotNull('resolved_at');
        $avgHours = $resolved->get()->avg(fn (Ticket $t) => $t->created_at->diffInHours($t->resolved_at));

        $topCategory = (clone $base)
            ->select('category_id', DB::raw('count(*) as total'))
            ->whereNotNull('category_id')
            ->groupBy('category_id')
            ->orderByDesc('total')
            ->with('category')
            ->first();

        return Inertia::render('admin/internal', [
            'tickets' => [
                'data' => collect($paginator->items())->map(fn (Ticket $t) => [
                    'nomor' => $t->ticket_no,
                    'nama' => $t->reporter_name,
                    'kontak' => $t->reporter_phone,
                    'kategori' => $t->category?->name,
                    'urgensi' => $t->impact?->label(),
                    'status' => $t->status?->value,
                    'status_label' => $t->status?->label(),
                    'created_at' => $t->created_at?->toIso8601String(),
                ]),
                'meta' => $this->paginationMeta($paginator),
            ],
            'stats' => [
                'today' => (clone $base)->whereDate('created_at', today())->count(),
                'this_month' => (clone $base)->whereMonth('created_at', now()->month)->count(),
                'top_category' => $topCategory?->category?->name ?? '—',
                'avg_resolution_hours' => round((float) $avgHours, 1),
            ],
            'filters' => [
                'q' => $request->string('q')->toString(),
                'status' => $request->string('status')->toString(),
                'sort' => $request->string('sort')->toString(),
            ],
            'statuses' => collect(TicketStatus::cases())->mapWithKeys(fn (TicketStatus $s) => [$s->value => $s->label()]),
        ]);
    }

    /* --------------------------- Input Manual ---------------------------- */

    public function inputManualForm(): Response
    {
        $this->authorize('create', Ticket::class);

        return Inertia::render('admin/input-manual', [
            'options' => $this->formOptions(),
        ]);
    }

    public function storeManual(StoreInputManualRequest $request): RedirectResponse
    {
        $this->authorize('create', Ticket::class);

        $data = $request->validated();

        $ticket = $this->tickets->create([
            'title' => $data['judul'],
            'description' => $data['uraian'],
            'impact' => $data['impact'],
            'region_id' => $data['region_id'],
            'category_id' => $data['category_id'],
            'reporter_name' => $data['nama'],
            'reporter_nik' => $data['nik'] ?? null,
            'reporter_phone' => $data['telepon'] ?? null,
            'actor_id' => $request->user()->id,
        ]);

        $this->audit->safe('ticket.created_manual', $ticket, "Tiket {$ticket->ticket_no} dibuat lewat input manual.");

        return redirect()
            ->route('admin.matriks')
            ->with('success', "Tiket {$ticket->ticket_no} berhasil diterbitkan dari input manual.");
    }

    /* ------------------------------ Chat --------------------------------- */

    public function chat(Request $request): Response
    {
        $this->authorize('viewAny', Ticket::class);

        $conversations = ChatConversation::query()
            ->with(['user', 'messages' => fn ($q) => $q->latest()->limit(1)])
            ->orderByDesc('last_message_at')
            ->limit(50)
            ->get()
            ->map(fn (ChatConversation $c) => [
                'id' => $c->id,
                'nama' => $c->user?->name ?? 'Tamu',
                'inisial' => mb_strtoupper(mb_substr($c->user?->name ?? 'T', 0, 1)),
                'subjek' => $c->subject,
                'cuplikan' => $c->messages->first()?->body,
                'unread' => $c->unread_admin,
                'last_message_at' => $c->last_message_at?->toIso8601String(),
            ]);

        $activeId = $request->integer('conversation') ?: ($conversations->first()['id'] ?? null);
        $active = $activeId ? $this->conversationThread((int) $activeId) : null;

        // Tandai sudah dibaca saat admin membuka percakapan.
        if ($active) {
            ChatConversation::query()->whereKey($active['id'])->update(['unread_admin' => 0]);
        }

        return Inertia::render('admin/chat', [
            'conversations' => $conversations,
            'active' => $active,
        ]);
    }

    public function sendChat(Request $request, ChatConversation $conversation): RedirectResponse
    {
        $this->authorize('viewAny', Ticket::class);

        $data = $request->validate(['body' => ['required', 'string', 'max:2000']]);

        $this->chat->send($conversation, $data['body'], 'admin', $request->user()->id);

        return back()->with('success', 'Balasan terkirim.');
    }

    /* --------------------------- Daftar Admin ---------------------------- */

    public function admins(): Response
    {
        $this->authorize('manageAdmins', User::class);

        return Inertia::render('admin/admins', [
            'admins' => User::query()
                ->whereIn('role', UserRole::adminValues())
                ->with('region')
                ->orderBy('id')
                ->get()
                ->map(fn (User $u) => [
                    'id' => $u->id,
                    'nama' => $u->name,
                    'inisial' => mb_strtoupper(mb_substr($u->name, 0, 1)),
                    'nip' => $u->username,
                    'wilayah' => $u->region?->name ?? 'Pusat',
                    'role' => $u->role?->label(),
                    'role_value' => $u->role?->value,
                    'status' => $u->is_active ? 'Aktif' : 'Nonaktif',
                ]),
            'regions' => Region::query()->orderBy('id')->get(['id', 'name']),
            'roles' => collect([UserRole::AdminKawasan, UserRole::SuperAdmin])
                ->map(fn (UserRole $r) => ['value' => $r->value, 'label' => $r->label()]),
        ]);
    }

    public function storeAdmin(Request $request): RedirectResponse
    {
        $this->authorize('manageAdmins', User::class);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'nip' => ['required', 'string', 'max:50', 'unique:users,username'],
            'role' => ['required', Rule::in(UserRole::adminValues())],
            'region_id' => ['nullable', 'integer', 'exists:regions,id'],
            'password' => ['required', 'string', Password::min(8)],
        ]);

        User::create([
            'name' => $data['name'],
            'username' => $data['nip'],
            'role' => UserRole::from($data['role']),
            'region_id' => $data['region_id'] ?? null,
            'password' => $data['password'],
            'is_active' => true,
        ]);

        $this->audit->safe('admin.created', null, "Akun admin {$data['name']} ({$data['nip']}) dibuat.", [
            'role' => $data['role'],
        ]);

        return back()->with('success', 'Admin baru berhasil disimpan.');
    }

    /** Log aktivitas admin (PRD SEC-08) — super admin saja. */
    public function activityLog(Request $request): Response
    {
        $this->authorize('manageAdmins', User::class);

        $query = ActivityLog::query()->with('user');

        if ($request->filled('action')) {
            $query->where('action', $request->string('action'));
        }
        if ($request->filled('q')) {
            $term = '%'.$request->string('q').'%';
            $query->where(fn ($q) => $q->where('username', 'like', $term)->orWhere('description', 'like', $term));
        }

        $perPage = min(max($request->integer('per_page', 20), 1), 100);
        if (! $this->applySorting($query, $request, [
            'created_at' => 'created_at',
            'username' => 'username',
            'action' => 'action',
        ])) {
            $this->defaultOrder($query);
        }
        $paginator = $query->paginate($perPage)->withQueryString();

        return Inertia::render('admin/log-aktivitas', [
            'logs' => [
                'data' => collect($paginator->items())->map(fn (ActivityLog $l) => [
                    'id' => $l->id,
                    'username' => $l->username ?? $l->user?->name ?? 'Sistem',
                    'action' => $l->action,
                    'description' => $l->description,
                    'ip_address' => $l->ip_address,
                    'created_at' => $l->created_at?->toIso8601String(),
                ]),
                'meta' => $this->paginationMeta($paginator),
            ],
            'filters' => [
                'action' => $request->string('action')->toString(),
                'q' => $request->string('q')->toString(),
                'sort' => $request->string('sort')->toString(),
            ],
            'actions' => ActivityLog::query()->select('action')->distinct()->orderBy('action')->pluck('action'),
        ]);
    }

    /* --------------------------- Data Kawasan ---------------------------- */

    public function kawasan(): Response
    {
        $this->authorize('manageMaster', User::class);

        return Inertia::render('admin/kawasan', [
            'regions' => Region::query()->orderBy('id')->get()->map(fn (Region $r) => [
                'id' => $r->id,
                'code' => $r->code,
                'name' => $r->name,
                'province' => $r->province,
                'latitude' => $r->latitude,
                'longitude' => $r->longitude,
                'infrastructure_status' => $r->infrastructure_status,
                'kk_count' => $r->kk_count,
                'is_active' => (bool) $r->is_active,
            ]),
        ]);
    }

    public function storeRegion(Request $request): RedirectResponse
    {
        $this->authorize('manageMaster', User::class);

        Region::create($request->validate([
            'code' => ['required', 'string', 'max:30', 'unique:regions,code'],
            'name' => ['required', 'string', 'max:150'],
            'province' => ['nullable', 'string', 'max:100'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'infrastructure_status' => ['nullable', 'string', 'max:50'],
            'kk_count' => ['nullable', 'integer', 'min:0'],
        ]));

        $this->audit->safe('region.created', null, "Kawasan {$request->input('name')} ditambahkan.");

        return back()->with('success', 'Kawasan baru berhasil ditambahkan.');
    }

    public function updateRegion(Request $request, Region $region): RedirectResponse
    {
        $this->authorize('manageMaster', User::class);

        $region->update($request->validate([
            'code' => ['sometimes', 'string', 'max:30', Rule::unique('regions', 'code')->ignore($region->id)],
            'name' => ['sometimes', 'string', 'max:150'],
            'province' => ['nullable', 'string', 'max:100'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'infrastructure_status' => ['nullable', 'string', 'max:50'],
            'kk_count' => ['nullable', 'integer', 'min:0'],
        ]));

        $this->audit->safe('region.updated', $region, "Kawasan {$region->name} diperbarui.");

        return back()->with('success', 'Data kawasan diperbarui.');
    }

    public function destroyRegion(Region $region): RedirectResponse
    {
        $this->authorize('manageMaster', User::class);

        $region->delete();

        $this->audit->safe('region.deleted', null, "Kawasan {$region->name} dihapus.");

        return back()->with('success', 'Kawasan dihapus.');
    }

    /* --------------------------- Manajemen Kanal ------------------------- */

    public function kanal(): Response
    {
        $this->authorize('manageMaster', User::class);

        return Inertia::render('admin/kanal', [
            'channels' => Channel::query()->orderBy('id')->get()->map(fn (Channel $c) => [
                'id' => $c->id,
                'type' => $c->type?->value,
                'type_label' => $c->type?->label(),
                'name' => $c->name,
                'account_name' => $c->account_name,
                'url' => $c->url,
                'status' => $c->status,
                'last_synced_at' => $c->last_synced_at?->toIso8601String(),
            ]),
            'integrations' => collect($this->adapters->keys())->map(fn (string $key) => [
                'key' => $key,
                'label' => $key === 'wbs' ? 'Whistleblowing System' : 'SP4N-LAPOR!',
            ]),
            'logs' => ChannelSyncLog::query()->latest()->limit(50)->get([
                'channel', 'pulled_count', 'status', 'message', 'created_at',
            ]),
            'is_super_admin' => request()->user()?->isSuperAdmin() ?? false,
        ]);
    }

    public function storeChannel(Request $request): RedirectResponse
    {
        $this->authorize('manageMaster', User::class);

        Channel::create($request->validate([
            'type' => ['required', Rule::in(['sosmed', 'kantor', 'nasional', 'internal'])],
            'name' => ['required', 'string', 'max:120'],
            'account_name' => ['nullable', 'string', 'max:120'],
            'url' => ['nullable', 'url', 'max:500'],
            'status' => ['nullable', 'string', 'max:30'],
        ]));

        $this->audit->safe('channel.created', null, "Kanal {$request->input('name')} ditambahkan.");

        return back()->with('success', 'Kanal berhasil ditambahkan.');
    }

    public function syncChannel(Request $request, string $channel): RedirectResponse
    {
        $this->authorize('manageAdmins', User::class);

        if (! in_array(strtolower($channel), $this->adapters->keys(), true)) {
            return back()->with('error', 'Kanal integrasi tidak dikenal.');
        }

        $result = $this->adapters->for($channel)->sync();

        Channel::query()
            ->where('name', 'like', '%'.($channel === 'wbs' ? 'Whistle' : 'SP4N').'%')
            ->update(['last_synced_at' => now()]);

        $this->audit->safe('channel.synced', null, "Sinkronisasi kanal {$channel} ({$result->pulledCount} data).");

        return back()->with('success', "Sinkronisasi {$channel} selesai ({$result->pulledCount} data).");
    }

    /* ----------------------------- Pengaturan ---------------------------- */

    public function pengaturan(): Response
    {
        $this->authorize('manageMaster', User::class);

        $notification = Setting::get('notification', ['pic_email' => null, 'pic_phone' => null]);

        return Inertia::render('admin/pengaturan', [
            'settings' => [
                'sla_response_minutes' => (int) Setting::get('sla_response_minutes', 60),
                'ews_enabled' => (bool) Setting::get('ews_enabled', true),
                'auto_disposition' => (bool) Setting::get('auto_disposition', false),
                'notification' => [
                    'pic_email' => $notification['pic_email'] ?? null,
                    'pic_phone' => $notification['pic_phone'] ?? null,
                ],
            ],
            'categories' => Category::query()->orderBy('id')->get(['id', 'name', 'slug', 'sla_days']),
        ]);
    }

    public function updatePengaturan(Request $request): RedirectResponse
    {
        $this->authorize('manageMaster', User::class);

        $data = $request->validate([
            'sla_response_minutes' => ['nullable', 'integer', 'min:1'],
            'ews_enabled' => ['nullable', 'boolean'],
            'auto_disposition' => ['nullable', 'boolean'],
            'notification' => ['nullable', 'array'],
            'notification.pic_email' => ['nullable', 'email'],
            'notification.pic_phone' => ['nullable', 'string', 'max:30'],
        ]);

        if (isset($data['notification'])) {
            // PRD D10: WhatsApp selalu nonaktif pada fase ini.
            $data['notification']['whatsapp_enabled'] = false;
            Setting::put('notification', $data['notification']);
            unset($data['notification']);
        }

        foreach ($data as $key => $value) {
            Setting::put($key, $value);
        }

        $this->audit->safe('settings.updated', null, 'Pengaturan sistem diperbarui.', [
            'keys' => array_keys($data),
        ]);

        return back()->with('success', 'Pengaturan disimpan.');
    }

    public function storeCategory(Request $request): RedirectResponse
    {
        $this->authorize('manageMaster', User::class);

        $data = $request->validate(['name' => ['required', 'string', 'max:120']]);

        Category::create([
            'name' => $data['name'],
            'slug' => \Illuminate\Support\Str::slug($data['name']),
            'is_active' => true,
        ]);

        $this->audit->safe('category.created', null, "Kategori {$data['name']} ditambahkan.");

        return back()->with('success', 'Kategori ditambahkan.');
    }

    public function destroyCategory(Category $category): RedirectResponse
    {
        $this->authorize('manageMaster', User::class);

        $category->delete();

        $this->audit->safe('category.deleted', null, "Kategori {$category->name} dihapus.");

        return back()->with('success', 'Kategori dihapus.');
    }

    /* ------------------------------ Helpers ------------------------------ */

    private function scopedTickets($query)
    {
        return $query->visibleTo(request()->user());
    }

    /**
     * Terapkan sorting dari query `sort=kolom:arah` (SEC: hanya kolom
     * pada whitelist $map yang diterima, mencegah injeksi nama kolom).
     *
     * @param  array<string, string>  $map  peta kunci-sort => nama kolom DB
     * @return bool true bila sorting diterapkan
     */
    private function applySorting($query, Request $request, array $map): bool
    {
        $sort = $request->string('sort')->toString();
        if ($sort === '') {
            return false;
        }

        $parts = explode(':', $sort, 2);
        $key = $parts[0];
        $dir = ($parts[1] ?? 'asc') === 'desc' ? 'desc' : 'asc';

        if (! isset($map[$key])) {
            return false;
        }

        $query->orderBy($map[$key], $dir);

        return true;
    }

    /** Urutkan default (terbaru) bila tidak ada sorting eksplisit. */
    private function defaultOrder($query): void
    {
        $query->latest();
    }

    /** Kolom tiket yang boleh dipakai untuk sorting server-side. */
    private function ticketSortMap(): array
    {
        return [
            'nomor' => 'ticket_no',
            'judul' => 'title',
            'pelapor' => 'reporter_name',
            'nama' => 'reporter_name',
            'status' => 'status',
            'prioritas' => 'priority',
            'impact' => 'impact',
            'urgensi' => 'impact',
            'kategori' => 'category_id',
            'kawasan' => 'region_id',
            'created_at' => 'created_at',
            'tenggat_sla' => 'sla_due_at',
            'overdue' => 'sla_due_at',
        ];
    }

    private function applyFilters($query, Request $request): void
    {
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('region_id')) {
            $query->where('region_id', $request->integer('region_id'));
        }
        if ($request->filled('category_id')) {
            $query->where('category_id', $request->integer('category_id'));
        }
        if ($request->filled('impact')) {
            $query->where('impact', $request->string('impact'));
        }
        if ($request->filled('q')) {
            $term = '%'.$request->string('q').'%';
            $query->where(fn ($q) => $q->where('title', 'like', $term)->orWhere('ticket_no', 'like', $term));
        }
    }

    /** @return array<string, mixed> */
    private function filterProps(Request $request): array
    {
        return [
            'q' => $request->string('q')->toString(),
            'status' => $request->string('status')->toString(),
            'region_id' => $request->string('region_id')->toString(),
            'category_id' => $request->string('category_id')->toString(),
            'impact' => $request->string('impact')->toString(),
            'sort' => $request->string('sort')->toString(),
        ];
    }

    /** @return array<string, mixed> */
    private function formOptions(): array
    {
        return [
            'regions' => Region::query()->where('is_active', true)->orderBy('id')->get(['id', 'name', 'province']),
            'categories' => Category::query()->where('is_active', true)->orderBy('id')->get(['id', 'name']),
        ];
    }

    /** @return array<string, mixed> */
    private function ticketRow(Ticket $t): array
    {
        return [
            'nomor' => $t->ticket_no,
            'judul' => $t->title,
            'pelapor' => $t->reporter_name,
            'status' => $t->status?->value,
            'status_label' => $t->status?->label(),
            'prioritas' => $t->priority?->value,
            'impact' => $t->impact?->value,
            'impact_label' => $t->impact?->label(),
            'kategori' => $t->category?->name,
            'kawasan' => $t->region?->name,
            'is_internal' => (bool) $t->is_internal,
            'created_at' => $t->created_at?->toIso8601String(),
            'tenggat_sla' => $t->sla_due_at?->toIso8601String(),
            'overdue' => $t->isOverdue(),
        ];
    }

    /** @return array<string, mixed> */
    private function ticketDetail(Ticket $t): array
    {
        return array_merge($this->ticketRow($t), [
            'deskripsi' => $t->description,
            'nik' => $t->maskedNik(),
            'email' => $t->reporter_email,
            'telepon' => $t->reporter_phone,
            'kanal' => $t->channel?->name,
            'petugas' => $t->assignee?->name,
            'riwayat' => $t->histories->map(fn ($h) => [
                'dari' => $h->from_status,
                'ke' => $h->to_status,
                'catatan' => $h->note,
                'oleh' => $h->actor?->name,
                'pada' => $h->created_at?->toIso8601String(),
            ]),
            'tanggapan' => $t->replies->map(fn ($r) => [
                'id' => $r->id,
                'penulis' => $r->author?->name ?? 'Pelapor',
                'body' => $r->body,
                'is_public' => (bool) $r->is_public,
                'pada' => $r->created_at?->toIso8601String(),
            ]),
            'has_attachment' => (bool) $t->attachment_path,
        ]);
    }

    /** @return array<string, mixed> */
    private function conversationThread(int $id): array
    {
        $conversation = ChatConversation::query()->with('user')->findOrFail($id);

        return [
            'id' => $conversation->id,
            'nama' => $conversation->user?->name ?? 'Tamu',
            'inisial' => mb_strtoupper(mb_substr($conversation->user?->name ?? 'T', 0, 1)),
            'messages' => $conversation->messages()->with('sender')->get()->map(fn (ChatMessage $m) => [
                'id' => $m->id,
                'body' => $m->body,
                'sender_type' => $m->sender_type,
                'penulis' => $m->sender_type === 'admin' ? ($m->sender?->name ?? 'Admin') : ($conversation->user?->name ?? 'Tamu'),
                'pada' => $m->created_at?->toIso8601String(),
            ]),
        ];
    }

    private function slaPercentage(): float
    {
        $finished = $this->scopedTickets(Ticket::query())
            ->where('status', TicketStatus::Selesai->value)
            ->whereNotNull('sla_due_at')
            ->get(['sla_due_at', 'resolved_at']);

        if ($finished->isEmpty()) {
            return 100.0;
        }

        $met = $finished->filter(fn (Ticket $t) => $t->resolved_at && $t->resolved_at->lessThanOrEqualTo($t->sla_due_at))->count();

        return round($met / $finished->count() * 100, 1);
    }

    /** @return array<string, mixed> */
    private function paginationMeta($paginator): array
    {
        return [
            'total' => $paginator->total(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
        ];
    }
}