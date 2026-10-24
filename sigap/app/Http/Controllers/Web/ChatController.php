<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\StartChatRequest;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Services\Ai\AssistantService;
use App\Services\Ai\ServiceHours;
use App\Services\ChatService;
use App\Services\ReferralService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Live chat publik & warga (PRD D5 — Reverb).
 *
 * - Warga login memakai akunnya (identitas dari akun, terverifikasi).
 * - Tamu WAJIB mengisi nama lebih dulu (POST /chat/mulai); percakapannya
 *   diikat ke guest_token di sesi. Tanpa identitas, kirim pesan ditolak 422.
 * - Tamu yang lalu login: riwayatnya digabung ke percakapan akunnya.
 * - Bila asisten AI aktif (`services.ai.enabled`), percakapan baru dijawab
 *   AI lebih dulu dan diteruskan ke petugas bila perlu.
 */
class ChatController extends Controller
{
    public const SESSION_KEY = 'chat_guest_token';

    public function __construct(
        private readonly ChatService $chat,
        private readonly AssistantService $assistant,
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

        return response()->json([
            'conversation_id' => $conversation?->id,
            'identitas' => $this->identity($request, $conversation),
            'belum_dibaca' => (int) ($conversation?->unread_user ?? 0),
            'messages' => $conversation ? $this->chat->messages($conversation) : [],
            'asisten' => $this->assistantState($conversation),
        ]);
    }

    /** POST /chat/mulai — tamu mengisi nama sebelum chat. */
    public function start(StartChatRequest $request): JsonResponse
    {
        if ($request->user()) {
            return response()->json(['identitas' => $this->identity($request, null)]);
        }

        $token = $request->session()->get(self::SESSION_KEY);
        if (! $token) {
            $token = (string) Str::uuid();
            $request->session()->put(self::SESSION_KEY, $token);
        }

        $conversation = $this->chat->startGuest($token, $request->validated('nama'));

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

        // Warga membalas kode bukti rujukan (mis. kode tracking Trans Tuntas).
        $captured = $this->referrals->captureFromChat($conversation, $data['body']);
        $replies = $captured !== null ? [$captured] : $this->assistant->respond($conversation, $message, $request->user());

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

    /** @return array<string, mixed> */
    private function assistantState(?ChatConversation $conversation): array
    {
        $withStaff = $conversation !== null && ! $conversation->isWithAssistant();

        return [
            'aktif' => AssistantService::enabled(),
            'mode' => $conversation === null ? ChatService::initialHandler() : $conversation->handled_by,
            'jam_layanan' => $this->hours->label(),
            'petugas_tersedia' => $this->hours->isOpen(),
            'referensi' => $conversation?->reference,
            // Diteruskan di luar jam layanan dan belum meninggalkan kontak.
            'butuh_kontak' => $withStaff && $conversation->handoff_at !== null && $conversation->contact === null && ! $this->hours->isOpen(),
        ];
    }

    private function current(Request $request, bool $createForUser): ?ChatConversation
    {
        $token = $request->session()->get(self::SESSION_KEY);

        if ($user = $request->user()) {
            if ($token) {
                $this->chat->adoptGuestConversation($token, $user->id);
                $request->session()->forget(self::SESSION_KEY);
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
