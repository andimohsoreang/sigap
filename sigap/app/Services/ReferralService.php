<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\ChatConversation;
use App\Models\Portal;
use App\Models\Referral;
use App\Models\ReferralEvent;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Siklus hidup rujukan ke portal lain beserta penanggung jawabnya.
 *
 * Aturan akuntabilitas:
 * - setiap rujukan langsung punya penanggung jawab: petugas yang menangani
 *   percakapan, atau (bila dirujuk AI) admin aktif dengan rujukan terbuka
 *   paling sedikit;
 * - batas tindak lanjut = 2 hari kerja; lewat dari itu tanpa bukti, rujukan
 *   masuk "Perlu tindakan" dan penanggung jawab diingatkan setiap hari kerja;
 * - rujukan hanya selesai dengan bukti dari portal tujuan, atau ditutup
 *   petugas dengan alasan tertulis;
 * - setiap langkah tercatat di referral_events.
 */
class ReferralService
{
    public const FOLLOW_UP_WORKDAYS = 2;

    private const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

    public function __construct(
        private readonly ChatService $chat,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * @param  User|null  $by  petugas yang merujuk; null = dirujuk asisten AI
     */
    public function create(Portal $portal, ?ChatConversation $conversation, ?string $summary, ?User $by = null): Referral
    {
        $assignee = $by ?? ($conversation?->assigned_to ? User::find($conversation->assigned_to) : null) ?? $this->leastLoadedAdmin();

        $referral = DB::transaction(function () use ($portal, $conversation, $summary, $by, $assignee) {
            $referral = Referral::create([
                'token' => Str::random(48),
                'code' => $this->newCode(),
                'portal_id' => $portal->id,
                'conversation_id' => $conversation?->id,
                'user_id' => $conversation?->user_id,
                'citizen_name' => $conversation?->participantName(),
                'contact' => $conversation?->contact,
                'summary' => $summary !== null ? Str::limit($summary, 1000) : null,
                'status' => Referral::STATUS_REFERRED,
                'assigned_to' => $assignee?->id,
                'created_by' => $by?->id,
                'follow_up_due_at' => $this->dueFrom(now()),
            ]);

            $this->log($referral, $by ? 'petugas' : 'ai', 'dibuat', "Dirujuk ke {$portal->name}.", $by);
            if ($assignee) {
                $this->log($referral, 'sistem', 'ditugaskan', "Penanggung jawab: {$assignee->name}.");
            }

            return $referral;
        });

        if ($assignee && $assignee->id !== $by?->id) {
            $this->notify($referral, $assignee, 'Rujukan baru', "{$referral->citizenName()} dirujuk ke {$portal->name}. Pastikan warga berhasil.");
        }

        return $referral;
    }

    /** Warga menekan tombol ke portal tujuan di halaman pengantar. */
    public function markOpened(Referral $referral): void
    {
        if ($referral->status !== Referral::STATUS_REFERRED) {
            return;
        }

        $referral->forceFill(['status' => Referral::STATUS_OPENED, 'opened_at' => now()])->save();
        $this->log($referral, 'warga', 'dibuka');
    }

    /** Bukti dari portal tujuan (mis. kode tracking) — oleh warga atau petugas. */
    public function confirm(Referral $referral, string $externalRef, ?User $by = null): void
    {
        if (! $referral->isOpen()) {
            return;
        }

        $externalRef = Str::upper(trim($externalRef));
        $referral->forceFill([
            'status' => Referral::STATUS_DONE,
            'external_ref' => $externalRef,
            'confirmed_at' => now(),
            'closed_at' => now(),
            'closed_by' => $by?->id,
        ])->save();

        $this->log($referral, $by ? 'petugas' : 'warga', 'berhasil', "Bukti {$this->proofLabel($referral)}: {$externalRef}", $by);

        $this->tellCitizen($referral, "Terima kasih. {$this->proofLabel($referral)} Anda di {$referral->portal->name} tercatat: {$externalRef}. Simpan kode ini untuk memantau perkembangannya di {$referral->portal->name}.");

        if ($by === null && $referral->assignee) {
            $this->notify($referral, $referral->assignee, 'Rujukan berhasil', "{$referral->citizenName()} berhasil di {$referral->portal->name} ({$externalRef}).");
        }
    }

    /**
     * Warga mengalami kendala. Percakapannya dialihkan ke petugas penanggung
     * jawab agar bisa langsung dibantu lewat chat.
     */
    public function requestHelp(Referral $referral, string $message, ?string $contact = null): void
    {
        if (! $referral->isOpen()) {
            return;
        }

        $referral->forceFill([
            'status' => Referral::STATUS_HELP,
            'contact' => filled($contact) ? $contact : $referral->contact,
        ])->save();
        $this->log($referral, 'warga', 'butuh_bantuan', Str::limit($message, 1000));

        if ($conversation = $referral->conversation) {
            if ($conversation->isClosed()) {
                $conversation->forceFill(['closed_at' => null, 'outcome' => null])->save();
            }
            $conversation->forceFill([
                'handled_by' => ChatConversation::HANDLED_STAFF,
                'assigned_to' => $referral->assigned_to,
                'handoff_at' => now(),
                'handoff_reason' => 'rujukan',
                'ai_summary' => "Kendala rujukan {$referral->code} ke {$referral->portal->name}: ".Str::limit($message, 300),
            ])->save();
            $this->chat->send($conversation, 'Kendala Anda sudah kami terima. Petugas penanggung jawab akan membantu di percakapan ini.', 'system', null, [
                'kind' => 'diteruskan',
                'referensi' => $referral->code,
            ]);
            $this->chat->notifyStaff($conversation);
        }

        if ($referral->assignee) {
            $this->notify($referral, $referral->assignee, 'Warga butuh bantuan', "{$referral->citizenName()} mengalami kendala di {$referral->portal->name}: ".Str::limit($message, 120));
        }
    }

    /** Catatan tindak lanjut petugas (mis. "sudah dihubungi via WA"). Memperpanjang batas. */
    public function note(Referral $referral, User $by, string $note): void
    {
        $referral->forceFill(['follow_up_due_at' => $this->dueFrom(now())])->save();
        $this->log($referral, 'petugas', 'catatan', Str::limit($note, 1000), $by);
    }

    /** Pesan ke warga lewat percakapan asal (bila ada). */
    public function message(Referral $referral, User $by, string $body): bool
    {
        $conversation = $referral->conversation;
        if ($conversation === null) {
            return false;
        }

        if ($conversation->isClosed()) {
            $conversation->forceFill(['closed_at' => null, 'outcome' => null])->save();
        }
        $this->chat->takeOver($conversation, $by->id);
        $this->chat->send($conversation, $body, 'admin', $by->id);

        $referral->forceFill(['follow_up_due_at' => $this->dueFrom(now())])->save();
        $this->log($referral, 'petugas', 'pesan', Str::limit($body, 1000), $by);

        return true;
    }

    public function reassign(Referral $referral, User $by, User $to): void
    {
        $referral->forceFill(['assigned_to' => $to->id])->save();
        $this->log($referral, 'petugas', 'dialihkan', "Dari {$by->name} ke {$to->name}.", $by);

        if ($to->id !== $by->id) {
            $this->notify($referral, $to, 'Rujukan dialihkan ke Anda', "{$by->name} mengalihkan rujukan {$referral->code} ({$referral->portal->name}).");
        }
    }

    public function fail(Referral $referral, User $by, string $reason): void
    {
        $referral->forceFill([
            'status' => Referral::STATUS_FAILED,
            'closed_at' => now(),
            'closed_by' => $by->id,
            'close_reason' => Str::limit($reason, 1000),
        ])->save();
        $this->log($referral, 'petugas', 'gagal', $reason, $by);
    }

    /**
     * Ingatkan penanggung jawab atas rujukan yang lewat batas (sekali per hari).
     *
     * @return int jumlah rujukan yang diingatkan
     */
    public function remindOverdue(): int
    {
        $overdue = Referral::query()->needsAction()
            ->with(['assignee', 'portal'])
            ->where(fn ($q) => $q->whereNull('reminded_at')->orWhere('reminded_at', '<', now()->startOfDay()))
            ->get();

        foreach ($overdue->groupBy('assigned_to') as $items) {
            $assignee = $items->first()->assignee;
            foreach ($items as $referral) {
                $referral->forceFill(['reminded_at' => now()])->save();
                $this->log($referral, 'sistem', 'pengingat', 'Belum ada bukti dari portal tujuan.');
            }
            if ($assignee) {
                $this->notify($items->first(), $assignee, 'Rujukan perlu tindak lanjut', $items->count().' rujukan Anda belum ada kabar berhasil. Hubungi warga atau catat tindak lanjutnya.', '/admin/rujukan');
            }
        }

        return $overdue->count();
    }

    /** Admin aktif dengan rujukan terbuka paling sedikit (pemerataan beban). */
    public function leastLoadedAdmin(): ?User
    {
        return User::query()
            ->where('is_active', true)
            ->whereIn('role', UserRole::adminValues())
            ->withCount(['assignedReferrals as open_count' => fn ($q) => $q->open()])
            ->orderBy('open_count')
            ->orderBy('id')
            ->first();
    }

    public function proofLabel(Referral $referral): string
    {
        return $referral->portal->proof_label ?: 'Nomor bukti';
    }

    /** Batas tindak lanjut: N hari kerja (Senin–Jumat) dari waktu tertentu. */
    public function dueFrom(Carbon $from): Carbon
    {
        return $from->copy()->addWeekdays(self::FOLLOW_UP_WORKDAYS);
    }

    private function tellCitizen(Referral $referral, string $body): void
    {
        if ($conversation = $referral->conversation) {
            $this->chat->send($conversation, $body, 'system', null, ['kind' => 'info', 'referensi' => $referral->code]);
        }
    }

    private function log(Referral $referral, string $actor, string $type, ?string $note = null, ?User $by = null): void
    {
        ReferralEvent::create([
            'referral_id' => $referral->id,
            'user_id' => $by?->id,
            'actor' => $actor,
            'type' => $type,
            'note' => $note,
        ]);
    }

    private function notify(Referral $referral, User $to, string $title, string $body, ?string $url = null): void
    {
        $this->notifications->notify([
            'event' => 'rujukan',
            'nomor' => $referral->code,
            'subject' => "[SIGAP] {$title} — {$referral->code}",
            'title' => $title,
            'body' => $body,
            'message' => $body,
            'cta_url' => $url ?? '/admin/rujukan?rujukan='.$referral->code,
            'cta_label' => 'Buka rujukan',
            'meta' => [
                'Portal' => $referral->portal?->name ?? '-',
                'Status' => $referral->label(),
            ],
        ], $to);
    }

    private function newCode(): string
    {
        do {
            $suffix = '';
            for ($i = 0; $i < 4; $i++) {
                $suffix .= self::CODE_ALPHABET[random_int(0, strlen(self::CODE_ALPHABET) - 1)];
            }
            $code = 'RJK-'.Carbon::now('Asia/Jakarta')->format('ymd').'-'.$suffix;
        } while (Referral::query()->where('code', $code)->exists());

        return $code;
    }
}
