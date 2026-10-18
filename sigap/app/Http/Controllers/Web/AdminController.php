<?php

namespace App\Http\Controllers\Web;

use App\Enums\TicketImpact;
use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreInputManualRequest;
use App\Http\Requests\UpdateTicketStatusRequest;
use App\Models\ActivityLog;
use App\Models\Category;
use App\Models\Channel;
use App\Models\ChannelSyncLog;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\Portal;
use App\Models\Referral;
use App\Models\Region;
use App\Models\Setting;
use App\Models\Ticket;
use App\Models\User;
use App\Services\AccountService;
use App\Services\Ai\AssistantService;
use App\Services\Ai\TicketSuggester;
use App\Services\AttachmentService;
use App\Services\AuditService;
use App\Services\Channels\ChannelAdapterManager;
use App\Services\ChatService;
use App\Services\ContactCenterStats;
use App\Services\StatsService;
use App\Services\TicketService;
use App\Support\Search;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
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
        private readonly StatsService $stats,
        private readonly AccountService $accounts,
        private readonly ContactCenterStats $contactCenterStats,
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
        $byStatus = $this->stats->statusCounts($counts);

        return Inertia::render('admin/matriks', [
            'tickets' => [
                'data' => collect($paginator->items())->map(fn (Ticket $t) => $this->ticketRow($t)),
                'meta' => $this->paginationMeta($paginator),
            ],
            // D-05: agregat SQL (tanpa memuat semua tiket).
            'rekap' => [
                'total' => array_sum($byStatus),
                'ews' => $this->stats->overdueCount($counts),
                'sla_pct' => $this->stats->slaPercentage($counts),
                'by_status' => $byStatus,
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

        $this->audit->safe('ticket.attachment_downloaded', $ticket, "Lampiran tiket {$ticket->ticket_no} diunduh.");

        return response()->download($file->getPathname(), basename($ticket->attachment_path));
    }

    /* --------------------------- Tiket Internal -------------------------- */

    /** Tiket internal pegawai — super admin saja (A-05). */
    public function internal(Request $request): Response
    {
        $this->authorize('viewInternal', Ticket::class);

        $query = $this->scopedTickets(Ticket::query())->internal()->with('category');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('q')) {
            Search::apply($query, ['title', 'ticket_no', 'reporter_name', 'reporter_unit'], $request->string('q')->toString());
        }

        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        if (! $this->applySorting($query, $request, $this->ticketSortMap())) {
            $this->defaultOrder($query);
        }
        $paginator = $query->paginate($perPage)->withQueryString();

        $base = $this->scopedTickets(Ticket::query())->internal();

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
                    'nip' => $t->reporter_nip,
                    'unit' => $t->reporter_unit,
                    'lokasi' => $t->location,
                    'kategori' => $t->category?->name,
                    'urgensi' => $t->impact?->label(),
                    'status' => $t->status?->value,
                    'status_label' => $t->status?->label(),
                    'created_at' => $t->created_at?->toIso8601String(),
                ]),
                'meta' => $this->paginationMeta($paginator),
            ],
            'stats' => [
                'today' => $this->stats->todayCount($base),
                'this_month' => $this->stats->thisMonthCount($base),
                'top_category' => $topCategory?->category?->name ?? '—',
                'avg_resolution_hours' => $this->stats->averageResolutionHours($base),
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

    public function inputManualForm(Request $request): Response
    {
        $this->authorize('create', Ticket::class);

        $user = $request->user();
        $conversation = $request->integer('percakapan')
            ? ChatConversation::query()->with('user')->whereNull('ticket_id')->find($request->integer('percakapan'))
            : null;

        return Inertia::render('admin/input-manual', [
            'options' => $this->formOptions(),
            // A-11: admin kawasan selalu menerbitkan tiket ke kawasannya sendiri.
            'region_locked' => $user->role === UserRole::AdminKawasan,
            'own_region' => $user->region ? ['id' => $user->region->id, 'name' => $user->region->name] : null,
            // Tiket dari percakapan contact center: formulir diisi dari ringkasan AI.
            'prefill' => $conversation ? $this->ticketPrefill($conversation) : null,
        ]);
    }

    public function storeManual(StoreInputManualRequest $request): RedirectResponse
    {
        $this->authorize('create', Ticket::class);

        // A-11: admin kawasan dipaksa ke kawasannya; lampiran & sumber disimpan.
        $ticket = $this->tickets->create($request->ticketData($request->user()));

        $this->audit->safe('ticket.created_manual', $ticket, "Tiket {$ticket->ticket_no} dibuat lewat input manual.");

        $conversation = $request->validated('percakapan_id')
            ? ChatConversation::query()->whereNull('ticket_id')->find($request->validated('percakapan_id'))
            : null;

        if ($conversation) {
            // Nomor tiket dikirim ke percakapan yang sama; percakapan ditutup "jadi tiket".
            $this->chat->send($conversation, "Tiket {$ticket->ticket_no} telah diterbitkan untuk laporan Anda. Perkembangannya dapat dipantau di halaman Lacak Tiket.", 'system', null, [
                'kind' => 'tiket_terbit',
                'tiket' => ['nomor' => $ticket->ticket_no, 'url' => '/lacak/'.$ticket->ticket_no],
            ]);
            $this->chat->close($conversation, 'tiket', $request->user()->id, $ticket);

            return redirect()
                ->route('admin.chat', ['conversation' => $conversation->id])
                ->with('success', "Tiket {$ticket->ticket_no} diterbitkan dan dikirim ke percakapan.");
        }

        return redirect()
            ->route('admin.matriks')
            ->with('success', "Tiket {$ticket->ticket_no} berhasil diterbitkan dari input manual.");
    }

    /** @return array<string, mixed> */
    private function ticketPrefill(ChatConversation $conversation): array
    {
        $summary = trim((string) $conversation->ai_summary);
        $wargaMessages = $conversation->messages()->getQuery()
            ->whereIn('sender_type', ['user', 'guest'])
            ->reorder('id')
            ->limit(10)
            ->pluck('body')
            ->implode("\n- ");
        $contact = (string) $conversation->contact;

        return [
            'percakapan_id' => $conversation->id,
            'referensi' => $conversation->reference,
            'nama' => $conversation->participantName(),
            'telepon' => preg_match('/^[\d\s.+-]+$/', $contact) ? $contact : '',
            'judul' => Str::limit($summary !== '' ? Str::before($summary, '.') : 'Aduan dari live chat', 120, ''),
            'uraian' => trim(($summary !== '' ? "Ringkasan asisten: {$summary}\n\n" : '')."Pesan warga di live chat:\n- {$wargaMessages}"),
        ];
    }

    /* ------------------------------ Chat --------------------------------- */

    /**
     * Live chat panel admin.
     *
     * Catatan otorisasi (A-05): percakapan chat TIDAK terikat kawasan (warga
     * dan tamu belum memilih kawasan saat membuka chat), sehingga SEMUA admin —
     * super admin maupun admin kawasan — dapat melihat & membalas semua
     * percakapan. Ini perilaku yang disengaja; kanal broadcast `chat.{id}`
     * mengikuti aturan yang sama (routes/channels.php).
     */
    public function chat(Request $request): Response
    {
        $this->authorize('viewAny', Ticket::class);

        // Tab Kotak Masuk. Tanpa asisten AI, bawaannya "semua" (live chat lama).
        $tabs = [
            'menunggu' => fn ($q) => $q->whereNull('closed_at')->where('handled_by', ChatConversation::HANDLED_STAFF),
            'ai' => fn ($q) => $q->whereNull('closed_at')->where('handled_by', ChatConversation::HANDLED_AI),
            'selesai' => fn ($q) => $q->whereNotNull('closed_at'),
            'semua' => fn ($q) => $q,
        ];
        $tab = $request->string('tab')->toString();
        if (! array_key_exists($tab, $tabs)) {
            $tab = AssistantService::enabled() ? 'menunggu' : 'semua';
        }
        $scoped = fn () => $tabs[$tab](ChatConversation::query());

        $activeId = $request->integer('conversation') ?: $scoped()->orderByDesc('last_message_at')->value('id');

        // Tandai dibaca DULU, baru susun daftar — agar badge percakapan aktif
        // langsung hilang pada respons yang sama (bukan menunggu reload).
        if ($activeId && ($conversation = ChatConversation::query()->find($activeId))) {
            $this->chat->markReadByAdmin($conversation);
        } else {
            $activeId = null;
        }

        $conversations = $scoped()
            ->with(['user', 'assignee:id,name', 'messages' => fn ($q) => $q->latest()->limit(1)])
            ->orderByDesc('last_message_at')
            ->limit(100)
            ->get()
            ->map(fn (ChatConversation $c) => [
                'id' => $c->id,
                'nama' => $c->participantName(),
                'inisial' => mb_strtoupper(mb_substr($c->participantName(), 0, 1)),
                'tipe' => $c->user_id ? 'warga' : 'tamu',
                'subjek' => $c->subject,
                'cuplikan' => $c->ai_summary ?? $c->messages->first()?->body,
                'unread' => $c->unread_admin,
                'last_message_at' => $c->last_message_at?->toIso8601String(),
                'mode' => $c->handled_by,
                'alasan' => self::HANDOFF_REASONS[$c->handoff_reason] ?? null,
                'diteruskan_at' => $c->handoff_at?->toIso8601String(),
                'hasil' => $c->outcome ? ChatConversation::OUTCOMES[$c->outcome] ?? $c->outcome : null,
                'referensi' => $c->reference,
                'butuh_dihubungi' => $c->contact !== null && $c->closed_at === null,
                'petugas' => $c->assignee?->name,
            ]);

        return Inertia::render('admin/chat', [
            'conversations' => $conversations,
            'active' => $activeId ? $this->conversationThread((int) $activeId) : null,
            'tab' => $tab,
            'tab_counts' => collect($tabs)->map(fn ($scope) => $scope(ChatConversation::query())->count()),
            'ai_enabled' => AssistantService::enabled(),
            'kpi' => AssistantService::enabled() ? $this->contactCenterStats->overview() : null,
            'outcomes' => collect(ChatConversation::OUTCOMES)->only(['terjawab_petugas', 'lapor', 'wbs', 'tidak_selesai']),
            // Pilihan untuk "Terbitkan tiket" langsung dari Kotak Masuk.
            'ticket_options' => [
                'kawasan' => Region::query()->orderBy('name')->get(['id', 'name']),
                'kategori' => Category::query()->orderBy('name')->get(['id', 'name']),
                'dampak' => collect(TicketImpact::cases())->map(fn (TicketImpact $i) => [
                    'value' => $i->value,
                    'label' => $i->label(),
                    'hari' => $i->resolveDays(),
                ]),
                'kawasan_tetap' => $request->user()->isSuperAdmin() ? null : $request->user()->region_id,
            ],
            // Portal tujuan rujukan yang dilacak sampai warga berhasil (menu "Rujuk ke portal").
            'portal_rujukan' => Portal::query()->publicActive()->where('track_completion', true)->orderBy('sort')
                ->get(['code', 'name', 'purpose', 'is_reachable'])
                ->map(fn (Portal $p) => ['kode' => $p->code, 'nama' => $p->name, 'kegunaan' => $p->purpose, 'tersedia' => $p->is_reachable]),
        ]);
    }

    /** Label alasan percakapan diteruskan ke petugas. */
    private const HANDOFF_REASONS = [
        'aduan' => 'Aduan',
        'pribadi' => 'Hak pribadi',
        'diminta' => 'Diminta warga',
        'ai_gagal' => 'AI gagal menjawab',
        'diambil_petugas' => 'Diambil petugas',
        'rujukan' => 'Kendala rujukan',
        'portal_gangguan' => 'Portal tujuan gangguan',
    ];

    /**
     * GET /admin/chat/{id}/saran-tiket — isian tiket yang disarankan dari
     * percakapan (kawasan, kategori, dampak, judul, uraian). Petugas tetap
     * memeriksa dan menerbitkan sendiri.
     */
    public function ticketSuggestion(Request $request, ChatConversation $conversation, TicketSuggester $suggester): JsonResponse
    {
        $this->authorize('viewAny', Ticket::class);

        $user = $request->user();
        $suggestion = $suggester->suggest($conversation, $user->isSuperAdmin() ? null : $user->region_id);
        $contact = (string) $conversation->contact;

        return response()->json($suggestion + [
            'nama' => $conversation->participantName(),
            'telepon' => preg_match('/^[\d\s.+-]+$/', $contact) ? $contact : '',
        ]);
    }

    /** POST /admin/chat/{id}/baca — dipanggil saat pesan baru masuk ke utas yang sedang dibuka. */
    public function readChat(ChatConversation $conversation): JsonResponse
    {
        $this->authorize('viewAny', Ticket::class);

        $this->chat->markReadByAdmin($conversation);

        return response()->json(['total' => ChatConversation::unreadForAdmins()]);
    }

    /** GET /admin/chat/belum-dibaca — fallback polling badge sidebar bila WebSocket mati. */
    public function chatUnread(): JsonResponse
    {
        $this->authorize('viewAny', Ticket::class);

        return response()->json(['total' => ChatConversation::unreadForAdmins()]);
    }

    public function sendChat(Request $request, ChatConversation $conversation): RedirectResponse
    {
        $this->authorize('viewAny', Ticket::class);

        $request->merge(['body' => trim((string) $request->input('body'))]);
        $data = $request->validate(['body' => ['required', 'string', 'max:2000']]);

        // Membalas percakapan yang masih dijawab AI = mengambil alih (AI berhenti).
        if ($conversation->isWithAssistant() || $conversation->assigned_to === null) {
            $this->chat->takeOver($conversation, $request->user()->id);
        }

        $this->chat->send($conversation, $data['body'], 'admin', $request->user()->id);
        // Membalas berarti sudah membaca.
        $this->chat->markReadByAdmin($conversation);

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

        $data = $request->validate(self::adminRules($request), self::adminMessages());

        $created = User::create([
            'name' => $data['name'],
            'username' => $data['nip'],
            'role' => UserRole::from($data['role']),
            'region_id' => $data['region_id'] ?? null,
            'password' => $data['password'],
            'is_active' => true,
        ]);

        $this->audit->safe('admin.created', $created, "Akun admin {$data['name']} ({$data['nip']}) dibuat.", [
            'role' => $data['role'],
        ]);

        return back()->with('success', 'Admin baru berhasil disimpan.');
    }

    /**
     * Aturan validasi akun admin baru — dipakai juga oleh API (MasterController).
     *
     * A-05: admin kawasan WAJIB memiliki kawasan. A-18: kata sandi minimal 12
     * karakter dengan huruf besar, huruf kecil & angka.
     *
     * @return array<string, mixed>
     */
    public static function adminRules(Request $request): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'nip' => ['required', 'string', 'max:50', 'unique:users,username'],
            'role' => ['required', Rule::in(UserRole::adminValues())],
            'region_id' => [
                Rule::requiredIf(fn () => $request->input('role') === UserRole::AdminKawasan->value),
                'nullable', 'integer', 'exists:regions,id',
            ],
            'password' => ['required', 'string', self::adminPasswordRule()],
        ];
    }

    /** @return array<string, string> */
    public static function adminMessages(): array
    {
        return [
            'region_id.required' => 'Admin kawasan wajib memiliki kawasan tugas.',
        ];
    }

    public static function adminPasswordRule(): Password
    {
        return Password::min(12)->mixedCase()->numbers();
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
            Search::apply($query, ['username', 'description'], $request->string('q')->toString());
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
                'can_edit' => request()->user()->can('updateRegion', [User::class, $r]),
            ]),
            // A-05: hanya super admin yang dapat menambah/menghapus kawasan.
            'is_super_admin' => request()->user()->isSuperAdmin(),
            'own_region_id' => request()->user()->region_id,
        ]);
    }

    public function storeRegion(Request $request): RedirectResponse
    {
        $this->authorize('manageAdmins', User::class);

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
        // A-05: admin kawasan hanya boleh mengubah kawasannya sendiri.
        $this->authorize('updateRegion', [User::class, $region]);

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
        $this->authorize('manageAdmins', User::class);

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
        $this->authorize('manageAdmins', User::class);

        Channel::create($request->validate([
            'type' => ['required', Rule::in(['sosmed', 'kantor', 'nasional', 'internal'])],
            'name' => ['required', 'string', 'max:120'],
            'account_name' => ['nullable', 'string', 'max:120'],
            'url' => ['nullable', 'url:http,https', 'max:500'],
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
            // A-05: pengaturan & kategori hanya dapat diubah super admin.
            'can_edit' => request()->user()->isSuperAdmin(),
        ]);
    }

    public function updatePengaturan(Request $request): RedirectResponse
    {
        $this->authorize('manageAdmins', User::class);

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

    /**
     * Profil admin sendiri (nama & kata sandi) — semua peran admin.
     *
     * Ganti kata sandi wajib `current_password` + konfirmasi dan mengikuti
     * kebijakan kata sandi admin (A-18). Sesi/token lain dicabut (D-02).
     */
    public function updateOwnProfile(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'current_password' => ['nullable', 'required_with:password', 'string', 'current_password:web'],
            'password' => ['nullable', 'string', 'confirmed', self::adminPasswordRule()],
        ], [
            'current_password.required_with' => 'Masukkan kata sandi saat ini untuk mengganti kata sandi.',
            'current_password.current_password' => 'Kata sandi saat ini tidak sesuai.',
            'password.confirmed' => 'Konfirmasi kata sandi tidak cocok.',
        ]);

        if ($data['name'] !== $user->name) {
            $user->forceFill(['name' => $data['name']])->save();
            $this->audit->safe('account.profile_updated', $user, 'Profil admin diperbarui.', ['fields' => ['name']]);
        }

        if (! empty($data['password'])) {
            $this->accounts->updateProfile($user, ['password' => $data['password']], $request->session()->getId());
        }

        return back()->with('success', 'Profil berhasil diperbarui.');
    }

    public function storeCategory(Request $request): RedirectResponse
    {
        $this->authorize('manageAdmins', User::class);

        $data = $request->validate(['name' => ['required', 'string', 'max:120']]);

        Category::create([
            'name' => $data['name'],
            'slug' => Str::slug($data['name']),
            'is_active' => true,
        ]);

        $this->audit->safe('category.created', null, "Kategori {$data['name']} ditambahkan.");

        return back()->with('success', 'Kategori ditambahkan.');
    }

    public function destroyCategory(Category $category): RedirectResponse
    {
        $this->authorize('manageAdmins', User::class);

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
            Search::apply($query, ['title', 'ticket_no'], $request->string('q')->toString());
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
            // Kode akses pelacakan publik — diberikan kepada pelapor bila perlu.
            'kode_akses' => $t->lookup_token,
            'nik' => $t->maskedNik(),
            'email' => $t->reporter_email,
            'telepon' => $t->reporter_phone,
            'kanal' => $t->channel?->name,
            'petugas' => $t->assignee?->name,
            'visibility' => $t->visibility?->value,
            'nip' => $t->reporter_nip,
            'unit' => $t->reporter_unit,
            'lokasi' => $t->location,
            'sumber_laporan' => $t->source,
            'tautan' => $t->source_url,
            'admin_penerima' => $t->received_by,
            // A-20: status tujuan yang diizinkan dari status saat ini.
            'transisi' => $t->status ? array_map(fn (TicketStatus $s) => $s->value, $t->status->allowedTransitions()) : [],
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
        $conversation = ChatConversation::query()->with(['user', 'assignee:id,name', 'ticket:id,ticket_no'])->findOrFail($id);
        $nama = $conversation->participantName();
        $user = $conversation->user;

        return [
            'id' => $conversation->id,
            'nama' => $nama,
            'inisial' => mb_strtoupper(mb_substr($nama, 0, 1)),
            // Warga = akun login (identitas terverifikasi NIK); tamu = nama isian sendiri.
            'tipe' => $user ? 'warga' : 'tamu',
            'username' => $user?->username,
            'jumlah_tiket' => $user ? Ticket::query()->where('reporter_id', $user->id)->count() : null,
            // Riwayat tiket warga terdaftar (tamu belum dapat dikenali).
            'riwayat_tiket' => $user ? Ticket::query()->where('reporter_id', $user->id)->latest('id')->limit(3)->get(['ticket_no', 'title', 'status'])
                ->map(fn (Ticket $t) => ['nomor' => $t->ticket_no, 'judul' => $t->title, 'status' => $t->status?->label(), 'url' => '/admin/tiket/'.$t->ticket_no])
                ->all() : [],
            'rujukan' => Referral::query()->with('portal:id,name')->where('conversation_id', $conversation->id)->latest('id')->limit(3)->get()
                ->map(fn (Referral $r) => ['kode' => $r->code, 'portal' => $r->portal?->name, 'status' => $r->label(), 'url' => '/admin/rujukan?milik=semua&tab=semua&rujukan='.$r->code])
                ->all(),
            'mulai' => $conversation->created_at?->toIso8601String(),
            'mode' => $conversation->handled_by,
            'ringkasan' => $conversation->ai_summary,
            'alasan' => self::HANDOFF_REASONS[$conversation->handoff_reason] ?? null,
            'diteruskan_at' => $conversation->handoff_at?->toIso8601String(),
            'referensi' => $conversation->reference,
            'kontak' => $conversation->contact,
            'petugas' => $conversation->assignee?->name,
            'milik_saya' => $conversation->assigned_to === request()->user()->id,
            'hasil' => $conversation->outcome ? ChatConversation::OUTCOMES[$conversation->outcome] ?? $conversation->outcome : null,
            'ditutup_at' => $conversation->closed_at?->toIso8601String(),
            'tiket' => $conversation->ticket ? ['nomor' => $conversation->ticket->ticket_no, 'url' => '/admin/tiket/'.$conversation->ticket->ticket_no] : null,
            'messages' => $conversation->messages()->with('sender')->get()->map(fn (ChatMessage $m) => [
                'id' => $m->id,
                'body' => $m->body,
                'sender_type' => $m->sender_type,
                'penulis' => match ($m->sender_type) {
                    'admin' => $m->sender?->name ?? 'Petugas',
                    'ai' => 'Asisten AI',
                    'system' => 'Sistem',
                    default => $nama,
                },
                'pada' => $m->created_at?->toIso8601String(),
                'dibaca' => $m->read_at !== null,
                'jenis' => $m->kind(),
                'sumber' => $m->meta['sumber'] ?? [],
                'nilai' => $m->feedback,
            ]),
        ];
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
