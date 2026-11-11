<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Unit;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Master Unit Kerja (PRD-UNIT-KERJA F1) — Super Admin saja. Unit tidak
 * dihapus; unit yang tidak dipakai lagi dinonaktifkan agar riwayat tiket dan
 * akun petugas tetap merujuk unitnya.
 */
class UnitController extends Controller
{
    public function __construct(private readonly AuditService $audit) {}

    public function index(): Response
    {
        $this->authorize('manageAdmins', User::class);

        $units = Unit::query()
            ->withCount(['users as petugas' => fn ($q) => $q->where('is_active', true)])
            ->orderBy('sort')
            ->orderBy('name')
            ->get();

        $byParent = $units->groupBy(fn (Unit $u) => $u->parent_id ?? 0);
        $rows = [];
        $walk = function (int $parent, int $depth) use (&$walk, &$rows, $byParent): void {
            foreach ($byParent[$parent] ?? [] as $unit) {
                $rows[] = [
                    'id' => $unit->id,
                    'code' => $unit->code,
                    'name' => $unit->name,
                    'short_name' => $unit->short_name,
                    'parent_id' => $unit->parent_id,
                    'level' => $unit->level,
                    'email' => $unit->email,
                    'is_active' => $unit->is_active,
                    'sort' => $unit->sort,
                    'depth' => $depth,
                    'petugas' => (int) $unit->petugas,
                    'anak' => count($byParent[$unit->id] ?? []),
                ];
                $walk($unit->id, $depth + 1);
            }
        };
        $walk(0, 0);

        return Inertia::render('admin/unit-kerja', [
            'units' => $rows,
            'levels' => collect(Unit::LEVELS)->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label])->values(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorize('manageAdmins', User::class);

        $unit = Unit::create($this->validated($request));
        $this->audit->safe('unit.created', null, "Unit kerja {$unit->name} ditambahkan.", ['code' => $unit->code]);

        return back()->with('success', "Unit {$unit->displayName()} ditambahkan.");
    }

    public function update(Request $request, Unit $unit): RedirectResponse
    {
        $this->authorize('manageAdmins', User::class);

        $data = $this->validated($request, $unit);
        $wasActive = $unit->is_active;
        $unit->update($data);

        $action = match (true) {
            $wasActive && ! $unit->is_active => 'unit.deactivated',
            ! $wasActive && $unit->is_active => 'unit.activated',
            default => 'unit.updated',
        };
        $this->audit->safe($action, null, "Unit kerja {$unit->name} diperbarui.", ['code' => $unit->code]);

        return back()->with('success', "Unit {$unit->displayName()} diperbarui.");
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?Unit $unit = null): array
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:30', 'regex:/^[A-Z0-9-]+$/', Rule::unique('units', 'code')->ignore($unit?->id)],
            'name' => ['required', 'string', 'max:200'],
            'short_name' => ['nullable', 'string', 'max:60'],
            'parent_id' => ['nullable', 'integer', 'exists:units,id'],
            'level' => ['required', Rule::in(array_keys(Unit::LEVELS))],
            'email' => ['nullable', 'email', 'max:150'],
            'is_active' => ['boolean'],
            'sort' => ['nullable', 'integer', 'min:0', 'max:999'],
        ], [
            'code.regex' => 'Kode hanya huruf besar, angka, dan tanda hubung (mis. SETJEN-HUKUM).',
            'code.unique' => 'Kode unit sudah dipakai.',
        ]);

        if ($unit !== null && isset($data['parent_id']) && in_array((int) $data['parent_id'], $unit->selfAndDescendantIds(), true)) {
            throw ValidationException::withMessages(['parent_id' => 'Induk tidak boleh unit ini sendiri atau unit di bawahnya.']);
        }

        $data['email'] = isset($data['email']) ? mb_strtolower(trim($data['email'])) : null;
        $data['sort'] ??= 0;

        return $data;
    }
}
