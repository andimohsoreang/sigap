<?php

namespace App\Services;

use App\Events\ChatMessageSent;
use App\Events\ChatUnreadChanged;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\Ticket;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Logika bisnis live chat (PRD D5 — Reverb). Dipakai bersama oleh jalur Web
 * (Inertia) dan API sehingga pesan tersimpan & tersiar dengan aturan yang sama.
 */
class ChatService
{
    /**
     * Simpan pesan dan siarkan ke channel privat percakapan.
     *
     * Pengirim: `user`/`guest` (penanya), `admin` (petugas), `ai` (asisten),
     * `system` (pemberitahuan otomatis, mis. diteruskan / tiket terbit).
     */
    public function send(
        ChatConversation $conversation,
        string $body,
        string $senderType,
        ?int $senderId = null,
        ?array $meta = null,
    ): ChatMessage {
        $message = ChatMessage::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $senderId,
            'sender_type' => $senderType,
            'body' => $body,
            'meta' => $meta,
        ]);

        // Siapa yang perlu diberi tanda belum-dibaca:
        // - pesan petugas/sistem → penanya;
        // - pesan penanya → petugas, KECUALI percakapan sedang dijawab AI
        //   (petugas baru diberi tahu saat percakapan diteruskan);
        // - jawaban AI langsung tampil di layar penanya → tidak ada.
        $column = match (true) {
            in_array($senderType, ['admin', 'system'], true) => 'unread_user',
            $senderType === 'ai', $conversation->isWithAssistant() => null,
            default => 'unread_admin',
        };

        // D-09: penambahan penghitung belum-dibaca secara atomik di SQL
        // (UPDATE ... SET unread = unread + 1) agar pesan bersamaan tidak hilang.
        $query = ChatConversation::query()->whereKey($conversation->getKey());
        $column !== null
            ? $query->increment($column, 1, ['last_message_at' => now()])
            : $query->update(['last_message_at' => now()]);

        $conversation->refresh();

        // Best-effort: pesan sudah tersimpan meski Reverb sedang mati (PRD D5).
        $this->broadcast(new ChatMessageSent($message));
        if ($column === 'unread_admin') {
            $this->broadcast(new ChatUnreadChanged($conversation->id));
        }

        return $message;
    }

    /** Beri tahu petugas (badge + siaran) bahwa percakapan menunggu ditangani. */
    public function notifyStaff(ChatConversation $conversation): void
    {
        ChatConversation::query()->whereKey($conversation->getKey())->increment('unread_admin', 1, ['last_message_at' => now()]);
        $conversation->refresh();

        $this->broadcast(new ChatUnreadChanged($conversation->id));
    }

    /**
     * Petugas menangani percakapan. Bila masih dijawab AI, AI berhenti dan
     * percakapan tercatat "diambil petugas".
     */
    public function takeOver(ChatConversation $conversation, int $userId): void
    {
        $fromAi = $conversation->isWithAssistant();

        $conversation->forceFill([
            'assigned_to' => $userId,
            'handled_by' => ChatConversation::HANDLED_STAFF,
            'handoff_at' => $fromAi ? ($conversation->handoff_at ?? now()) : $conversation->handoff_at,
            'handoff_reason' => $fromAi ? ($conversation->handoff_reason ?? 'diambil_petugas') : $conversation->handoff_reason,
        ])->save();
    }

    /** Tutup percakapan dengan satu hasil (lihat ChatConversation::OUTCOMES). */
    public function close(ChatConversation $conversation, string $outcome, ?int $userId, ?Ticket $ticket = null): void
    {
        $conversation->forceFill([
            'handled_by' => ChatConversation::HANDLED_STAFF,
            'outcome' => $outcome,
            'closed_at' => now(),
            'closed_by' => $userId,
            'ticket_id' => $ticket?->id ?? $conversation->ticket_id,
            'assigned_to' => $conversation->assigned_to ?? $userId,
        ])->save();
    }

    /**
     * Warga/tamu mengakhiri percakapan sendiri. Riwayat tidak dihapus; pesan
     * baru akan membuka percakapan lagi (Assistant::reopenIfClosed).
     */
    public function endByParticipant(ChatConversation $conversation, ?int $userId): ?ChatMessage
    {
        if ($conversation->isClosed()) {
            return null;
        }

        $outcome = match (true) {
            $conversation->ticket_id !== null => 'tiket',
            $conversation->isWithAssistant() && $conversation->handoff_at === null => 'terjawab_ai',
            default => 'diakhiri_warga',
        };

        $message = $this->send(
            $conversation,
            'Anda mengakhiri percakapan. Riwayatnya tetap tersimpan; tulis pesan baru kapan saja untuk melanjutkan.',
            'system',
            null,
            ['kind' => 'diakhiri'],
        );

        $conversation->forceFill([
            'outcome' => $outcome,
            'closed_at' => now(),
            'closed_by' => $userId,
            'unread_user' => 0,
        ])->save();

        return $message;
    }

    /**
     * Panel "Tiket dari percakapan ini" untuk penanya: referensi, linimasa,
     * petugas, dan kontak tersamar. Hanya data milik percakapan ini.
     *
     * @return array<string, mixed>
     */
    public function participantPanel(ChatConversation $conversation): array
    {
        $conversation->loadMissing(['assignee:id,name,unit,region_id', 'assignee.region:id,name', 'ticket.category:id,name', 'ticket.histories']);
        $ticket = $conversation->ticket;
        $staff = $conversation->assignee;

        return [
            'referensi' => $conversation->reference,
            'dimulai_at' => $conversation->created_at?->toIso8601String(),
            'diteruskan_at' => $conversation->handoff_at?->toIso8601String(),
            'data_diverifikasi_at' => $conversation->data_verified_at?->toIso8601String(),
            'konfirmasi' => $conversation->messages()->getQuery()
                ->where('sender_type', 'admin')
                ->where('meta->kind', 'konfirmasi_data')
                ->reorder('id', 'desc')
                ->first()?->meta['status'] ?? null,
            'ditutup' => $conversation->isClosed(),
            'petugas' => $staff && $conversation->handled_by === ChatConversation::HANDLED_STAFF ? [
                'nama' => $staff->name,
                'unit' => $staff->unit ?: ($staff->region?->name ? 'Kawasan '.$staff->region->name : 'Petugas Contact Center'),
            ] : null,
            'kontak' => self::maskContact($conversation->contact),
            'tiket' => $ticket ? [
                'nomor' => $ticket->ticket_no,
                'status' => $ticket->status?->value,
                'status_label' => $ticket->status?->label(),
                'kategori' => $ticket->category?->name,
                'prioritas' => $ticket->impact?->label(),
                'dibuat_at' => $ticket->created_at?->toIso8601String(),
                'diproses_at' => $ticket->histories->firstWhere('to_status', 'diproses')?->created_at?->toIso8601String(),
                'selesai_at' => $ticket->resolved_at?->toIso8601String(),
                'target_at' => $ticket->sla_due_at?->toIso8601String(),
                'url' => '/lacak/'.$ticket->ticket_no,
            ] : null,
        ];
    }

    /** "0812 •••• 4471" atau "si***@gmail.com". */
    public static function maskContact(?string $contact): ?string
    {
        $contact = trim((string) $contact);
        if ($contact === '') {
            return null;
        }
        if (str_contains($contact, '@')) {
            [$local, $domain] = explode('@', $contact, 2);

            return mb_substr($local, 0, 2).'***@'.$domain;
        }
        $digits = preg_replace('/\D/', '', $contact);

        return strlen($digits) >= 8 ? substr($digits, 0, 4).' •••• '.substr($digits, -4) : '••••';
    }

    /** Transkrip teks polos untuk diunduh penanya (tanpa data internal). */
    public function transcript(ChatConversation $conversation): string
    {
        $lines = [
            'Transkrip percakapan — Contact Center Kementerian Transmigrasi',
            'Dimulai: '.$conversation->created_at?->copy()->setTimezone('Asia/Jakarta')->locale('id')->translatedFormat('j F Y, H.i').' WIB',
        ];
        if ($conversation->reference) {
            $lines[] = 'Nomor referensi: '.$conversation->reference;
        }
        if ($conversation->ticket) {
            $lines[] = 'Tiket: '.$conversation->ticket->ticket_no;
        }
        $lines[] = str_repeat('-', 60);

        foreach ($conversation->messages()->with('sender')->get() as $m) {
            $p = self::present($m);
            $time = $m->created_at?->copy()->setTimezone('Asia/Jakarta')->format('d/m/Y H.i');
            $lines[] = '';
            $lines[] = "[{$time}] {$p['penulis']}";
            $lines[] = $m->body;
        }

        return implode("\n", $lines)."\n";
    }

    /** Petugas membuka percakapan: nolkan penghitung & tandai pesan warga/tamu dibaca. */
    public function markReadByAdmin(ChatConversation $conversation): void
    {
        $changed = ChatConversation::query()
            ->whereKey($conversation->getKey())
            ->where('unread_admin', '>', 0)
            ->update(['unread_admin' => 0]);

        $conversation->messages()->getQuery()
            ->where('sender_type', '!=', 'admin')
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        if ($changed > 0) {
            $this->broadcast(new ChatUnreadChanged($conversation->id));
        }
    }

    /** Warga/tamu membuka widget: tandai balasan petugas sudah dibaca. */
    public function markReadByParticipant(ChatConversation $conversation): void
    {
        if ($conversation->unread_user > 0) {
            ChatConversation::query()->whereKey($conversation->getKey())->update(['unread_user' => 0]);
            $conversation->unread_user = 0;
        }

        $conversation->messages()->getQuery()
            ->where('sender_type', 'admin')
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
    }

    /** Ambil percakapan milik pengguna login (dibuat bila belum ada). */
    public function forUser(int $userId): ChatConversation
    {
        return ChatConversation::query()->firstOrCreate(
            ['user_id' => $userId],
            ['subject' => 'Live Chat', 'last_message_at' => now(), 'handled_by' => self::initialHandler()],
        );
    }

    /** Percakapan tamu berdasarkan token sesi (null bila belum mulai). */
    public function forGuest(?string $guestToken): ?ChatConversation
    {
        if (! $guestToken) {
            return null;
        }

        return ChatConversation::query()->where('guest_token', $guestToken)->whereNull('user_id')->first();
    }

    /** Mulai/ubah identitas percakapan tamu. */
    public function startGuest(string $guestToken, string $name): ChatConversation
    {
        $conversation = ChatConversation::query()->firstOrNew(['guest_token' => $guestToken]);
        $conversation->fill([
            'guest_name' => $name,
            'subject' => 'Live Chat (Tamu)',
        ]);
        $conversation->last_message_at ??= now();
        if (! $conversation->exists) {
            $conversation->handled_by = self::initialHandler();
        }
        $conversation->save();

        return $conversation;
    }

    /**
     * Tamu yang kemudian login: riwayat chat tamu digabung ke percakapan akunnya
     * sehingga tidak hilang dan petugas melihat satu utas atas nama warga.
     */
    public function adoptGuestConversation(?string $guestToken, int $userId): void
    {
        $guest = $this->forGuest($guestToken);
        if (! $guest) {
            return;
        }

        DB::transaction(function () use ($guest, $userId): void {
            $own = ChatConversation::query()->where('user_id', $userId)->lockForUpdate()->first();

            if (! $own) {
                $guest->forceFill(['user_id' => $userId, 'guest_token' => null, 'subject' => 'Live Chat'])->save();

                return;
            }

            $guest->messages()->getQuery()->update(['conversation_id' => $own->id]);
            ChatConversation::query()->whereKey($own->id)->update([
                'unread_admin' => DB::raw('unread_admin + '.(int) $guest->unread_admin),
                'unread_user' => DB::raw('unread_user + '.(int) $guest->unread_user),
                'last_message_at' => max($own->last_message_at, $guest->last_message_at) ?? now(),
            ]);
            $guest->delete();
        });
    }

    /**
     * Pesan untuk widget warga/tamu. `mine` = pesan milik penanya (tampil di kanan).
     *
     * @return array<int, array<string, mixed>>
     */
    public function messages(ChatConversation $conversation): array
    {
        return $conversation->messages()->with('sender')->get()
            ->map(fn (ChatMessage $m) => self::present($m))
            ->all();
    }

    /** Percakapan baru: dijawab asisten AI bila aktif, selain itu langsung petugas. */
    public static function initialHandler(): string
    {
        return config('services.ai.enabled') ? ChatConversation::HANDLED_AI : ChatConversation::HANDLED_STAFF;
    }

    /** Bentuk pesan yang sama untuk respons HTTP & payload broadcast. */
    public static function present(ChatMessage $m): array
    {
        $mine = in_array($m->sender_type, ['user', 'guest'], true);
        $meta = $m->meta ?? [];

        return [
            'id' => $m->id,
            'conversation_id' => $m->conversation_id,
            'body' => $m->body,
            'sender_type' => $m->sender_type,
            'mine' => $mine,
            'penulis' => match ($m->sender_type) {
                'admin' => $m->sender?->name ?? 'Petugas Contact Center',
                'ai' => 'TARA',
                'system' => 'Contact Center',
                default => 'Anda',
            },
            'pada' => $m->created_at?->toIso8601String(),
            // Hanya kunci yang aman untuk penanya (bukan `pertanyaan` internal).
            'jenis' => $meta['kind'] ?? null,
            'sumber' => $meta['sumber'] ?? [],
            'beda_sumber' => (bool) ($meta['beda_sumber'] ?? false),
            'kebijakan' => (bool) ($meta['kebijakan'] ?? false),
            'tiket' => $meta['tiket'] ?? null,
            'portal' => $meta['portal'] ?? null,
            'rujukan' => $meta['rujukan'] ?? null,
            'referensi' => $meta['referensi'] ?? null,
            'aktivasi' => self::activationLink($meta['aktivasi'] ?? null),
            'lampiran' => self::attachment($m, '/chat/lampiran/'),
            'konfirmasi' => self::confirmation($m),
            'nilai' => $m->feedback,
        ];
    }

    /**
     * Lampiran pesan untuk tampilan (tanpa path penyimpanan).
     *
     * @return array{nama: string, mime: string, ukuran: int, gambar: bool, url: string}|null
     */
    public static function attachment(ChatMessage $m, string $urlPrefix): ?array
    {
        $a = $m->meta['lampiran'] ?? null;
        if (! is_array($a) || empty($a['path'])) {
            return null;
        }

        return [
            'nama' => (string) ($a['nama'] ?? 'lampiran'),
            'mime' => (string) ($a['mime'] ?? ''),
            'ukuran' => (int) ($a['ukuran'] ?? 0),
            'gambar' => str_starts_with((string) ($a['mime'] ?? ''), 'image/'),
            'url' => $urlPrefix.$m->id,
        ];
    }

    /**
     * Kartu konfirmasi data dari petugas.
     *
     * @return array{id: int, pengantar: string, data: list<array{label: string, nilai: string}>, status: string, koreksi: string|null}|null
     */
    public static function confirmation(ChatMessage $m): ?array
    {
        if ($m->kind() !== 'konfirmasi_data') {
            return null;
        }

        return [
            'id' => $m->id,
            'pengantar' => (string) ($m->meta['pengantar'] ?? ''),
            'data' => array_values($m->meta['data'] ?? []),
            'status' => (string) ($m->meta['status'] ?? 'menunggu'),
            'koreksi' => $m->meta['koreksi'] ?? null,
        ];
    }

    /**
     * Warga/tamu mengirim foto atau dokumen. Asisten AI tidak membaca isi
     * lampiran, jadi penanya diberi tahu cara meminta petugas memeriksanya.
     *
     * @param  array{path: string, nama: string, mime: string, ukuran: int}  $file
     * @return list<ChatMessage>
     */
    public function sendAttachment(ChatConversation $conversation, array $file, ?string $caption, string $senderType, ?int $senderId): array
    {
        $caption = trim((string) $caption);
        $message = $this->send($conversation, $caption !== '' ? $caption : '📎 '.$file['nama'], $senderType, $senderId, [
            'kind' => 'lampiran',
            'lampiran' => $file,
        ]);

        $out = [$message];
        if ($conversation->isWithAssistant() && in_array($senderType, ['user', 'guest'], true)) {
            $out[] = $this->send(
                $conversation,
                'Lampiran tersimpan. TARA tidak membaca isi foto atau dokumen; tekan "Bicara dengan petugas" agar petugas memeriksanya.',
                'system',
                null,
                ['kind' => 'lampiran_ai'],
            );
        }

        return $out;
    }

    /**
     * Petugas meminta warga mengonfirmasi data laporan. NIK hanya disimpan
     * tersamar di kartu.
     *
     * @param  list<array{label: string, nilai: string}>  $data
     */
    public function requestConfirmation(ChatConversation $conversation, array $data, string $intro, int $staffId): ChatMessage
    {
        $lines = array_map(fn (array $d) => "{$d['label']}: {$d['nilai']}", $data);

        return $this->send($conversation, $intro."\n".implode("\n", $lines), 'admin', $staffId, [
            'kind' => 'konfirmasi_data',
            'pengantar' => $intro,
            'data' => $data,
            'status' => 'menunggu',
        ]);
    }

    /** Warga menjawab kartu konfirmasi: "benar" atau "ubah" (+ koreksi). */
    public function answerConfirmation(ChatConversation $conversation, ChatMessage $card, string $answer, ?string $correction, string $senderType, ?int $senderId): ChatMessage
    {
        $correction = trim((string) $correction);
        $meta = $card->meta ?? [];
        $meta['status'] = $answer === 'benar' ? 'benar' : 'ubah';
        $meta['dijawab_at'] = now()->toIso8601String();
        if ($answer !== 'benar' && $correction !== '') {
            $meta['koreksi'] = $correction;
        }
        $card->forceFill(['meta' => $meta])->save();

        if ($answer === 'benar') {
            $conversation->forceFill(['data_verified_at' => now()])->save();
        }

        $body = $answer === 'benar'
            ? 'Data sudah benar.'
            : ($correction !== '' ? "Data perlu diubah: {$correction}" : 'Data perlu diubah. Saya jelaskan di pesan berikutnya.');

        return $this->send($conversation, $body, $senderType, $senderId, ['kind' => 'jawaban_konfirmasi']);
    }

    /**
     * Tombol "buat kata sandi" untuk akun yang didaftarkan petugas. Token
     * tersimpan terenkripsi di pesan; tautan kedaluwarsa tidak ditampilkan.
     *
     * @param  array{token?: string, berlaku_sampai?: string}|null  $data
     * @return array{url: string, berlaku_sampai: string, jenis: string}|null
     */
    private static function activationLink(?array $data): ?array
    {
        if (! isset($data['token'], $data['berlaku_sampai']) || now()->greaterThanOrEqualTo($data['berlaku_sampai'])) {
            return null;
        }

        try {
            $token = Crypt::decryptString($data['token']);
        } catch (\Throwable) {
            return null;
        }

        return ['url' => '/aktivasi/'.$token, 'berlaku_sampai' => $data['berlaku_sampai'], 'jenis' => $data['jenis'] ?? 'aktivasi'];
    }

    private function broadcast(object $event): void
    {
        try {
            event($event);
        } catch (\Throwable $e) {
            Log::warning('Broadcast chat gagal: '.$e->getMessage());
        }
    }
}
