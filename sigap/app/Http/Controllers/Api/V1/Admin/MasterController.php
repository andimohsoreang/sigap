<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Web\AdminController;
use App\Http\Resources\V1\ChannelResource;
use App\Http\Resources\V1\RegionResource;
use App\Models\Category;
use App\Models\Channel;
use App\Models\Region;
use App\Models\Setting;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Master data via API — otorisasi & audit SAMA dengan panel web (A-05, D-02):
 * - kawasan: lihat (admin), ubah (super admin / admin kawasan miliknya),
 *   tambah & hapus (super admin);
 * - kanal: tambah (super admin);
 * - admin & pengaturan: super admin.
 */
class MasterController extends Controller
{
    public function __construct(private readonly AuditService $audit) {}

    /* ----------------------------- Kawasan ----------------------------- */

    public function regions(): AnonymousResourceCollection
    {
        $this->authorize('manageMaster', User::class);

        return RegionResource::collection(Region::query()->orderBy('id')->get());
    }

    public function storeRegion(Request $request): JsonResponse
    {
        $this->authorize('manageAdmins', User::class);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:30', 'unique:regions,code'],
            'name' => ['required', 'string', 'max:150'],
            'province' => ['nullable', 'string', 'max:100'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'infrastructure_status' => ['nullable', 'string', 'max:50'],
            'kk_count' => ['nullable', 'integer', 'min:0'],
        ]);

        $region = Region::create($data);

        $this->audit->safe('region.created', $region, "Kawasan {$region->name} ditambahkan (API).");

        return (new RegionResource($region))->response()->setStatusCode(201);
    }

    public function updateRegion(Request $request, Region $region): RegionResource
    {
        $this->authorize('updateRegion', [User::class, $region]);

        $data = $request->validate([
            'code' => ['sometimes', 'string', 'max:30', Rule::unique('regions', 'code')->ignore($region->id)],
            'name' => ['sometimes', 'string', 'max:150'],
            'province' => ['nullable', 'string', 'max:100'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'infrastructure_status' => ['nullable', 'string', 'max:50'],
            'kk_count' => ['nullable', 'integer', 'min:0'],
        ]);

        $region->update($data);

        $this->audit->safe('region.updated', $region, "Kawasan {$region->name} diperbarui (API).");

        return new RegionResource($region);
    }

    public function destroyRegion(Region $region): JsonResponse
    {
        $this->authorize('manageAdmins', User::class);
        $region->delete();

        $this->audit->safe('region.deleted', null, "Kawasan {$region->name} dihapus (API).", ['id' => $region->id]);

        return response()->json(null, 204);
    }

    /* ------------------------------ Kanal ------------------------------ */

    public function channels(): AnonymousResourceCollection
    {
        $this->authorize('manageMaster', User::class);

        return ChannelResource::collection(Channel::query()->orderBy('id')->get());
    }

    public function storeChannel(Request $request): JsonResponse
    {
        $this->authorize('manageAdmins', User::class);

        $data = $request->validate([
            'type' => ['required', Rule::in(['sosmed', 'kantor', 'nasional', 'internal'])],
            'name' => ['required', 'string', 'max:120'],
            'account_name' => ['nullable', 'string', 'max:120'],
            'url' => ['nullable', 'url:http,https', 'max:500'],
            'status' => ['nullable', 'string', 'max:30'],
        ]);

        $channel = Channel::create($data);

        $this->audit->safe('channel.created', $channel, "Kanal {$channel->name} ditambahkan (API).");

        return (new ChannelResource($channel))->response()->setStatusCode(201);
    }

    /* ------------------------------ Admin ------------------------------ */

    public function admins(): JsonResponse
    {
        $this->authorize('manageAdmins', User::class);

        $admins = User::query()
            ->whereIn('role', UserRole::adminValues())
            ->with('region')
            ->orderBy('id')
            ->get()
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'nip' => $u->username,
                'role' => $u->role?->value,
                'region' => $u->region?->name,
                'status' => $u->is_active ? 'Aktif' : 'Nonaktif',
            ]);

        return response()->json($admins);
    }

    public function storeAdmin(Request $request): JsonResponse
    {
        $this->authorize('manageAdmins', User::class);

        // A-05/A-18: aturan sama dengan panel web.
        $data = $request->validate(AdminController::adminRules($request), AdminController::adminMessages());

        $user = User::create([
            'name' => $data['name'],
            'username' => $data['nip'],
            'role' => UserRole::from($data['role']),
            'region_id' => $data['region_id'] ?? null,
            'password' => $data['password'],
            'is_active' => true,
        ]);

        $this->audit->safe('admin.created', $user, "Akun admin {$data['name']} ({$data['nip']}) dibuat (API).", [
            'role' => $data['role'],
        ]);

        return response()->json(['id' => $user->id, 'name' => $user->name], 201);
    }

    /* --------------------------- Pengaturan ---------------------------- */

    public function settings(): JsonResponse
    {
        $this->authorize('manageMaster', User::class);

        return response()->json([
            'sla_response_minutes' => Setting::get('sla_response_minutes', 60),
            'ews_enabled' => (bool) Setting::get('ews_enabled', true),
            'auto_disposition' => (bool) Setting::get('auto_disposition', false),
            'categories' => Category::query()->orderBy('id')->get(['id', 'name', 'slug', 'priority_default', 'sla_days']),
            'notification' => Setting::get('notification', [
                'pic_email' => null, 'pic_phone' => null, 'whatsapp_enabled' => false,
            ]),
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $this->authorize('manageAdmins', User::class);

        $data = $request->validate([
            'sla_response_minutes' => ['nullable', 'integer', 'min:1'],
            'ews_enabled' => ['nullable', 'boolean'],
            'auto_disposition' => ['nullable', 'boolean'],
            'notification' => ['nullable', 'array'],
            'notification.pic_email' => ['nullable', 'email'],
            'notification.pic_phone' => ['nullable', 'string', 'max:30'],
        ]);

        $keys = array_keys($data);

        // PRD D10: WhatsApp selalu nonaktif pada fase ini.
        if (isset($data['notification'])) {
            $data['notification']['whatsapp_enabled'] = false;
            Setting::put('notification', $data['notification']);
            unset($data['notification']);
        }

        foreach ($data as $key => $value) {
            Setting::put($key, $value);
        }

        $this->audit->safe('settings.updated', null, 'Pengaturan sistem diperbarui (API).', [
            'keys' => $keys,
        ]);

        return $this->settings();
    }
}
