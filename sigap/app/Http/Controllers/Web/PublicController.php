<?php

namespace App\Http\Controllers\Web;

use App\Enums\TicketStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSurveyRequest;
use App\Http\Resources\V1\TicketResource;
use App\Models\Ticket;
use App\Services\OfficialNews;
use App\Services\PublicChannels;
use App\Services\StatsService;
use App\Services\SurveyService;
use App\Services\TicketService;
use App\Support\TicketFilters;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Halaman publik Contact Center (Inertia). Semua data dihitung dari Service yang SAMA
 * dengan /api/v1 (PRD D1) — tampilan lama dipertahankan, datanya nyata.
 */
class PublicController extends Controller
{
    public function __construct(
        private readonly StatsService $stats,
        private readonly TicketService $tickets,
        private readonly SurveyService $surveys,
    ) {}

    /**
     * Beranda utama: contact center TARA, semua dimulai dari chat. Berita resmi
     * dimuat setelah halaman tampil agar situs transmigrasi.go.id yang lambat
     * tidak menahan beranda.
     */
    public function home(OfficialNews $news): Response
    {
        return Inertia::render('public/beranda-transi', [
            'kanal' => PublicChannels::get(),
            'kantor' => PublicChannels::offices(),
            'berita' => Inertia::defer(fn () => $news->latest()),
            'beritaSemua' => OfficialNews::ALL_URL,
        ]);
    }

    /** Panduan lengkap pengaduan (masyarakat) & penanganan tiket (admin). */
    public function guide(): Response
    {
        return Inertia::render('public/panduan');
    }

    /** Data Terbuka Contact Center (tentang). */
    public function about(): Response
    {
        return Inertia::render('public/tentang', [
            'stats' => $this->stats->publicOverview(),
        ]);
    }

    /**
     * Katalog Pengaduan: kanal resmi serta Kantor Pusat & balai transmigrasi
     * (desain Wonder "SIGAP Kantor dan Balai Accordion").
     */
    public function catalog(): Response
    {
        return Inertia::render('public/katalog', [
            'kanal' => PublicChannels::get(),
            'kantor' => PublicChannels::offices(),
        ]);
    }

    /** Peta Wilayah: sebaran pengaduan per provinsi asal pengaduan. */
    public function map(): Response
    {
        return Inertia::render('public/peta', [
            'provinsi' => $this->complaintsByProvince(),
        ]);
    }

    /**
     * Total pengaduan publik per provinsi asal pengaduan (hanya angka agregat;
     * tiket internal tidak dihitung). Lokasi bebas yang ditulis pelapor TIDAK
     * ditampilkan di halaman publik karena bisa memuat data pribadi.
     *
     * @return list<array{provinsi: string, total: int, selesai: int, berjalan: int}>
     */
    private function complaintsByProvince(): array
    {
        $done = TicketStatus::Selesai->value;
        $open = "'".implode("', '", TicketFilters::openStatuses())."'";

        return Ticket::query()->public()->whereNotNull('province')->toBase()
            ->selectRaw("province, COUNT(*) as total, SUM(CASE WHEN status = '{$done}' THEN 1 ELSE 0 END) as selesai, SUM(CASE WHEN status IN ({$open}) THEN 1 ELSE 0 END) as berjalan")
            ->groupBy('province')
            ->orderByDesc('total')
            ->get()
            ->map(fn (object $r) => [
                'provinsi' => (string) $r->province,
                'total' => (int) $r->total,
                'selesai' => (int) $r->selesai,
                'berjalan' => (int) $r->berjalan,
            ])
            ->all();
    }

    /**
     * Lacak tiket publik — melayani `/lacak?ticket=TKT-...` (query) sekaligus
     * `/lacak/TKT-...` (path, PRD §5.1 `/lacak/:nomor`). Nomor huruf kecil
     * diterima; format lama `TKT-<n>` tetap valid.
     */
    public function track(Request $request, ?string $ticket = null): Response
    {
        $ticketNo = Ticket::normalizeNo($ticket ?? $request->string('ticket')->toString());
        $kode = mb_substr($request->string('kode')->trim()->upper()->toString(), 0, 16);
        $ticket = null;

        if ($ticketNo !== '' && Ticket::isValidNo($ticketNo)) {
            $model = $this->tickets->findForPublicLookup(
                $ticketNo,
                $request->user(),
                ['category', 'region', 'channel', 'histories', 'replies'],
                $kode,
            );

            $ticket = $model ? (new TicketResource($model))->resolve() : false;

            if ($model !== null && is_array($ticket)) {
                $ticket['sudah_disurvei'] = $model->survey()->exists();
            }
        }

        return Inertia::render('public/lacak', [
            'query' => $ticketNo,
            // Nomor format lama butuh kode akses bagi tamu (anti-enumerasi).
            'kode' => $kode,
            'butuh_kode' => Ticket::isLegacyNo($ticketNo),
            'ticket' => $ticket,
            'statuses' => collect(TicketStatus::cases())->mapWithKeys(
                fn ($s) => [$s->value => $s->label()]
            ),
        ]);
    }

    /** Simpan survei kepuasan dari halaman lacak (publik) — aturan A-07. */
    public function storeSurvey(StoreSurveyRequest $request): RedirectResponse
    {
        $ticket = $this->tickets->findForPublicLookup($request->ticketNo(), $request->user(), [], $request->accessCode());

        if ($ticket === null) {
            return back()->with('error', 'Tiket tidak ditemukan atau bukan tiket publik.');
        }

        try {
            $this->surveys->submit($ticket, $request->user(), $request->validated());
        } catch (AuthorizationException $e) {
            // Klien non-Inertia tetap menerima 403; form Inertia menampilkan
            // pesan pada field `ticket` alih-alih modal galat HTML.
            if (! $request->header('X-Inertia')) {
                throw $e;
            }

            return back()->withErrors(['ticket' => $e->getMessage()]);
        }

        return redirect()
            ->route('lacak.show', array_filter([
                'ticket' => $ticket->ticket_no,
                'kode' => Ticket::isLegacyNo($ticket->ticket_no) ? $request->accessCode() : null,
            ]))
            ->with('success', 'Terima kasih! Penilaian Anda telah kami terima.');
    }

    /** Literasi statis. */
    public function guidelines(): Response
    {
        return Inertia::render('public/pedoman-layanan');
    }

    public function terms(): Response
    {
        return Inertia::render('public/syarat-ketentuan');
    }

    public function privacy(): Response
    {
        return Inertia::render('public/kebijakan-privasi');
    }

    public function aboutUs(): Response
    {
        return Inertia::render('public/tentang-kami');
    }
}
