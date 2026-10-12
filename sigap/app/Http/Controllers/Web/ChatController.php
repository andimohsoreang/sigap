<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\StartChatRequest;
use App\Models\ChatConversation;
use App\Services\ChatService;
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
 */
class ChatController extends Controller
{
    private const SESSION_KEY = 'chat_guest_token';

    public function __construct(private readonly ChatService $chat) {}

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

        $message = $this->chat->send(
            $conversation,
            $data['body'],
            $request->user() ? 'user' : 'guest',
            $request->user()?->id,
        );

        return response()->json([
            'ok' => true,
            'conversation_id' => $conversation->id,
            'message' => ChatService::present($message),
        ], 201);
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
