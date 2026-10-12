<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Channel;
use App\Models\ChannelSyncLog;
use App\Models\User;
use App\Services\AuditService;
use App\Services\Channels\ChannelAdapterManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class IntegrasiController extends Controller
{
    public function __construct(
        private readonly ChannelAdapterManager $adapters,
        private readonly AuditService $audit,
    ) {}

    /**
     * POST /api/v1/admin/integrasi/{sp4n|wbs} — jalankan sinkronisasi (STUB, D7).
     */
    public function sync(string $channel): JsonResponse
    {
        $this->authorize('manageAdmins', User::class);

        if (! in_array(strtolower($channel), $this->adapters->keys(), true)) {
            return response()->json(['error' => 'Kanal integrasi tidak dikenal.'], 404);
        }

        $result = $this->adapters->for($channel)->sync();

        // Tandai kanal terkait sudah tersinkron.
        Channel::query()
            ->where('name', 'like', '%'.($channel === 'wbs' ? 'Whistle' : 'SP4N').'%')
            ->update(['last_synced_at' => now()]);

        Log::info('Sinkronisasi kanal (stub)', $result->toArray());

        $this->audit->safe('channel.synced', null, "Sinkronisasi kanal {$channel} ({$result->pulledCount} data) (API).");

        return response()->json($result->toArray());
    }

    /** GET /api/v1/admin/integrasi/log — log sinkronisasi. */
    public function logs(): JsonResponse
    {
        $this->authorize('manageAdmins', User::class);

        return response()->json(
            ChannelSyncLog::query()->latest()->limit(50)->get([
                'channel', 'pulled_count', 'status', 'message', 'created_at',
            ])
        );
    }
}
