<?php

namespace App\Http\Controllers\Web;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\ChatConversation;
use App\Models\Portal;
use App\Models\Ticket;
use App\Models\User;
use App\Services\AuditService;
use App\Services\ChatService;
use App\Services\ReferralService;
use App\Services\StaffRegistrationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Aksi petugas di Kotak Masuk contact center: mengambil percakapan dan
 * menutupnya dengan satu hasil. Penerbitan tiket dari percakapan memakai
 * alur Input Manual (lihat AdminController::storeManual).
 *
 * Otorisasi mengikuti live chat (A-05): semua admin dapat menangani semua
 * percakapan karena warga belum memilih kawasan saat membuka chat.
 */
class ContactCenterController extends Controller
{
    /** Hasil yang dapat dipilih petugas saat menutup (tiket punya alurnya sendiri). */
    private const CLOSABLE = ['terjawab_petugas', 'lapor', 'wbs', 'tidak_selesai'];

    /** Percobaan nomor HP yang tidak cocok per akun per jam (pemulihan lewat chat). */
    private const RECOVERY_ATTEMPTS = 5;

    public function __construct(
        private readonly ChatService $chat,
        private readonly AuditService $audit,
        private readonly ReferralService $referrals,
        private readonly StaffRegistrationService $registrations,
    ) {}

    /** POST /admin/chat/{conversation}/ambil — petugas mengambil alih (AI berhenti menjawab). */
    public function take(Request $request, ChatConversation $conversation): RedirectResponse
    {
        $this->authorize('viewAny', Ticket::class);

        $this->chat->takeOver($conversation, $request->user()->id);
        $this->audit->safe('chat.taken', $conversation, "Percakapan #{$conversation->id} diambil {$request->user()->name}.");

        return back()->with('success', 'Percakapan Anda tangani.');
    }

    /** POST /admin/chat/{conversation}/tutup — tutup dengan hasil. */
    public function close(Request $request, ChatConversation $conversation): RedirectResponse
    {
        $this->authorize('viewAny', Ticket::class);

        $data = $request->validate(['hasil' => ['required', Rule::in(self::CLOSABLE)]]);

        if ($conversation->isClosed()) {
            return back()->with('error', 'Percakapan sudah ditutup.');
        }

        $notice = match ($data['hasil']) {
            'lapor' => 'Petugas menyarankan laporan Anda disampaikan melalui SP4N-LAPOR! (www.lapor.go.id) karena juga menyangkut instansi lain. Anda dapat memakai ringkasan percakapan ini saat melapor.',
            'wbs' => 'Untuk dugaan pelanggaran atau pungutan liar, silakan laporkan melalui Whistleblowing System (WBS) Kementerian Transmigrasi. Identitas pelapor dilindungi.',
            'terjawab_petugas' => 'Percakapan ditutup oleh petugas. Tulis pesan baru bila masih ada yang ingin ditanyakan.',
            default => null,
        };
        if ($notice !== null) {
            $this->chat->send($conversation, $notice, 'system', null, ['kind' => 'ditutup', 'hasil' => $data['hasil']]);
        }

        $this->chat->close($conversation, $data['hasil'], $request->user()->id);
        $this->audit->safe('chat.closed', $conversation, "Percakapan #{$conversation->id} ditutup: ".ChatConversation::OUTCOMES[$data['hasil']].'.');

        return back()->with('success', 'Percakapan ditutup: '.ChatConversation::OUTCOMES[$data['hasil']].'.');
    }

    /**
     * POST /admin/chat/{conversation}/rujuk — rujuk warga ke portal lain
     * (mis. aduan lahan → Trans Tuntas). Petugas yang merujuk menjadi
     * penanggung jawab sampai warga berhasil.
     */
    public function refer(Request $request, ChatConversation $conversation): RedirectResponse
    {
        $this->authorize('viewAny', Ticket::class);

        $data = $request->validate([
            'portal' => ['required', Rule::exists('portals', 'code')->where('is_active', true)->where('audience', Portal::AUDIENCE_PUBLIC)],
            'ringkasan' => ['nullable', 'string', 'max:1000'],
        ]);

        if ($conversation->isClosed()) {
            return back()->with('error', 'Percakapan sudah ditutup.');
        }

        $portal = Portal::query()->where('code', $data['portal'])->firstOrFail();
        $user = $request->user();
        $summary = $data['ringkasan'] ?? $conversation->ai_summary;

        $referral = $this->referrals->create($portal, $conversation, $summary, $user);

        $this->chat->send(
            $conversation,
            "Petugas merujuk Anda ke {$portal->name}. Buka pengantar di bawah untuk langkah, hal yang perlu disiapkan, dan ringkasan aduan Anda. "
                .Str::before($user->name, ' ').' mendampingi Anda sampai berhasil.',
            'system',
            null,
            [
                'kind' => 'rujukan',
                'portal' => $portal->card(),
                'rujukan' => ['kode' => $referral->code, 'url' => $referral->publicUrl(), 'pendamping' => Str::before($user->name, ' ')],
            ],
        );
        $this->chat->close($conversation, 'rujuk_portal', $user->id);
        $this->audit->safe('chat.referred', $conversation, "Percakapan #{$conversation->id} dirujuk ke {$portal->name} ({$referral->code}).");

        return back()->with('success', "Warga dirujuk ke {$portal->name}. Pantau di menu Rujukan sampai berhasil.");
    }

    /**
     * POST /admin/chat/{conversation}/akun — daftarkan akun warga untuk
     * penanya (tamu) setelah masalahnya dijawab. Tautan "buat kata sandi"
     * dikirim ke chat yang sama; warga tidak perlu surel atau formulir.
     */
    public function register(Request $request, ChatConversation $conversation): RedirectResponse
    {
        $this->authorize('viewAny', Ticket::class);

        $request->merge([
            'nik' => preg_replace('/\D/', '', (string) $request->input('nik')),
            'nama' => trim((string) $request->input('nama')),
            'telepon' => trim((string) $request->input('telepon')) ?: null,
            'email' => AdminController::normalizeEmail($request->input('email')),
        ]);

        $data = $request->validate([
            'nik' => ['required', 'digits:16', function (string $attribute, mixed $value, \Closure $fail): void {
                if (User::findByNik((string) $value)) {
                    $fail('NIK ini sudah punya akun. Minta warga masuk dengan NIK-nya, atau memakai menu Lupa Kata Sandi.');
                }
            }],
            'nama' => ['required', 'string', 'min:2', 'max:150'],
            'telepon' => ['nullable', 'string', 'max:30', 'regex:/^(\+?62|0)8[\d\s.-]{7,15}$/'],
            'email' => ['nullable', 'email', 'max:150', 'unique:users,email'],
            'konfirmasi' => ['accepted'],
        ], [
            'nik.required' => 'NIK wajib diisi.',
            'nik.digits' => 'NIK harus 16 digit angka.',
            'nama.required' => 'Nama sesuai KTP wajib diisi.',
            'telepon.regex' => 'Nomor HP harus diawali 08 atau 62.',
            'email.email' => 'Format surel tidak valid.',
            'email.unique' => 'Surel ini sudah dipakai akun lain.',
            'konfirmasi.accepted' => 'Centang konfirmasi bahwa identitas sudah dicek dan warga setuju datanya diolah.',
        ]);

        if ($conversation->user_id !== null) {
            return back()->with('error', 'Penanya sudah masuk dengan akun warga.');
        }
        if ($existing = $this->registrations->accountFor($conversation)) {
            return back()->with('error', "Percakapan ini sudah terhubung ke akun {$existing->name}. Gunakan \"Kirim ulang tautan\" bila warga belum membuat kata sandi.");
        }

        $user = $this->registrations->registerFromConversation($conversation, $data, $request->user());

        return back()->with('success', "Akun {$user->name} dibuat. Tautan untuk membuat kata sandi sudah dikirim ke chat warga.");
    }

    /**
     * POST /admin/chat/{conversation}/akun/pulihkan — warga lupa kata sandi.
     * Petugas menanyakan NIK dan nomor HP terdaftar lewat chat; bila cocok,
     * tautan "buat kata sandi baru" dikirim ke chat. Akun tanpa nomor HP
     * memerlukan catatan cara petugas mencocokkan identitas.
     */
    public function recover(Request $request, ChatConversation $conversation): RedirectResponse
    {
        $this->authorize('viewAny', Ticket::class);

        $request->merge([
            'nik' => preg_replace('/\D/', '', (string) $request->input('nik')),
            'telepon' => trim((string) $request->input('telepon')) ?: null,
            'catatan' => trim((string) $request->input('catatan')) ?: null,
        ]);

        $data = $request->validate([
            'nik' => ['required', 'digits:16'],
            'telepon' => ['nullable', 'string', 'max:30'],
            'catatan' => ['nullable', 'string', 'max:300'],
            'konfirmasi' => ['accepted'],
        ], [
            'nik.required' => 'NIK wajib diisi.',
            'nik.digits' => 'NIK harus 16 digit angka.',
            'konfirmasi.accepted' => 'Centang konfirmasi bahwa Anda sudah mencocokkan identitas warga.',
        ]);

        if ($conversation->user_id !== null) {
            return back()->with('error', 'Penanya sedang masuk dengan akunnya, jadi tidak perlu pemulihan.');
        }
        if ($this->registrations->resendable($conversation)) {
            return back()->with('error', 'Tautan untuk percakapan ini masih menunggu dipakai. Gunakan "Kirim ulang tautan" bila perlu.');
        }

        $user = User::findByNik($data['nik']);
        if (! $user || $user->role !== UserRole::Warga) {
            throw ValidationException::withMessages(['nik' => 'NIK ini belum punya akun warga. Gunakan "Daftarkan akun".']);
        }
        if (! $user->is_active) {
            throw ValidationException::withMessages(['nik' => 'Akun ini dinonaktifkan. Hubungi super admin.']);
        }

        // Batasi tebakan nomor HP per akun, siapa pun petugasnya.
        $key = 'pemulihan-chat:'.$user->id;
        if (RateLimiter::tooManyAttempts($key, self::RECOVERY_ATTEMPTS)) {
            $minutes = (int) ceil(RateLimiter::availableIn($key) / 60);
            throw ValidationException::withMessages(['telepon' => "Terlalu banyak percobaan yang tidak cocok untuk akun ini. Coba lagi dalam {$minutes} menit."]);
        }

        $note = null;
        if ($user->phone) {
            if (empty($data['telepon'])) {
                throw ValidationException::withMessages(['telepon' => 'Tanyakan nomor HP yang didaftarkan warga, lalu isi di sini.']);
            }
            if (! self::samePhone($data['telepon'], $user->phone)) {
                RateLimiter::hit($key, 3600);
                $this->audit->safe('account.recovery_failed', $user, "Pemulihan akun {$user->name} lewat chat ditolak: nomor HP tidak cocok.", ['conversation_id' => $conversation->id]);

                throw ValidationException::withMessages(['telepon' => 'Nomor HP tidak cocok dengan yang terdaftar. Tanyakan lagi ke warga, jangan sebutkan nomornya.']);
            }
        } else {
            $note = $data['catatan'] ?? null;
            if ($note === null || mb_strlen($note) < 10) {
                throw ValidationException::withMessages(['catatan' => 'Akun ini tidak punya nomor HP. Tuliskan cara Anda mencocokkan identitas warga (mis. foto KTP, panggilan video, datang ke kantor).']);
            }
        }

        RateLimiter::clear($key);
        $this->registrations->sendRecovery($user, $conversation, $request->user(), $note);

        return back()->with('success', "Tautan untuk membuat kata sandi baru akun {$user->name} sudah dikirim ke chat warga.");
    }

    /** POST /admin/chat/{conversation}/akun/kirim-ulang — tautan baru bila warga belum memakai tautan sebelumnya. */
    public function resendActivation(Request $request, ChatConversation $conversation): RedirectResponse
    {
        $this->authorize('viewAny', Ticket::class);

        $previous = $this->registrations->resendable($conversation);
        if (! $previous) {
            return back()->with('error', 'Tidak ada tautan yang menunggu dipakai di percakapan ini.');
        }

        $this->registrations->resend($previous, $conversation, $request->user());

        return back()->with('success', 'Tautan baru dikirim ke chat warga. Tautan sebelumnya tidak berlaku lagi.');
    }

    /** Bandingkan nomor HP tanpa memedulikan format (08…, 62…, +62…, spasi, titik). */
    private static function samePhone(string $given, string $registered): bool
    {
        $normalize = function (string $phone): string {
            $digits = preg_replace('/\D/', '', $phone);

            return str_starts_with($digits, '62') ? '0'.substr($digits, 2) : $digits;
        };

        $given = $normalize($given);

        return $given !== '' && hash_equals($normalize($registered), $given);
    }
}
