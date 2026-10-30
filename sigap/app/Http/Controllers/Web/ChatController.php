<?php

namespace App\Http\Controllers\Web;

use App\Events\CitizenMessageReceived;
use App\Http\Controllers\Controller;
use App\Http\Requests\StartChatRequest;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Modules\Assistant\Assistant;
use App\Services\Ai\ServiceHours;
use App\Services\ChatAttachmentService;
use App\Services\ChatService;
use App\Services\ContactCenterStats;
use App\Services\PublicChannels;
use App\Services\ReferralService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Live chat publik & warga (PRD D5 — Reverb).
 *
 * - Warga login memakai akunnya (identitas dari akun, terverifikasi).
 * - Tamu WAJIB mengisi nama lebih dulu (POST /chat/mulai); percakapannya
 *   diikat ke guest_token di sesi. Tanpa identitas, kirim pesan ditolak 422.
 * - Tamu yang lalu login: riwayatnya digabung ke percakapan akunnya.
 * - Token tamu juga disimpan di cookie terenkripsi 30 hari (terpisah dari
 *   sesi 2 jam), jadi tamu yang kembali besoknya tetap melihat balasan
 *   petugas. Di perangkat lain, tamu dapat melanjutkan dengan nomor
 *   referensi + kontak yang ia tinggalkan.
 * - Bila asisten AI aktif (`services.ai.enabled`), percakapan baru dijawab
 *   AI lebih dulu dan diteruskan ke petugas bila perlu.
 */
class ChatController extends Controller
{
    public const SESSION_KEY = 'chat_guest_token';

    /** Cookie token tamu (dienkripsi middleware EncryptCookies, httpOnly). */
    public const COOKIE = 'sigap_chat_tamu';

    private const COOKIE_MINUTES = 60 * 24 * 30;

    /** Percobaan "lanjutkan di perangkat lain" yang gagal per IP per jam. */
    private const RESUME_ATTEMPTS = 6;

    public function __construct(
        private readonly ChatService $chat,
        private readonly Assistant $assistant,
        private readonly ServiceHours $hours,
        private readonly ReferralService $referrals,
    ) {}

    /**
     * GET /chat/pesan — status identitas + pesan (juga dipakai polling).
     * `?baca=1` saat widget terbuka menandai balasan petugas sudah dibaca.
     */
    public function index(Request $request): JsonResponse
    {
        $conversation = $this->current($request, createForUser: false);

        if ($conversation && $request->boolean('baca')) {
            $this->chat->markReadByParticipant($conversation);
        }

        $this->rememberGuest($request, $conversation);

        return response()->json([
            'conversation_id' => $conversation?->id,
            'identitas' => $this->identity($request, $conversation),
            'belum_dibaca' => (int) ($conversation?->unread_user ?? 0),
            'messages' => $conversation ? $this->chat->messages($conversation) : [],
            'asisten' => $this->assistantState($conversation),
            'panel' => $conversation ? $this->chat->participantPanel($conversation) : null,
        ]);
    }

    /** POST /chat/mulai — tamu mengisi nama sebelum chat. */
    public function start(StartChatRequest $request): JsonResponse
    {
        if ($request->user()) {
            return response()->json(['identitas' => $this->identity($request, null)]);
        }

        $token = $this->guestToken($request) ?? (string) Str::uuid();
        $request->session()->put(self::SESSION_KEY, $token);

        $conversation = $this->chat->startGuest($token, $request->validated('nama'));
        $this->rememberGuest($request, $conversation);

        return response()->json([
            'conversation_id' => $conversation->id,
            'identitas' => $this->identity($request, $conversation),
        ], 201);
    }

    /** POST /chat/pesan — kirim pesan. */
    public function store(Request $request): JsonResponse
    {
        $request->merge(['body' => trim((string) $request->input('body'))]);
        $data = $request->validate(['body' => ['required', 'string', 'max:2000']]);

        $conversation = $this->current($request, createForUser: true);

        if (! $conversation || (! $request->user() && ! $conversation->guest_name)) {
            return response()->json([
                'message' => 'Isi nama Anda terlebih dahulu untuk memulai chat.',
                'code' => 'identity_required',
            ], 422);
        }

        $this->assistant->reopenIfClosed($conversation);

        $message = $this->chat->send(
            $conversation,
            $data['body'],
            $request->user() ? 'user' : 'guest',
            $request->user()?->id,
        );

        // Jalur cepat tetap sinkron (tanpa model): kode bukti rujukan, nomor
        // tiket, percakapan yang sedang dipegang petugas. Selebihnya, bila
        // AI_ASYNC aktif, jawaban TARA disiapkan di antrean `ai` dan dikirim
        // lewat Reverb/polling — warga tidak menunggu model (PRD-AI FR-AI-04).
        $captured = $this->referrals->captureFromChat($conversation, $data['body']);
        if ($captured !== null) {
            $replies = [$captured];
        } elseif (config('services.ai.async') && $this->assistant->needsModel($conversation, $message)) {
            $conversation->forceFill(['ai_pending_at' => now()])->save();
            CitizenMessageReceived::dispatch($conversation->id, $message->id);
            $replies = [];
        } else {
            $replies = $this->assistant->respond($conversation, $message, $request->user());
        }

        $this->rememberGuest($request, $conversation);

        return response()->json([
            'ok' => true,
            'conversation_id' => $conversation->id,
            'message' => ChatService::present($message),
            'balasan' => array_map(ChatService::present(...), $replies),
            'asisten' => $this->assistantState($conversation->refresh()),
        ], 201);
    }

    /** POST /chat/petugas — warga meminta berbicara dengan petugas. */
    public function handoff(Request $request): JsonResponse
    {
        $conversation = $this->current($request, createForUser: true);

        if (! $conversation || (! $request->user() && ! $conversation->guest_name)) {
            return response()->json(['message' => 'Isi nama Anda terlebih dahulu untuk memulai chat.', 'code' => 'identity_required'], 422);
        }

        $replies = $this->assistant->handoff($conversation, 'diminta');

        return response()->json([
            'balasan' => array_map(ChatService::present(...), $replies),
            'asisten' => $this->assistantState($conversation->refresh()),
        ]);
    }

    /** POST /chat/kontak — kontak WhatsApp/surel untuk dihubungi petugas di luar jam layanan. */
    public function contact(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kontak' => ['required', 'string', 'max:100', function (string $attribute, mixed $value, \Closure $fail): void {
                $value = trim((string) $value);
                $phone = preg_match('/^(\+?62|0)8[\d\s.-]{7,15}$/', $value) === 1;
                if (! $phone && filter_var($value, FILTER_VALIDATE_EMAIL) === false) {
                    $fail('Masukkan nomor WhatsApp (08…) atau alamat surel yang valid.');
                }
            }],
        ]);

        $conversation = $this->current($request, createForUser: false);
        if (! $conversation || $conversation->handoff_at === null) {
            return response()->json(['message' => 'Tidak ada percakapan yang menunggu petugas.'], 422);
        }

        $conversation->forceFill(['contact' => trim($data['kontak'])])->save();

        $message = $this->chat->send($conversation, 'Terima kasih. Petugas akan menghubungi Anda melalui kontak tersebut pada hari kerja berikutnya.', 'system', null, [
            'kind' => 'kontak_tersimpan',
            'referensi' => $conversation->reference,
        ]);
        $this->chat->notifyStaff($conversation);

        return response()->json([
            'balasan' => [ChatService::present($message)],
            'asisten' => $this->assistantState($conversation->refresh()),
        ]);
    }

    /** POST /chat/pesan/{message}/nilai — warga menilai jawaban asisten. */
    public function feedback(Request $request, ChatMessage $message): JsonResponse
    {
        $data = $request->validate(['membantu' => ['required', 'boolean']]);

        $conversation = $this->current($request, createForUser: false);
        abort_unless(
            $conversation && $message->conversation_id === $conversation->id
                && $message->sender_type === 'ai' && $message->kind() === 'jawaban',
            404,
        );

        $this->assistant->recordFeedback($message, (bool) $data['membantu']);

        return response()->json(['message' => ChatService::present($message->refresh())]);
    }

    /**
     * GET /chat — halaman Chat TARA layar penuh. Percakapan dimuat lewat
     * /chat/pesan (sama dengan widget), jadi riwayatnya satu.
     */
    public function page(): InertiaResponse
    {
        $median = Cache::remember('chat:median-respons', now()->addMinutes(10), fn () => app(ContactCenterStats::class)->overview()['tunggu_median_menit'] ?? null);

        return Inertia::render('public/chat', [
            'layanan' => [
                'ai_aktif' => Assistant::enabled(),
                'jam_label' => $this->hours->label(),
                'petugas_tersedia' => $this->hours->isOpen(),
                'tutup_pukul' => str_replace(':', '.', (string) config('services.ai.service_hours.end')),
                'median_menit' => $median !== null ? (int) round($median) : null,
            ],
            // Tombol kanal lain di chat (SP4N-LAPOR!, Hotline WA, form internal) ikut Pengaturan.
            'kanal' => PublicChannels::get(),
        ]);
    }

    /** POST /chat/lampiran — kirim foto/dokumen (jpg, png, webp, pdf; maks. 5 MB). */
    public function uploadAttachment(Request $request, ChatAttachmentService $files): JsonResponse
    {
        $data = $request->validate([
            'lampiran' => ['required', 'file', 'max:'.ChatAttachmentService::MAX_KB, 'mimes:jpg,jpeg,png,webp,pdf'],
            'body' => ['nullable', 'string', 'max:1000'],
        ], [
            'lampiran.required' => 'Pilih foto atau dokumen terlebih dahulu.',
            'lampiran.max' => 'Ukuran file maksimal 5 MB.',
            'lampiran.mimes' => 'Hanya foto (JPG, PNG, WEBP) atau PDF yang bisa dikirim.',
        ]);

        $conversation = $this->current($request, createForUser: true);
        if (! $conversation || (! $request->user() && ! $conversation->guest_name)) {
            return response()->json(['message' => 'Isi nama Anda terlebih dahulu untuk memulai chat.', 'code' => 'identity_required'], 422);
        }

        try {
            $stored = $files->store($data['lampiran'], $conversation->id);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage(), 'errors' => ['lampiran' => [$e->getMessage()]]], 422);
        }

        $this->assistant->reopenIfClosed($conversation);
        $messages = $this->chat->sendAttachment($conversation, $stored, $data['body'] ?? null, $request->user() ? 'user' : 'guest', $request->user()?->id);
        $this->rememberGuest($request, $conversation);

        return response()->json([
            'message' => ChatService::present($messages[0]),
            'balasan' => array_map(ChatService::present(...), array_slice($messages, 1)),
            'asisten' => $this->assistantState($conversation->refresh()),
        ], 201);
    }

    /** GET /chat/lampiran/{message} — lampiran di percakapan milik penanya sendiri. */
    public function showAttachment(Request $request, ChatMessage $message, ChatAttachmentService $files): BinaryFileResponse
    {
        $conversation = $this->current($request, createForUser: false);
        abort_unless($conversation && $message->conversation_id === $conversation->id, 404);

        return self::serveAttachment($message, $files);
    }

    /** POST /chat/konfirmasi/{message} — jawab kartu konfirmasi data dari petugas. */
    public function answerConfirmation(Request $request, ChatMessage $message): JsonResponse
    {
        $data = $request->validate([
            'jawaban' => ['required', 'in:benar,ubah'],
            'koreksi' => ['nullable', 'string', 'max:500'],
        ]);

        $conversation = $this->current($request, createForUser: false);
        abort_unless($conversation && $message->conversation_id === $conversation->id && $message->kind() === 'konfirmasi_data', 404);

        if (($message->meta['status'] ?? 'menunggu') !== 'menunggu') {
            return response()->json(['message' => 'Kartu ini sudah dijawab.'], 422);
        }

        $this->assistant->reopenIfClosed($conversation);
        $reply = $this->chat->answerConfirmation($conversation, $message, $data['jawaban'], $data['koreksi'] ?? null, $request->user() ? 'user' : 'guest', $request->user()?->id);

        return response()->json([
            'kartu' => ChatService::present($message->refresh()),
            'message' => ChatService::present($reply),
            'panel' => $this->chat->participantPanel($conversation->refresh()),
        ]);
    }

    /** Sajikan lampiran dengan header aman (dipakai juga panel petugas). */
    public static function serveAttachment(ChatMessage $message, ChatAttachmentService $files): BinaryFileResponse
    {
        $a = $message->meta['lampiran'] ?? null;
        $full = is_array($a) && ! empty($a['path']) ? $files->absolutePath($a['path']) : null;
        abort_unless($full !== null, 404);

        $mime = (string) ($a['mime'] ?? 'application/octet-stream');
        $disposition = str_starts_with($mime, 'image/') ? 'inline' : 'attachment';

        return response()->file($full, [
            'Content-Type' => $mime,
            'Content-Disposition' => $disposition.'; filename="'.ChatAttachmentService::safeName((string) ($a['nama'] ?? 'lampiran'), pathinfo($full, PATHINFO_EXTENSION)).'"',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    /** POST /chat/akhiri — penanya mengakhiri percakapan (riwayat tetap tersimpan). */
    public function end(Request $request): JsonResponse
    {
        $conversation = $this->current($request, createForUser: false);
        if (! $conversation) {
            return response()->json(['message' => 'Belum ada percakapan.'], 422);
        }

        $message = $this->chat->endByParticipant($conversation, $request->user()?->id);

        return response()->json([
            'balasan' => $message ? [ChatService::present($message)] : [],
            'asisten' => $this->assistantState($conversation->refresh()),
            'panel' => $this->chat->participantPanel($conversation),
        ]);
    }

    /** GET /chat/transkrip — unduh transkrip percakapan sendiri (teks). */
    public function transcript(Request $request): Response
    {
        $conversation = $this->current($request, createForUser: false);
        abort_unless($conversation !== null, 404);

        $name = 'transkrip-sigap-'.($conversation->reference ?? $conversation->id).'.txt';

        return response($this->chat->transcript($conversation), 200, [
            'Content-Type' => 'text/plain; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$name.'"',
            'Cache-Control' => 'no-store',
        ]);
    }

    /**
     * POST /chat/lanjutkan — tamu melanjutkan percakapan di perangkat lain
     * dengan nomor referensi + nomor WhatsApp/surel yang ia tinggalkan.
     */
    public function resume(Request $request): JsonResponse
    {
        if ($request->user()) {
            return response()->json(['message' => 'Anda sudah masuk; riwayat chat mengikuti akun Anda.'], 422);
        }

        $data = $request->validate([
            'referensi' => ['required', 'string', 'max:40'],
            'kontak' => ['required', 'string', 'max:100'],
        ], [
            'referensi.required' => 'Isi nomor referensi (REF-…) yang tertera di chat sebelumnya.',
            'kontak.required' => 'Isi nomor WhatsApp atau surel yang Anda tinggalkan di chat.',
        ]);

        $key = 'lanjut-chat:'.$request->ip();
        if (RateLimiter::tooManyAttempts($key, self::RESUME_ATTEMPTS)) {
            return response()->json(['message' => 'Terlalu banyak percobaan. Coba lagi dalam '.(int) ceil(RateLimiter::availableIn($key) / 60).' menit.'], 429);
        }

        $reference = strtoupper(trim($data['referensi']));
        $conversation = ChatConversation::query()
            ->where('reference', $reference)
            ->whereNull('user_id')
            ->whereNotNull('guest_token')
            ->first();

        if (! $conversation || ! self::sameContact($data['kontak'], (string) $conversation->contact)) {
            RateLimiter::hit($key, 3600);

            return response()->json([
                'message' => 'Nomor referensi dan kontak tidak cocok. Periksa lagi, atau mulai chat baru dan sebutkan nomor referensi lama Anda.',
            ], 422);
        }

        RateLimiter::clear($key);
        $request->session()->put(self::SESSION_KEY, $conversation->guest_token);
        $request->session()->regenerate();
        $this->rememberGuest($request, $conversation);

        return response()->json(['ok' => true, 'conversation_id' => $conversation->id]);
    }

    /** Token tamu dari sesi, atau dari cookie 30 hari bila sesi sudah habis. */
    private function guestToken(Request $request): ?string
    {
        $token = $request->session()->get(self::SESSION_KEY);
        if ($token) {
            return $token;
        }

        $cookie = $request->cookie(self::COOKIE);
        if (is_string($cookie) && Str::isUuid($cookie)) {
            $request->session()->put(self::SESSION_KEY, $cookie);

            return $cookie;
        }

        return null;
    }

    /** Perpanjang cookie tamu 30 hari setiap kali percakapannya dipakai. */
    private function rememberGuest(Request $request, ?ChatConversation $conversation): void
    {
        if ($request->user() || ! $conversation?->guest_token) {
            return;
        }

        Cookie::queue(cookie(self::COOKIE, $conversation->guest_token, self::COOKIE_MINUTES, httpOnly: true, sameSite: 'lax'));
    }

    /** Bandingkan kontak tanpa memedulikan format (08…/62…/+62, huruf besar surel). */
    private static function sameContact(string $given, string $stored): bool
    {
        $norm = function (string $v): string {
            $v = trim(mb_strtolower($v));
            if (str_contains($v, '@')) {
                return $v;
            }
            $d = preg_replace('/\D/', '', $v);

            return str_starts_with($d, '62') ? '0'.substr($d, 2) : $d;
        };

        $a = $norm($given);

        return $a !== '' && $stored !== '' && hash_equals($norm($stored), $a);
    }

    /** @return array<string, mixed> */
    private function assistantState(?ChatConversation $conversation): array
    {
        $withStaff = $conversation !== null && ! $conversation->isWithAssistant();

        return [
            'aktif' => Assistant::enabled(),
            'mode' => $conversation === null ? ChatService::initialHandler() : $conversation->handled_by,
            'jam_layanan' => $this->hours->label(),
            'petugas_tersedia' => $this->hours->isOpen(),
            'referensi' => $conversation?->reference,
            // TARA sedang menyiapkan jawaban di antrean `ai`.
            'mengetik' => $conversation?->ai_pending_at !== null,
            // Diteruskan di luar jam layanan dan belum meninggalkan kontak.
            'butuh_kontak' => $withStaff && $conversation->handoff_at !== null && $conversation->contact === null && ! $this->hours->isOpen(),
        ];
    }

    private function current(Request $request, bool $createForUser): ?ChatConversation
    {
        $token = $this->guestToken($request);

        if ($user = $request->user()) {
            if ($token) {
                $this->chat->adoptGuestConversation($token, $user->id);
                $request->session()->forget(self::SESSION_KEY);
                Cookie::queue(Cookie::forget(self::COOKIE));
            }

            return $createForUser
                ? $this->chat->forUser($user->id)
                : ChatConversation::query()->where('user_id', $user->id)->first();
        }

        return $this->chat->forGuest($token);
    }

    /** @return array{nama: string, tipe: string}|null */
    private function identity(Request $request, ?ChatConversation $conversation): ?array
    {
        if ($user = $request->user()) {
            return ['nama' => $user->name, 'tipe' => 'warga'];
        }

        return $conversation?->guest_name
            ? ['nama' => $conversation->guest_name, 'tipe' => 'tamu']
            : null;
    }
}
