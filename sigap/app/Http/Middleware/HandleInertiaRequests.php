<?php

namespace App\Http\Middleware;

use App\Models\ChatConversation;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return array_merge(parent::share($request), [
            'name' => config('app.name'),
            'app' => [
                'brand' => 'SIGAP',
                'tagline' => 'Suara Masyarakat, Inisiatif Gerak Aksi, Penyelesaian Tuntas',
                'ministry' => 'Kementerian Transmigrasi Republik Indonesia',
            ],
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'username' => $user->username,
                    'role' => $user->role?->value,
                    'is_admin' => $user->isAdmin(),
                ] : null,
            ],
            // Badge merah "Pesan Masuk" di sidebar admin (diperbarui live via Reverb).
            'chat_unread' => fn () => $user?->isAdmin() ? ChatConversation::unreadForAdmins() : null,
            // reCAPTCHA v3 (SEC-10): hanya site key publik; kosong = lewati (lokal).
            'recaptcha' => [
                'site_key' => config('services.recaptcha.site_key') ?: null,
            ],
            'flash' => [
                'status' => fn () => $request->session()->get('status'),
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ]);
    }
}
