<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreInputManualRequest;
use App\Http\Requests\StorePengaduanInternalRequest;
use App\Http\Requests\StorePengaduanRequest;
use App\Models\Ticket;
use App\Services\AuditService;
use App\Services\TicketService;
use Illuminate\Http\JsonResponse;

class PengaduanController extends Controller
{
    public function __construct(
        private readonly TicketService $tickets,
        private readonly AuditService $audit,
    ) {}

    /** POST /api/v1/pengaduan — pengaduan publik. */
    public function store(StorePengaduanRequest $request): JsonResponse
    {
        $data = $request->validated();
        [$lat, $lng] = $request->coordinates();

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
            'attachment' => $request->file('attachment'),
            'reporter_name' => $data['nama'],
            'reporter_nik' => $data['nik'],
            'reporter_email' => $data['email'] ?? null,
            'reporter_phone' => $data['telepon'] ?? null,
            // Warga yang login (token/sesi): kaitkan laporan ke akunnya (SEC-07).
            'reporter_id' => $request->reporterId($request->user('sanctum')),
        ]);

        return $this->created($ticket);
    }

    /** POST /api/v1/pengaduan/internal — pengaduan internal pegawai. */
    public function storeInternal(StorePengaduanInternalRequest $request): JsonResponse
    {
        $data = $request->validated();

        $ticket = $this->tickets->create([
            'title' => 'Pengaduan internal ('.$data['urgensi'].') — '.$data['kategori'],
            'description' => $data['deskripsi'],
            'impact' => $request->impact(),
            'is_internal' => true,
            'category_id' => null,
            'attachment' => $request->file('attachment'),
            'reporter_name' => $data['nama'],
            'reporter_phone' => $data['kontak'],
            'reporter_nip' => $data['nip'],
            'reporter_unit' => $data['unit'],
            'location' => $data['lokasi'],
        ]);

        return $this->created($ticket);
    }

    /**
     * POST /api/v1/admin/input-manual — tiket dari kanal offline/medsos.
     *
     * A-11: admin kawasan selalu memakai kawasannya sendiri; sumber laporan,
     * tautan, admin penerima & lampiran ikut disimpan.
     */
    public function storeManual(StoreInputManualRequest $request): JsonResponse
    {
        $this->authorize('create', Ticket::class);

        $ticket = $this->tickets->create($request->ticketData($request->user()));

        $this->audit->safe('ticket.created_manual', $ticket, "Tiket {$ticket->ticket_no} dibuat lewat input manual (API).");

        return $this->created($ticket);
    }

    private function created(Ticket $ticket): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'nomor_tiket' => $ticket->ticket_no,
            'id' => $ticket->ticket_no,
        ], 201);
    }
}
