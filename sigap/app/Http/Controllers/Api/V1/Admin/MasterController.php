<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\V1\ChannelResource;
use App\Http\Resources\V1\RegionResource;
use App\Models\Category;
use App\Models\Channel;
use App\Models\Region;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class MasterController extends Controller
{
    /* ----------------------------- Kawasan ----------------------------- */

    public function regions(): AnonymousResourceCollection
    {
        $this->authorize('manageMaster', User::class);

        return RegionResource::collection(Region::query()->orderBy('id')->get());
    }

    public function storeRegion(Request $request): JsonResponse
    {
        $this->authorize('manageMaster', User::class);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:30', 'unique:regions,code'],
            'name' => ['required', 'string', 'max:150'],
            'province' => ['nullable', 'string', 'max:100'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'infrastructure_status' => ['nullable', 'string', 'max:50'],
            'kk_count' => ['nullable', 'integer', 'min:0'],
        ]);

        return (new RegionResource(Region::create($data)))->response()->setStatusCode(201);
    }

    public function updateRegion(Request $request, Region $region): RegionResource
    {
        $this->authorize('manageMaster', User::class);

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

        return new RegionResource($region);
    }

    public function destroyRegion(Region $region): JsonResponse
    {
        $this->authorize('manageMaster', User::class);
        $region->delete();

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
        $this->authorize('manageMaster', User::class);

        $data = $request->validate([
            'type' => ['required', Rule::in(['sosmed', 'kantor', 'nasional', 'internal'])],
            'name' => ['required', 'string', 'max:120'],
            'account_name' => ['nullable', 'string', 'max:120'],
            'url' => ['nullable', 'url', 'max:500'],
            'status' => ['nullable', 'string', 'max:30'],
        ]);

        return (new ChannelResource(Channel::create($data)))->response()->setStatusCode(201);
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

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'nip' => ['required', 'string', 'max:50', 'unique:users,username'],
            'role' => ['required', Rule::in(UserRole::adminValues())],
            'region_id' => ['nullable', 'integer', 'exists:regions,id'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'username' => $data['nip'],
            'role' => UserRole::from($data['role']),
            'region_id' => $data['region_id'] ?? null,
            'password' => $data['password'],
            'is_active' => true,
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

        // PRD D10: WhatsApp selalu nonaktif pada fase ini.
        if (isset($data['notification'])) {
            $data['notification']['whatsapp_enabled'] = false;
            Setting::put('notification', $data['notification']);
            unset($data['notification']);
        }

        foreach ($data as $key => $value) {
            Setting::put($key, $value);
        }

        return $this->settings();
    }
}