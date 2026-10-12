<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreInputManualRequest;
use App\Http\Requests\StorePengaduanInternalRequest;
use App\Http\Requests\StorePengaduanRequest;
use App\Services\AttachmentService;
use App\Services\TicketService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class PengaduanController extends Controller
{
    public function __construct(
        private readonly TicketService $tickets,
        private readonly AttachmentService $attachments,
    ) {}

    /** POST /api/v1/pengaduan — pengaduan publik. */
    public function store(StorePengaduanRequest $request): JsonResponse
    {
        $data = $request->validated();
        [$lat, $lng] = $this->parseKoordinat($data['koordinat'] ?? null);

        $ticket = $this->tickets->create([
            'title' => $data['judul'],
            'description' => $data['uraian'],
            'impact' => $data['impact'],
            'visibility' => $data['visibility'] ?? 'publik',
            'latitude' => $lat,
            'longitude' => $lng,
            'region_id' => $data['region_id'] ?? null,
            'category_id' => $data['category_id'] ?? null,
            'channel_id' => null,
            'attachment_path' => $this->attachments->store($request->file('attachment')),
            'reporter_name' => $data['nama'],
            'reporter_nik' => $data['nik'],
            'reporter_email' => $data['email'] ?? null,
            'reporter_phone' => $data['telepon'] ?? null,
        ]);

        return response()->json([
            'ok' => true,
            'nomor_tiket' => $ticket->ticket_no,
            'id' => $ticket->ticket_no,
        ], 201);
    }

    /** POST /api/v1/pengaduan/internal — pengaduan internal pegawai. */
    public function storeInternal(StorePengaduanInternalRequest $request): JsonResponse
    {
        $data = $request->validated();

        $ticket = $this->tickets->create([
            'title' => 'Pengaduan internal ('.$data['urgensi'].')',
            'description' => $data['deskripsi'],
            'impact' => strtolower($data['urgensi']),
            'is_internal' => true,
            'category_id' => null,
            'attachment_path' => $this->attachments->store($request->file('attachment')),
            'reporter_name' => $data['nama'],
            'reporter_phone' => $data['kontak'],
        ]);

        return response()->json([
            'ok' => true,
            'nomor_tiket' => $ticket->ticket_no,
            'id' => $ticket->ticket_no,
        ], 201);
    }

    /** POST /api/v1/admin/input-manual — tiket dari kanal offline/medsos. */
    public function storeManual(StoreInputManualRequest $request): JsonResponse
    {
        $data = $request->validated();

        $ticket = $this->tickets->create([
            'title' => $data['judul'],
            'description' => $data['uraian'],
            'impact' => $data['impact'],
            'region_id' => $data['region_id'],
            'category_id' => $data['category_id'],
            'attachment_path' => $this->attachments->store($request->file('attachment')),
            'reporter_name' => $data['nama'],
            'reporter_nik' => $data['nik'] ?? null,
            'reporter_phone' => $data['telepon'] ?? null,
            'actor_id' => Auth::id(),
        ]);

        return response()->json([
            'ok' => true,
            'nomor_tiket' => $ticket->ticket_no,
            'id' => $ticket->ticket_no,
        ], 201);
    }

    /**
     * Pecah "lat, lng" menjadi dua nilai numerik.
     *
     * @return array{0: float|null, 1: float|null}
     */
    private function parseKoordinat(?string $koordinat): array
    {
        if (! $koordinat || ! str_contains($koordinat, ',')) {
            return [null, null];
        }

        [$lat, $lng] = array_map('trim', explode(',', $koordinat, 2));

        return [
            is_numeric($lat) ? (float) $lat : null,
            is_numeric($lng) ? (float) $lng : null,
        ];
    }
}