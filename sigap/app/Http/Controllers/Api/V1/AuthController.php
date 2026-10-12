<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    public function __construct(private readonly AuthService $auth) {}

    /** POST /api/v1/auth/login — login gabungan warga & petugas (D3). */
    public function login(LoginRequest $request): JsonResponse
    {
        try {
            $user = $this->auth->attempt(
                $request->validated('identifier'),
                $request->validated('password'),
                $request->boolean('remember'),
            );
        } catch (ValidationException) {
            return response()->json(
                ['error' => 'NIK/username atau kata sandi salah.'],
                401,
            );
        }

        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        return response()->json([
            'role' => $user->isAdmin() ? 'admin' : 'warga',
            'nama' => $user->name,
            'id' => $user->id,
        ]);
    }

    /** POST /api/v1/auth/logout */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        // Klien Bearer token: cabut token yang sedang dipakai.
        $token = $user?->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        $this->auth->logout($user);

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['ok' => true]);
    }

    /** GET /api/v1/auth/session */
    public function session(Request $request): JsonResponse
    {
        $user = $this->resolveUser($request);

        if (! $user) {
            return response()->json(['authenticated' => false, 'role' => null, 'nama' => null]);
        }

        return response()->json([
            'authenticated' => true,
            'role' => $user->isAdmin() ? 'admin' : 'warga',
            'nama' => $user->name,
        ]);
    }

    /**
     * Resolusi user untuk endpoint sesi yang tidak memakai middleware auth:
     * cek Bearer token (guard sanctum) lalu sesi cookie (guard web).
     */
    private function resolveUser(Request $request): ?User
    {
        return $request->user('sanctum') ?? $request->user('web');
    }
}
