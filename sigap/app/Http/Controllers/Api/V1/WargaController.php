<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateWargaProfileRequest;
use App\Http\Resources\V1\TicketResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class WargaController extends Controller
{
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
            'nik' => $user->nik ? substr($user->nik, 0, 4).str_repeat('*', 8).substr($user->nik, -4) : null,
            'email' => $user->email,
            'telp' => $user->phone,
        ]);
    }

    /** PATCH /api/v1/warga/profile */
    public function updateProfile(UpdateWargaProfileRequest $request): JsonResponse
    {
        $user = Auth::user();

        if ($request->filled('email')) {
            $user->email = $request->validated('email');
        }
        if ($request->filled('telp')) {
            $user->phone = $request->validated('telp');
        }
        if ($request->filled('password')) {
            $user->password = $request->validated('password');
        }
        $user->save();

        return response()->json(['ok' => true]);
    }

    /** GET /api/v1/warga/tickets — hanya milik warga yang login (SEC-07). */
    public function tickets(): JsonResponse
    {
        $user = Auth::user();

        $tickets = $user->tickets()
            ->with(['category', 'region', 'channel', 'assignee', 'histories', 'replies.author'])
            ->latest()
            ->get()
            ->map(fn ($t) => [
                'id' => '#'.$t->ticket_no,
                'tanggal' => $t->created_at?->translatedFormat('d M Y'),
                'judul' => $t->title,
                'status' => $t->status?->value,
            ]);

        return response()->json($tickets);
    }
}