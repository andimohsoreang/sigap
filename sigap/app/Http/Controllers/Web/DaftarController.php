<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterWargaRequest;
use App\Services\AccountService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Pendaftaran mandiri akun warga. Setelah daftar warga langsung masuk dan
 * diarahkan ke halaman verifikasi surel; Portal Warga terbuka setelah
 * tautan di surel diklik.
 */
class DaftarController extends Controller
{
    public function __construct(private readonly AccountService $accounts) {}

    public function create(): Response
    {
        return Inertia::render('public/daftar');
    }

    public function store(RegisterWargaRequest $request): RedirectResponse
    {
        $this->accounts->registerWarga($request->validated());
        $request->session()->regenerate();

        return redirect()->route('verification.notice');
    }
}
