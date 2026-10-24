<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\AccountActivation;
use App\Models\ChatConversation;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Akun warga yang didaftarkan petugas dari percakapan live chat.
 *
 * Alurnya: warga bertanya → asisten AI menyaring → diteruskan ke petugas →
 * petugas menjawab masalahnya, lalu membantu administrasi akun lewat chat
 * (NIK, nama, nomor HP). Warga tidak perlu surel maupun formulir daftar:
 * tautan "buat kata sandi" dikirim ke chat yang sama, dan setelah dipakai
 * warga langsung masuk dengan riwayat chat & tiketnya.
 *
 * Lupa kata sandi memakai jalur yang sama: petugas mencocokkan NIK dan
 * nomor HP terdaftar lewat chat, lalu tautan "buat kata sandi baru" dikirim
 * ke chat. Warga tanpa surel tetap bisa memulihkan akunnya.
 */
class StaffRegistrationService
{
    /** Masa berlaku tautan aktivasi (jam). */
    public const VALID_HOURS = 72;

    public function __construct(
        private readonly ChatService $chat,
        private readonly AuditService $audit,
        private readonly AccountService $accounts,
    ) {}

    /**
     * Buat akun warga untuk penanya di percakapan ini dan kirim tautan
     * aktivasi ke chat-nya.
     *
     * @param  array{nik: string, nama: string, telepon?: string|null, email?: string|null}  $data
     */
    public function registerFromConversation(ChatConversation $conversation, array $data, User $staff): User
    {
        $user = DB::transaction(function () use ($conversation, $data, $staff): User {
            $user = User::create([
                'nik' => $data['nik'],
                'name' => $data['nama'],
                'email' => $data['email'] ?? null,
                'phone' => $data['telepon'] ?? null,
                'role' => UserRole::Warga,
                'is_active' => true,
                // Kata sandi acak yang tidak diketahui siapa pun: akun baru
                // bisa dipakai masuk setelah warga membuat sandinya sendiri.
                'password' => Str::random(64),
                'registered_by' => $staff->id,
            ]);

            // Nama resmi menggantikan nama isian tamu di Kotak Masuk.
            $conversation->forceFill(['guest_name' => $user->name])->save();

            // Tiket yang sudah terbit dari percakapan ini ikut tercatat atas nama warga.
            if ($conversation->ticket_id) {
                $this->linkTicket(Ticket::query()->find($conversation->ticket_id), $user);
            }

            return $user;
        });

        $this->audit->safe('account.registered_by_staff', $user, "Akun warga {$user->name} didaftarkan {$staff->name} dari percakapan #{$conversation->id}.", [
            'conversation_id' => $conversation->id,
        ]);

        if (! empty($user->email)) {
            $this->accounts->sendVerification($user);
        }

        $this->sendLink($user, $conversation, $staff, AccountActivation::PURPOSE_ACTIVATION, first: true);

        return $user;
    }

    /**
     * Lupa kata sandi: identitas sudah dicocokkan petugas (NIK + nomor HP
     * terdaftar, atau cara lain yang dicatat). Tautan dikirim ke chat.
     */
    public function sendRecovery(User $user, ChatConversation $conversation, User $staff, ?string $note = null): void
    {
        $this->sendLink($user, $conversation, $staff, AccountActivation::PURPOSE_RECOVERY, first: true);

        $this->audit->safe('account.recovery_sent', $user, "Tautan pemulihan kata sandi akun {$user->name} dikirim {$staff->name} lewat percakapan #{$conversation->id}.", array_filter([
            'conversation_id' => $conversation->id,
            'cara_verifikasi' => $note !== null ? 'catatan petugas' : 'nomor HP cocok',
            'catatan' => $note,
        ]));
    }

    /**
     * Tautan yang masih bisa dikirim ulang dari percakapan ini: aktivasi akun
     * yang belum dipakai, atau pemulihan yang belum dipakai.
     */
    public function resendable(ChatConversation $conversation): ?AccountActivation
    {
        $latest = $this->latestActivation($conversation);

        if (! $latest || ! $latest->user?->is_active) {
            return null;
        }

        return match ($latest->purpose) {
            AccountActivation::PURPOSE_RECOVERY => $latest->used_at === null ? $latest : null,
            default => $latest->user->awaitingActivation() ? $latest : null,
        };
    }

    /** Petugas mengirim ulang tautan (kedaluwarsa / warga belum sempat). Tautan lama dibatalkan. */
    public function resend(AccountActivation $previous, ChatConversation $conversation, User $staff): void
    {
        $user = $previous->user;
        $this->sendLink($user, $conversation, $staff, $previous->purpose, first: false);

        $this->audit->safe('account.activation_resent', $user, "Tautan {$previous->purpose} akun {$user->name} dikirim ulang oleh {$staff->name}.", [
            'conversation_id' => $conversation->id,
            'jenis' => $previous->purpose,
        ]);
    }

    /** Tautan terbaru yang dibuat dari percakapan ini. */
    public function latestActivation(ChatConversation $conversation): ?AccountActivation
    {
        return AccountActivation::query()
            ->with('user')
            ->where('conversation_id', $conversation->id)
            ->latest('id')
            ->first();
    }

    /**
     * Warga membuat kata sandi lewat tautan. Akun aktif, warga langsung
     * masuk, dan percakapan tamu (di perangkat ini maupun asal tautan)
     * digabung ke akunnya.
     */
    public function activate(AccountActivation $activation, string $password, ?string $sessionGuestToken): User
    {
        $user = $activation->user;
        $recovery = $activation->isRecovery();

        DB::transaction(function () use ($activation, $user, $password): void {
            $user->forceFill([
                'password' => $password,
                'activated_at' => $user->activated_at ?? now(),
                'remember_token' => Str::random(60),
            ])->save();

            $activation->forceFill(['used_at' => now()])->save();
            AccountActivation::query()
                ->where('user_id', $user->id)
                ->whereNull('used_at')
                ->update(['used_at' => now()]);
        });

        // Pemulihan: sesi web lain & token API lama dicabut sebelum masuk.
        if ($recovery) {
            $this->accounts->invalidateOtherSessions($user, $password, null);
        }

        Auth::login($user);

        $origin = $activation->conversation;
        if ($origin && $origin->user_id === null && $origin->guest_token) {
            $this->chat->adoptGuestConversation($origin->guest_token, $user->id);
        }
        if ($sessionGuestToken && $sessionGuestToken !== $origin?->guest_token) {
            $this->chat->adoptGuestConversation($sessionGuestToken, $user->id);
        }

        $recovery
            ? $this->audit->safe('account.password_reset', $user, "Kata sandi akun {$user->name} dibuat ulang lewat tautan dari chat petugas.", ['jalur' => 'chat'])
            : $this->audit->safe('account.activated', $user, "Akun warga {$user->name} diaktifkan (kata sandi dibuat).");

        return $user;
    }

    /** Akun yang didaftarkan dari percakapan ini (terbaru), bila ada. */
    public function accountFor(ChatConversation $conversation): ?User
    {
        if ($conversation->user_id) {
            return $conversation->user;
        }

        return $this->latestActivation($conversation)?->user;
    }

    /** Tiket dari percakapan dikaitkan ke akun warga (tanpa menimpa pelapor lain). */
    public function linkTicket(?Ticket $ticket, User $user): void
    {
        if (! $ticket || ($ticket->reporter_id !== null && $ticket->reporter_id !== $user->id)) {
            return;
        }

        $ticket->forceFill([
            'reporter_id' => $user->id,
            'reporter_name' => $ticket->reporter_name ?: $user->name,
            'reporter_nik' => $ticket->reporter_nik ?: $user->nik,
            'reporter_phone' => $ticket->reporter_phone ?: $user->phone,
        ])->save();
    }

    private function sendLink(User $user, ChatConversation $conversation, User $staff, string $purpose, bool $first): void
    {
        $token = Str::random(48);
        $expires = now()->addHours(self::VALID_HOURS);

        DB::transaction(function () use ($user, $conversation, $staff, $purpose, $token, $expires): void {
            // Hanya satu tautan yang berlaku pada satu waktu.
            AccountActivation::query()
                ->where('user_id', $user->id)
                ->whereNull('used_at')
                ->update(['used_at' => now()]);

            AccountActivation::create([
                'user_id' => $user->id,
                'conversation_id' => $conversation->id,
                'created_by' => $staff->id,
                'purpose' => $purpose,
                'token_hash' => AccountActivation::hashToken($token),
                'expires_at' => $expires,
            ]);
        });

        $deadline = $expires->copy()->setTimezone('Asia/Jakarta')->locale('id')->translatedFormat('j F Y, H:i');
        $body = match (true) {
            $purpose === AccountActivation::PURPOSE_RECOVERY && $first => "Identitas Anda sudah dicocokkan petugas. Tekan tombol di bawah untuk membuat kata sandi baru akun SIGAP atas nama {$user->name}. Kata sandi lama tidak berlaku lagi setelah kata sandi baru disimpan.",
            $purpose === AccountActivation::PURPOSE_RECOVERY => "Petugas mengirim ulang tautan untuk membuat kata sandi baru akun SIGAP atas nama {$user->name}. Tautan sebelumnya sudah tidak berlaku.",
            $first => "Petugas sudah membuatkan akun SIGAP atas nama {$user->name}. Tekan tombol di bawah untuk membuat kata sandi Anda. Setelah itu Anda bisa masuk kapan saja dengan NIK dan kata sandi tersebut untuk memantau laporan.",
            default => "Petugas mengirim ulang tautan untuk membuat kata sandi akun SIGAP atas nama {$user->name}. Tautan sebelumnya sudah tidak berlaku.",
        };

        $this->chat->send($conversation, $body."\nTautan berlaku sampai {$deadline} WIB dan hanya bisa dipakai sekali. Jangan bagikan tautan ini kepada siapa pun.", 'system', null, [
            'kind' => 'aktivasi',
            // Token disimpan terenkripsi di pesan; database hanya memegang hash-nya.
            'aktivasi' => [
                'jenis' => $purpose,
                'token' => Crypt::encryptString($token),
                'berlaku_sampai' => $expires->toIso8601String(),
            ],
        ]);
    }
}
