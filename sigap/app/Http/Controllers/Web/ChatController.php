<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Services\ChatService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Live chat publik & warga (PRD D5 — Reverb). Warga login memakai akunnya;
 * tamu memakai guest_token yang disimpan di sesi sehingga percakapan tetap
 * tersambung antar-request.
 */
class ChatController extends Controller
{
    public function __construct(private readonly ChatService $chat) {}

    /** GET /chat/pesan — daftar pesan percakapan berjalan (fallback polling). */
    public function index(Request $request): JsonResponse
    {
        $conversation = $this->resolve($request, create: false);

        if (! $conversation) {
            return response()->json(['messages' => [], 'conversation_id' => null]);
        }

        return response()->json([
            'conversation_id' => $conversation->id,
            'messages' => $this->chat->messages($conversation),
        ]);
    }

    /** POST /chat/pesan — kirim pesan. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['body' => ['required', 'string', 'max:2000']]);

        $conversation = $this->resolve($request, create: true);

        $message = $this->chat->send(
            $conversation,
            $data['body'],
            $request->user() ? 'user' : 'guest',
            $request->user()?->id,
        );

        return response()->json([
            'ok' => true,
            'conversation_id' => $conversation->id,
            'message' => [
                'id' => $message->id,
                'body' => $message->body,
                'sender_type' => $message->sender_type,
                'penulis' => 'Anda',
                'pada' => $message->created_at?->toIso8601String(),
            ],
        ], 201);
    }

    private function resolve(Request $request, bool $create)
    {
        if ($request->user()) {
            return $this->chat->forParticipant($request->user()->id);
        }

        $token = $request->session()->get('chat_guest_token');

        if (! $token && $create) {
            $token = (string) Str::uuid();
            $request->session()->put('chat_guest_token', $token);
        }

        if (! $token) {
            return null;
        }

        return $this->chat->forParticipant(null, $token);
    }
}
