<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\Unit;
use App\Models\User;
use App\Services\DispositionService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/**
 * Disposisi tiket ke Unit Kerja (PRD-UNIT-KERJA F2) — Super Admin saja (K2).
 */
class DispositionController extends Controller
{
    public function __construct(private readonly DispositionService $dispositions) {}

    /** POST /admin/tiket/{ticket}/disposisi — disposisikan atau alihkan. */
    public function store(Request $request, Ticket $ticket): RedirectResponse
    {
        $this->authorize('manageAdmins', User::class);

        $data = $request->validate([
            'unit_id' => ['required', 'integer', Rule::exists('units', 'id')->where('is_active', true)],
            'catatan' => ['nullable', 'string', 'max:2000'],
            'tenggat' => ['nullable', 'date', 'after:now'],
        ], [
            'unit_id.required' => 'Pilih unit kerja.',
            'unit_id.exists' => 'Unit kerja tidak ditemukan atau sudah nonaktif.',
            'tenggat.after' => 'Tenggat harus setelah saat ini.',
        ]);

        $unit = Unit::query()->findOrFail($data['unit_id']);
        $redirected = $ticket->unit_id !== null;

        $this->dispositions->dispose(
            $ticket,
            $unit,
            $request->user(),
            $data['catatan'] ?? null,
            isset($data['tenggat']) ? Carbon::parse($data['tenggat']) : null,
        );

        return back()->with('success', $redirected
            ? "Disposisi dialihkan ke {$unit->displayName()}."
            : "Tiket didisposisikan ke {$unit->displayName()}.");
    }

    /** DELETE /admin/tiket/{ticket}/disposisi — tarik kembali. */
    public function destroy(Request $request, Ticket $ticket): RedirectResponse
    {
        $this->authorize('manageAdmins', User::class);

        $data = $request->validate(['alasan' => ['nullable', 'string', 'max:2000']]);
        $this->dispositions->withdraw($ticket, $request->user(), $data['alasan'] ?? null);

        return back()->with('success', 'Disposisi ditarik. Tiket kembali ke antrean belum didisposisi.');
    }
}
