<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePengaduanInternalRequest;
use App\Http\Requests\StorePengaduanRequest;
use App\Models\Category;
use App\Models\Region;
use App\Services\TicketService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Formulir pengaduan web (Inertia). Memakai TicketService/Request yang SAMA
 * dengan /api/v1 (PRD D1) sehingga aturan validasi & SLA identik.
 */
class PengaduanFormController extends Controller
{
    public function __construct(private readonly TicketService $tickets) {}

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
            'attachment' => $request->file('attachment'),
            'reporter_name' => $data['nama'],
            'reporter_nik' => $data['nik'],
            'reporter_email' => $data['email'] ?? null,
            'reporter_phone' => $data['telepon'] ?? null,
            // Warga yang sedang login: kaitkan laporannya ke akun (SEC-07).
            'reporter_id' => $request->reporterId($request->user()),
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
                'Unit Layanan Pengaduan (Contact Center)',
                'Lainnya',
            ],
            'categories' => ['Internet / Jaringan', 'Listrik', 'Perangkat / Hardware', 'Aplikasi / Software', 'Fasilitas Kantor', 'Lainnya'],
        ]);
    }

    public function storeInternal(StorePengaduanInternalRequest $request): RedirectResponse
    {
        $data = $request->validated();

        // A-12: NIP, unit & lokasi ikut disimpan.
        $ticket = $this->tickets->create([
            'title' => 'Pengaduan internal ('.$data['urgensi'].') — '.$data['kategori'],
            'description' => $data['deskripsi'],
            'impact' => $request->impact(),
            'is_internal' => true,
            'attachment' => $request->file('attachment'),
            'reporter_name' => $data['nama'],
            'reporter_phone' => $data['kontak'],
            'reporter_nip' => $data['nip'],
            'reporter_unit' => $data['unit'],
            'location' => $data['lokasi'],
        ]);

        return redirect()
            ->route('home')
            ->with('success', "Laporan internal {$ticket->ticket_no} terkirim ke unit terkait.");
    }
}
