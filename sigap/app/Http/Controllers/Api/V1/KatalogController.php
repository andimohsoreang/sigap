<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\V1\ChannelResource;
use App\Http\Resources\V1\RegionResource;
use App\Models\Channel;
use App\Models\Region;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class KatalogController extends Controller
{
    /** GET /api/v1/katalog/kanal — kanal pengaduan publik. */
    public function kanal(): AnonymousResourceCollection
    {
        return ChannelResource::collection(
            Channel::query()->whereIn('type', ['sosmed', 'kantor', 'nasional'])->orderBy('id')->get()
        );
    }

    /** GET /api/v1/regions — kawasan transmigrasi untuk peta Leaflet (D6/D9). */
    public function regions(Request $request): AnonymousResourceCollection
    {
        $query = Region::query()->where('is_active', true)->orderBy('id');

        if ($request->filled('province')) {
            $query->where('province', $request->string('province'));
        }
        if ($request->filled('infrastructure_status')) {
            $query->where('infrastructure_status', $request->string('infrastructure_status'));
        }

        return RegionResource::collection($query->get());
    }
}