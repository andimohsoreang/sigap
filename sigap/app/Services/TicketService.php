<?php

namespace App\Services;

use App\Enums\TicketImpact;
use App\Enums\TicketStatus;
use App\Enums\TicketVisibility;
use App\Events\TicketChanged;
use App\Models\Category;
use App\Models\Ticket;
use App\Models\TicketHistory;
use App\Models\TicketReply;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Logika bisnis tiket. Dipakai BERSAMA oleh controller Web (Inertia) dan
 * controller Api/V1 (PRD §4.3) — tidak ada logika bisnis di controller.
 */
class TicketService
{
    /** Batas percobaan ulang bila nomor tiket acak bertabrakan. */
    private const NUMBER_ATTEMPTS = 5;

    public function __construct(
        private readonly SlaCalculator $sla,
        private readonly NotificationService $notifications,
        private readonly AttachmentService $attachments,
        private readonly ReporterNotifier $reporters,
    ) {}

    /**
     * Buat tiket baru. Menghitung prioritas & SLA dari dampak (dan kategori),
     * mencatat riwayat awal, dan mengembalikan model.
     *
     * Lampiran dapat dikirim sebagai `attachment` (UploadedFile): file
     * disimpan lalu DIHAPUS kembali bila penyimpanan tiket gagal (A-16).
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Ticket
    {
        $attachmentPath = $data['attachment_path'] ?? null;
        $storedHere = false;

        if (($data['attachment'] ?? null) instanceof UploadedFile) {
            $attachmentPath = $this->attachments->store($data['attachment']);
            $storedHere = true;
        }

        try {
            $ticket = $this->withUniqueNumber(
                fn (string $number) => DB::transaction(fn () => $this->insert($data, $number, $attachmentPath))
            );
        } catch (\Throwable $e) {
            if ($storedHere) {
                $this->attachments->delete($attachmentPath);
            }

            throw $e;
        }

        // Real-time bersifat best-effort: kegagalan Reverb tidak boleh
        // membatalkan tiket yang sudah tersimpan (PRD D5).
        $this->broadcastTicket($ticket, 'created');
        $this->reporters->ticketCreated($ticket);

        return $ticket;
    }

    /**
     * Ubah status tiket dan catat riwayat. Idempoten jika status sama.
     *
     * A-20: hanya transisi yang diizinkan {@see TicketStatus::allowedTransitions()};
     * baris tiket dikunci (SELECT ... FOR UPDATE) selama transaksi sehingga
     * dua admin yang mengubah bersamaan tidak saling menimpa. `resolved_at`
     * dikosongkan saat tiket keluar dari status Selesai.
     *
     * @throws ValidationException bila transisi tidak diizinkan
     */
    public function changeStatus(Ticket $ticket, TicketStatus $status, ?User $actor = null, ?string $note = null): Ticket
    {
        $changed = DB::transaction(function () use ($ticket, $status, $actor, $note) {
            /** @var Ticket $locked */
            $locked = Ticket::query()->whereKey($ticket->getKey())->lockForUpdate()->firstOrFail();
            $from = $locked->status;

            if ($from === $status) {
                $ticket->setRawAttributes($locked->getAttributes(), true);

                return false;
            }

            if ($from instanceof TicketStatus && ! $from->canTransitionTo($status)) {
                throw ValidationException::withMessages([
                    'status' => "Perubahan status dari \"{$from->label()}\" ke \"{$status->label()}\" tidak diizinkan.",
                ]);
            }

            $now = Carbon::now();
            $locked->status = $status;

            if ($status !== TicketStatus::Baru && $locked->responded_at === null) {
                $locked->responded_at = $now;
            }

            if ($status === TicketStatus::Selesai) {
                $locked->resolved_at = $now;
            } elseif ($from === TicketStatus::Selesai) {
                $locked->resolved_at = null;
            }

            // Tiket dibuka kembali: pelanggaran SLA berikutnya diberi EWS lagi.
            if ($from instanceof TicketStatus && ! $from->isOpen() && $status->isOpen()) {
                $locked->ews_notified_at = null;
            }

            if ($actor !== null && $locked->assignee_id === null) {
                $locked->assignee_id = $actor->id;
            }

            $locked->save();

            TicketHistory::create([
                'ticket_id' => $locked->id,
                'from_status' => $from instanceof TicketStatus ? $from->value : $from,
                'to_status' => $status->value,
                'actor_id' => $actor?->id,
                'note' => $note,
            ]);

            $ticket->setRawAttributes($locked->getAttributes(), true);

            return true;
        });

        if ($changed) {
            $this->broadcastTicket($ticket, 'status', $note);
            // Catatan status bersifat internal: pelapor hanya menerima status barunya.
            $this->reporters->statusChanged($ticket);
        }

        return $ticket;
    }

    /**
     * Cari tiket untuk pelacakan publik (A-02/A-03).
     *
     * Nomor dinormalisasi (trim + huruf besar). Tiket internal tidak pernah
     * dikembalikan; tiket `rahasia` hanya untuk pelapor yang login atau admin
     * yang berwenang (Policy `view`). Nomor format lama `TKT-<n>` untuk tamu
     * wajib disertai `$accessCode` (kode akses tiket).
     */
    public function findForPublicLookup(?string $ticketNo, ?User $viewer, array $with = [], ?string $accessCode = null): ?Ticket
    {
        $ticketNo = Ticket::normalizeNo($ticketNo);

        if (! Ticket::isValidNo($ticketNo)) {
            return null;
        }

        $ticket = Ticket::query()
            ->public()
            ->with($with)
            ->where('ticket_no', $ticketNo)
            ->first();

        if ($ticket === null) {
            return null;
        }

        $canView = $viewer !== null && $viewer->can('view', $ticket);

        if ($ticket->visibility === TicketVisibility::Rahasia && ! $canView) {
            return null;
        }

        // Nomor format lama mudah ditebak: tamu/pihak lain wajib menyertakan
        // kode akses. Hasil sama dengan "tidak ditemukan" agar tidak bocor.
        if (Ticket::isLegacyNo($ticketNo) && ! $canView && ! $ticket->matchesLookupToken($accessCode)) {
            return null;
        }

        return $ticket;
    }

    /** Tambah tanggapan admin/petugas. Tanggapan publik dikirim ke surel pelapor. */
    public function reply(Ticket $ticket, string $body, ?User $author = null, bool $isPublic = true): TicketReply
    {
        $reply = DB::transaction(function () use ($ticket, $body, $author, $isPublic) {
            $reply = TicketReply::create([
                'ticket_id' => $ticket->id,
                'author_id' => $author?->id,
                'body' => $body,
                'is_public' => $isPublic,
            ]);

            $ticket->touch();

            return $reply;
        });

        $this->reporters->replied($ticket, $reply);

        return $reply;
    }

    /**
     * Hapus tiket oleh pelapor (A-03): soft delete sehingga nomor tiket
     * tidak pernah dipakai ulang; file lampiran dihapus dari disk.
     */
    public function deleteByReporter(Ticket $ticket, User $actor): void
    {
        $path = $ticket->attachment_path;

        DB::transaction(function () use ($ticket, $actor) {
            TicketHistory::create([
                'ticket_id' => $ticket->id,
                'from_status' => $ticket->status?->value,
                'to_status' => $ticket->status?->value ?? TicketStatus::Baru->value,
                'actor_id' => $actor->id,
                'note' => 'Tiket dihapus oleh pelapor.',
            ]);

            $ticket->attachment_path = null;
            $ticket->save();
            $ticket->delete();
        });

        $this->attachments->delete($path);
    }

    /**
     * Siarkan perubahan tiket & kirim notifikasi (best-effort) ke admin yang
     * berwenang atas tiket (A-06).
     *
     * Reverb (in-app, PRD D5) dan email (D10) tidak boleh membatalkan transaksi
     * yang sudah tersimpan, jadi kegagalan keduanya hanya dicatat.
     */
    private function broadcastTicket(Ticket $ticket, string $event, ?string $message = null): void
    {
        try {
            $recipients = $this->notifications->recipientsFor($ticket);
        } catch (\Throwable $e) {
            Log::warning('Penerima notifikasi tiket gagal ditentukan: '.$e->getMessage());

            return;
        }

        try {
            TicketChanged::dispatch($ticket, $event, $recipients->pluck('id')->all());
        } catch (\Throwable $e) {
            Log::warning('Broadcast tiket gagal: '.$e->getMessage());
        }

        try {
            $this->notifications->notify(
                $this->notifications->ticketPayload($ticket, $event, (string) $message),
                $recipients,
            );
        } catch (\Throwable $e) {
            Log::warning('Notifikasi tiket gagal: '.$e->getMessage());
        }
    }

    /** @param array<string, mixed> $data */
    private function insert(array $data, string $number, ?string $attachmentPath): Ticket
    {
        $impact = $data['impact'] instanceof TicketImpact
            ? $data['impact']
            : TicketImpact::from((string) $data['impact']);

        $now = Carbon::now();
        $isInternal = (bool) ($data['is_internal'] ?? false);
        $categoryId = $data['category_id'] ?? null;
        $categoryDays = $categoryId !== null
            ? Category::query()->whereKey($categoryId)->value('sla_days')
            : null;

        $ticket = new Ticket;

        $ticket->fill([
            'ticket_no' => $number,
            'title' => $data['title'],
            'description' => $data['description'],
            'status' => TicketStatus::Baru,
            'priority' => $this->sla->priorityFor($impact),
            'impact' => $impact,
            'visibility' => $data['visibility'] ?? 'publik',
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'attachment_path' => $attachmentPath,
            'is_internal' => $isInternal,
            'category_id' => $categoryId,
            'region_id' => $isInternal ? null : ($data['region_id'] ?? null),
            'channel_id' => $data['channel_id'] ?? null,
            'assignee_id' => $data['assignee_id'] ?? null,
            'reporter_id' => $data['reporter_id'] ?? null,
            'reporter_name' => $data['reporter_name'] ?? null,
            'reporter_nik' => $data['reporter_nik'] ?? null,
            'reporter_email' => $data['reporter_email'] ?? null,
            'reporter_phone' => $data['reporter_phone'] ?? null,
            'reporter_nip' => $data['reporter_nip'] ?? null,
            'reporter_unit' => $data['reporter_unit'] ?? null,
            'location' => $data['location'] ?? null,
            'source' => $data['source'] ?? null,
            'source_url' => $data['source_url'] ?? null,
            'received_by' => $data['received_by'] ?? null,
            // D-06: SLA berlaku untuk tiket publik MAUPUN internal; tenggat
            // memakai nilai yang lebih ketat antara dampak & kategori.
            'sla_due_at' => $this->sla->dueAt($impact, $now, $categoryDays !== null ? (int) $categoryDays : null),
        ]);

        $ticket->created_at = $now;
        $ticket->updated_at = $now;
        $ticket->save();

        TicketHistory::create([
            'ticket_id' => $ticket->id,
            'from_status' => null,
            'to_status' => TicketStatus::Baru->value,
            'actor_id' => $data['actor_id'] ?? null,
            'note' => $isInternal ? 'Laporan internal dibuat.' : 'Tiket dibuat oleh pelapor.',
        ]);

        return $ticket;
    }

    /**
     * Jalankan $callback dengan nomor tiket baru; ulangi dengan nomor lain
     * bila terjadi tabrakan constraint unik.
     *
     * @template T
     *
     * @param  callable(string): T  $callback
     * @return T
     */
    private function withUniqueNumber(callable $callback): mixed
    {
        for ($attempt = 1; ; $attempt++) {
            $number = $this->nextTicketNo();

            if ($attempt < self::NUMBER_ATTEMPTS
                && Ticket::withTrashed()->where('ticket_no', $number)->exists()) {
                continue;
            }

            try {
                return $callback($number);
            } catch (UniqueConstraintViolationException $e) {
                if ($attempt >= self::NUMBER_ATTEMPTS) {
                    throw $e;
                }
            }
        }
    }

    /**
     * Nomor tiket A-03: `TKT-YYMMDD-XXXXXX` — tanggal pembuatan (WIB) + 6
     * karakter acak kriptografis dari alfabet tanpa karakter ambigu. Tidak
     * berurutan sehingga tidak dapat ditebak/di-enumerasi, dan tidak lagi
     * memakai MAX(id)+1 (rawan balapan & gagal di PostgreSQL).
     */
    public function nextTicketNo(): string
    {
        $alphabet = Ticket::NUMBER_ALPHABET;
        $max = strlen($alphabet) - 1;
        $suffix = '';

        for ($i = 0; $i < 6; $i++) {
            $suffix .= $alphabet[random_int(0, $max)];
        }

        return 'TKT-'.Carbon::now('Asia/Jakarta')->format('ymd').'-'.$suffix;
    }
}
