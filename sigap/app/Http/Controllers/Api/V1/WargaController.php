<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateWargaProfileRequest;
use App\Services\AccountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class WargaController extends Controller
{
    public function __construct(private readonly AccountService $accounts) {}

    /** GET /api/v1/warga/session */
    public function session(): JsonResponse
    {
        $user = Auth::user();

        return response()->json([
            'authenticated' => (bool) $user,
            'nama' => $user?->name,
        ]);
    }

    /** GET /api/v1/warga/profile */
    public function profile(): JsonResponse
    {
        $user = Auth::user();

        return response()->json([
            'nama' => $user->name,
            'nik' => $user->maskedNik(),
            'email' => $user->email,
            'telp' => $user->phone,
        ]);
    }

    /** PATCH /api/v1/warga/profile — aturan sama dengan portal web (A-09/A-10). */
    public function updateProfile(UpdateWargaProfileRequest $request): JsonResponse
    {
        $this->accounts->updateProfile(
            $request->user(),
            $request->validated(),
            $request->hasSession() ? $request->session()->getId() : null,
        );

        return response()->json(['ok' => true]);
    }

    /** GET /api/v1/warga/tickets — hanya milik warga yang login (SEC-07). */
    public function tickets(): JsonResponse
    {
        $user = Auth::user();

        $tickets = $user->tickets()
            ->latest()
            ->get()
            ->map(fn ($t) => [
                'id' => '#'.$t->ticket_no,
                'tanggal' => $t->created_at?->translatedFormat('d M Y'),
                'judul' => $t->title,
                'status' => $t->status?->value,
                // Kode akses pelacakan (dibutuhkan tamu untuk nomor format lama).
                'kode_akses' => $t->lookup_token,
            ]);

        return response()->json($tickets);
    }
}
