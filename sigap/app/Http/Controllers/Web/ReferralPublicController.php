<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Referral;
use App\Services\ReferralService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * Halaman pengantar rujukan untuk warga: /rujukan/{token}.
 *
 * Token acak 48 karakter adalah satu-satunya kunci (tanpa login), jadi:
 * - halaman tidak diindeks mesin pencari dan tidak mengirim Referer ke
 *   portal tujuan (token tidak bocor lewat tautan keluar);
 * - setiap aksi kembali ke halaman pengantar secara eksplisit (bukan
 *   `back()`), karena Referer sengaja dibatasi;
 * - hanya data yang memang ditujukan ke warga itu yang ditampilkan.
 */
class ReferralPublicController extends Controller
{
    public function __construct(private readonly ReferralService $referrals) {}

    public function show(Request $request, string $token): Response
    {
        $referral = $this->find($token);
        $portal = $referral->portal;

        return Inertia::render('public/rujukan', [
            'portal' => [
                'nama' => $portal->name,
                'kegunaan' => $portal->purpose,
                'keterangan' => $portal->description,
                'langkah' => $portal->stepList(),
                'siapkan' => $portal->prepareList(),
                'bukti' => $this->referrals->proofLabel($referral),
                'url' => $portal->destination(),
                'tombol' => $portal->action_label ?: 'Lanjut ke '.$portal->name,
                'domain' => $portal->host(),
                'pengelola' => $portal->managed_by,
                'kontak' => $portal->contact,
                'tersedia' => $portal->is_reachable,
            ],
            'rujukan' => [
                'token' => $referral->token,
                'kode' => $referral->code,
                'status' => $referral->status,
                'status_label' => $referral->label(),
                'ringkasan' => $referral->summary,
                'pendamping' => $referral->assignee ? Str::before($referral->assignee->name, ' ') : null,
                'bukti' => $referral->external_ref,
                'dibuat' => $referral->created_at?->toIso8601String(),
                'ada_chat' => $referral->conversation_id !== null,
                'punya_kontak' => filled($referral->contact),
            ],
        ])->toResponse($request)->withHeaders([
            'X-Robots-Tag' => 'noindex, nofollow',
            // Tidak ada Referer ke situs lain → token tidak bocor ke portal tujuan.
            'Referrer-Policy' => 'same-origin',
        ]);
    }

    /** POST /rujukan/{token}/buka — dicatat sebelum tab portal tujuan dibuka. */
    public function open(string $token): JsonResponse
    {
        $referral = $this->find($token);
        $this->referrals->markOpened($referral);

        return response()->json(['url' => $referral->portal->destination()]);
    }

    /** POST /rujukan/{token}/berhasil — warga memasukkan kode bukti dari portal tujuan. */
    public function confirm(Request $request, string $token): RedirectResponse
    {
        $referral = $this->find($token);
        $data = $request->validate([
            'bukti' => ['required', 'string', 'min:3', 'max:100', 'regex:/^[\pL\pN\-\/\.\s#]+$/u'],
        ], [], ['bukti' => $this->referrals->proofLabel($referral)]);

        if (! $referral->isOpen()) {
            return $this->page($referral)->with('error', 'Rujukan ini sudah ditutup.');
        }

        $this->referrals->confirm($referral, $data['bukti']);

        return $this->page($referral)->with('success', 'Terima kasih. Aduan Anda tercatat dan petugas pendamping sudah diberi tahu.');
    }

    /** POST /rujukan/{token}/bantuan — warga mengalami kendala di portal tujuan. */
    public function help(Request $request, string $token): RedirectResponse
    {
        $referral = $this->find($token);
        $data = $request->validate([
            'pesan' => ['required', 'string', 'min:5', 'max:1000'],
            'kontak' => ['nullable', 'string', 'max:100', 'regex:/^[0-9+\s\-]{8,20}$|^[^@\s]+@[^@\s]+\.[^@\s]+$/'],
        ], ['kontak.regex' => 'Tulis nomor WhatsApp atau alamat surel yang valid.']);

        if (! $referral->isOpen()) {
            return $this->page($referral)->with('error', 'Rujukan ini sudah ditutup.');
        }

        $this->referrals->requestHelp($referral, $data['pesan'], $data['kontak'] ?? null);

        return $this->page($referral)->with('success', 'Kendala Anda sudah kami terima. Petugas pendamping akan menghubungi Anda.');
    }

    private function page(Referral $referral): RedirectResponse
    {
        return redirect()->route('rujukan.show', $referral->token);
    }

    private function find(string $token): Referral
    {
        abort_unless(strlen($token) === 48 && ctype_alnum($token), 404);

        return Referral::query()->with(['portal', 'assignee:id,name'])->where('token', $token)->firstOrFail();
    }
}
