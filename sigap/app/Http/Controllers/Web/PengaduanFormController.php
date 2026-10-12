<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePengaduanInternalRequest;
use App\Http\Requests\StorePengaduanRequest;
use App\Models\Category;
use App\Models\Region;
use App\Services\AttachmentService;
use App\Services\TicketService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Formulir pengaduan web (Inertia). Memakai TicketService/Request yang SAMA
 * dengan /api/v1 (PRD D1) sehingga aturan validasi & SLA identik.
 */
class PengaduanFormController extends Controller
{
    public function __construct(
        private readonly TicketService $tickets,
        private readonly AttachmentService $attachments,
    ) {}

    public function create(): Response
    {
        return Inertia::render('public/formulir-pengaduan', [
            'regions' => Region::query()->where('is_active', true)->get(['id', 'code', 'name', 'province']),
            'categories' => Category::query()->where('is_active', true)->get(['id', 'name', 'slug']),
        ]);
    }

    public function store(StorePengaduanRequest $request): RedirectResponse
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
            'attachment_path' => $this->attachments->store($request->file('attachment')),
            'reporter_name' => $data['nama'],
            'reporter_nik' => $data['nik'],
            'reporter_email' => $data['email'] ?? null,
            'reporter_phone' => $data['telepon'] ?? null,
            // Warga yang sedang login: kaitkan laporannya ke akun (SEC-07).
            'reporter_id' => Auth::id(),
        ]);

        return redirect()
            ->route('lacak.show', $ticket->ticket_no)
            ->with('success', "Tiket {$ticket->ticket_no} berhasil dibuat. Simpan nomor ini untuk melacak status.");
    }

    public function createInternal(): Response
    {
        return Inertia::render('public/formulir-internal', [
            'units' => [
                'Sekretariat Jenderal',
                'Direktorat Jenderal PKP2Trans',
                'Direktorat Jenderal PKTrans',
                'Biro Umum & TIK',
                'Unit Layanan Pengaduan (SIGAP)',
                'Lainnya',
            ],
            'categories' => ['Internet / Jaringan', 'Listrik', 'Perangkat / Hardware', 'Aplikasi / Software', 'Fasilitas Kantor', 'Lainnya'],
        ]);
    }

    public function storeInternal(StorePengaduanInternalRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $ticket = $this->tickets->create([
            'title' => 'Pengaduan internal ('.$data['urgensi'].') — '.$data['kategori'],
            'description' => $data['deskripsi'],
            'impact' => strtolower($data['urgensi']),
            'is_internal' => true,
            'attachment_path' => $this->attachments->store($request->file('attachment')),
            'reporter_name' => $data['nama'],
            'reporter_phone' => $data['kontak'],
        ]);

        return redirect()
            ->route('home')
            ->with('success', "Laporan internal {$ticket->ticket_no} terkirim ke unit terkait.");
    }

    /** @return array{0: float|null, 1: float|null} */
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