<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Services\AuthService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Login web SIGAP — NIK/username + kata sandi (PRD D3).
 * Memakai AuthService yang sama dengan /api/v1 sehingga perilaku konsisten.
 */
class MasukController extends Controller
{
    public function __construct(private readonly AuthService $auth) {}

    public function create(Request $request): Response
    {
        return Inertia::render('public/masuk', [
            'status' => $request->session()->get('status'),
            'canResetPassword' => true,
        ]);
    }

    public function store(LoginRequest $request): RedirectResponse
    {
        try {
            $user = $this->auth->attempt(
                $request->validated('identifier'),
                $request->validated('password'),
                $request->boolean('remember'),
            );
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors())->onlyInput('identifier');
        }

        $request->session()->regenerate();

        return redirect()->intended(
            $user->isAdmin() ? route('admin.dashboard', absolute: false) : route('warga.portal', absolute: false)
        );
    }

    public function destroy(Request $request): RedirectResponse
    {
        $this->auth->logout($request->user());
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('home');
    }
}
