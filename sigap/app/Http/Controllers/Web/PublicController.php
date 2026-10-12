<?php

namespace App\Http\Controllers\Web;

use App\Enums\TicketStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\V1\TicketResource;
use App\Models\Category;
use App\Models\Channel;
use App\Models\Region;
use App\Models\Ticket;
use App\Services\StatsService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Halaman publik SIGAP (Inertia). Semua data dihitung dari Service yang SAMA
 * dengan /api/v1 (PRD D1) — tampilan lama dipertahankan, datanya nyata.
 */
class PublicController extends Controller
{
    public function __construct(private readonly StatsService $stats) {}

    /** Beranda. */
    public function home(): Response
    {
        return Inertia::render('public/beranda', [
            'stats' => $this->stats->publicOverview(),
            'channels' => $this->channelList(),
            'faqs' => $this->faqs(),
        ]);
    }

    /**
     * Beranda pembanding bergaya absol.id — data SAMA dengan {@see home()},
     * hanya komponen tampilannya yang berbeda (lihat `public/beranda-absol`).
     */
    public function homeAbsol(): Response
    {
        return Inertia::render('public/beranda-absol', [
            'stats' => $this->stats->publicOverview(),
            'channels' => $this->channelList(),
            'faqs' => $this->faqs(),
        ]);
    }

    /** Panduan lengkap pengaduan (masyarakat) & penanganan tiket (admin). */
    public function guide(): Response
    {
        return Inertia::render('public/panduan');
    }

    /** Data Terbuka SIGAP (tentang). */
    public function about(): Response
    {
        return Inertia::render('public/tentang', [
            'stats' => $this->stats->publicOverview(),
            'regions' => Region::query()->where('is_active', true)->get(['id', 'code', 'name', 'province', 'latitude', 'longitude', 'infrastructure_status', 'kk_count']),
        ]);
    }

    /** Katalog kanal & kategori pengaduan. */
    public function catalog(): Response
    {
        return Inertia::render('public/katalog', [
            'channels' => $this->channelList(),
            'categories' => Category::query()->where('is_active', true)->get(['id', 'name', 'slug']),
        ]);
    }

    /** Peta kawasan (Leaflet — data spasial dummy, PRD D9). */
    public function map(): Response
    {
        return Inertia::render('public/peta', [
            'regions' => Region::query()->where('is_active', true)->count(),
            'points' => Region::query()
                ->where('is_active', true)
                ->whereNotNull('latitude')
                ->whereNotNull('longitude')
                ->get(['id', 'code', 'name', 'province', 'latitude', 'longitude', 'infrastructure_status', 'kk_count']),
        ]);
    }

    /**
     * Lacak tiket publik — melayani `/lacak?ticket=TKT-1` (query) sekaligus
     * `/lacak/TKT-1` (path, PRD §5.1 `/lacak/:nomor`).
     */
    public function track(Request $request, ?string $ticket = null): Response
    {
        $ticketNo = trim($ticket ?? $request->string('ticket')->toString());
        $ticket = null;

        if ($ticketNo !== '' && preg_match('/^TKT-\d+$/i', $ticketNo)) {
            $model = Ticket::query()
                ->public()
                ->with(['category', 'region', 'channel', 'assignee', 'histories', 'replies.author'])
                ->where('ticket_no', strtoupper($ticketNo))
                ->first();

            $ticket = $model ? (new TicketResource($model))->resolve() : false;

            if ($model !== null && is_array($ticket)) {
                $ticket['sudah_disurvei'] = $model->survey()->exists();
            }
        }

        return Inertia::render('public/lacak', [
            'query' => strtoupper($ticketNo),
            'ticket' => $ticket,
            'statuses' => collect(TicketStatus::cases())->mapWithKeys(
                fn ($s) => [$s->value => $s->label()]
            ),
        ]);
    }

    /** Simpan survei kepuasan dari halaman lacak (publik). */
    public function storeSurvey(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'ticket' => ['required', 'string', 'regex:/^TKT-\d+$/i'],
            'rating' => ['required', 'integer', 'between:1,5'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);

        $ticket = Ticket::query()
            ->public()
            ->where('ticket_no', strtoupper($data['ticket']))
            ->first();

        if ($ticket === null) {
            return back()->with('error', 'Tiket tidak ditemukan atau bukan tiket publik.');
        }

        abort_unless($ticket->status === TicketStatus::Selesai, 422, 'Survei hanya untuk tiket yang telah selesai.');

        $ticket->survey()->updateOrCreate([], [
            'rating' => $data['rating'],
            'comment' => $data['comment'] ?? null,
        ]);

        return redirect()
            ->route('lacak.show', $ticket->ticket_no)
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

    /** @return array<int, array<string, mixed>> */
    private function channelList(): array
    {
        return Channel::query()
            ->whereIn('type', ['sosmed', 'kantor', 'nasional', 'internal'])
            ->orderBy('id')
            ->get()
            ->map(fn ($c) => [
                'id' => $c->id,
                'type' => $c->type?->value,
                'type_label' => $c->type?->label(),
                'name' => $c->name,
                'account_name' => $c->account_name,
                'url' => $c->url,
                'status' => $c->status,
            ])
            ->all();
    }

    /** @return array<int, array{question: string, answer: string}> */
    private function faqs(): array
    {
        return [
            ['question' => 'Bagaimana cara mengadukan layanan?', 'answer' => 'Anda dapat membuat tiket aduan melalui menu "Katalog Pengaduan" memilih SIGAP di portal ini, mengisi formulir dengan detail lokasi, lalu menyimpannya.'],
            ['question' => 'Bagaimana caranya mendapatkan Hak Akses log in ke SIGAP?', 'answer' => 'Masyarakat umum dapat login lewat Portal Warga. Hak akses Admin dikhususkan bagi Pegawai terdaftar.'],
            ['question' => 'Bagaimana jika status tiket saya sudah RESOLVE?', 'answer' => 'Status Resolve menandakan keluhan Anda telah diselesaikan. Anda akan diminta mengisi survei kepuasan pelanggan.'],
            ['question' => 'Bagaimana Cara Mengajukan Permohonan Baru?', 'answer' => 'Pilih menu "Katalog Pengaduan" di halaman beranda, pilih layanan yang sesuai, lalu isi kolom formulir.'],
            ['question' => 'Bagaimana cara memperbaiki permohonan yang ditolak?', 'answer' => 'Jika tiket ditolak karena kurang lengkap, Anda dapat membuat tiket baru dengan mereferensikan nomor lama dan melampirkan bukti.'],
            ['question' => 'Bagaimana Cara Menghapus Dokumen yang sudah di Unggah?', 'answer' => 'Untuk alasan akuntabilitas, dokumen yang disubmit tidak dapat dihapus mandiri. Silakan hubungi admin via Live Chat.'],
        ];
    }
}