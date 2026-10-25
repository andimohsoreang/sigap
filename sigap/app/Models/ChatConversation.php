<?php

namespace App\Models;

use App\Services\ChatAttachmentService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Percakapan live chat.
 *
 * Retensi (D-01): percakapan TAMU (tanpa akun) yang tidak aktif lebih dari
 * 180 hari dihapus oleh `model:prune` (pesan ikut terhapus via cascade).
 */
class ChatConversation extends Model
{
    use Prunable;

    /** Ditangani asisten AI (contact center). */
    public const HANDLED_AI = 'ai';

    /** Ditangani petugas (live chat lama, atau setelah diteruskan AI). */
    public const HANDLED_STAFF = 'petugas';

    /** Hasil akhir percakapan → label untuk panel petugas & dashboard. */
    public const OUTCOMES = [
        'terjawab_ai' => 'Terjawab AI',
        'terjawab_petugas' => 'Terjawab petugas',
        'tiket' => 'Jadi tiket',
        'lapor' => 'Diarahkan ke SP4N-LAPOR!',
        'wbs' => 'Diarahkan ke WBS',
        'rujuk_portal' => 'Dirujuk ke portal',
        'tidak_selesai' => 'Tidak selesai',
        'diakhiri_warga' => 'Diakhiri warga',
    ];

    protected $fillable = [
        'user_id',
        'guest_token',
        'guest_name',
        'subject',
        'last_message_at',
        'unread_admin',
        'unread_user',
        'handled_by',
        'handoff_at',
        'handoff_reason',
        'data_verified_at',
        'ai_summary',
        'reference',
        'contact',
        'assigned_to',
        'outcome',
        'closed_at',
        'closed_by',
        'ticket_id',
    ];

    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
            'unread_admin' => 'integer',
            'unread_user' => 'integer',
            'handoff_at' => 'datetime',
            'data_verified_at' => 'datetime',
            'closed_at' => 'datetime',
            // Kontak warga (WhatsApp/surel) = data pribadi: disimpan terenkripsi.
            'contact' => 'encrypted',
        ];
    }

    public function isWithAssistant(): bool
    {
        return $this->handled_by === self::HANDLED_AI;
    }

    public function isClosed(): bool
    {
        return $this->closed_at !== null;
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(ChatMessage::class, 'conversation_id')->orderBy('created_at');
    }

    /** Nama penanya untuk ditampilkan ke petugas. */
    public function participantName(): string
    {
        return $this->user?->name ?? $this->guest_name ?? 'Tamu';
    }

    /**
     * Percakapan terbuka yang menunggu petugas, paling lama menunggu dulu.
     *
     * @return list<array{id: int, nama: string, cuplikan: string|null, sejak: string|null}>
     */
    public static function waitingForStaff(int $limit = 5): array
    {
        return static::query()
            ->with('user:id,name')
            ->whereNull('closed_at')
            ->where('handled_by', self::HANDLED_STAFF)
            ->where(fn ($q) => $q->whereNotNull('handoff_at')->orWhere('unread_admin', '>', 0))
            ->orderByRaw('COALESCE(handoff_at, last_message_at) asc')
            ->limit($limit)
            ->get()
            ->map(fn (self $c) => [
                'id' => $c->id,
                'nama' => $c->participantName(),
                'cuplikan' => $c->ai_summary,
                'sejak' => ($c->handoff_at ?? $c->last_message_at)?->toIso8601String(),
            ])
            ->all();
    }

    /** Jumlah pesan belum dibaca petugas di seluruh percakapan (badge sidebar). */
    public static function unreadForAdmins(): int
    {
        return (int) static::query()->sum('unread_admin');
    }

    /** Lampiran percakapan ikut dihapus saat retensi (D-01). */
    protected function pruning(): void
    {
        app(ChatAttachmentService::class)->deleteConversation($this->id);
    }

    public function prunable(): Builder
    {
        $cutoff = now()->subDays(180);

        return static::query()
            ->whereNull('user_id')
            ->where(fn ($q) => $q
                ->where('last_message_at', '<', $cutoff)
                ->orWhere(fn ($q) => $q->whereNull('last_message_at')->where('created_at', '<', $cutoff)));
    }
}
