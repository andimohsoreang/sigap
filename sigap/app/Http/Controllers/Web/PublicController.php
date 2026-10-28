<?php

namespace App\Http\Controllers\Web;

use App\Enums\TicketStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSurveyRequest;
use App\Http\Resources\V1\TicketResource;
use App\Models\Category;
use App\Models\Channel;
use App\Models\KnowledgeArticle;
use App\Models\Region;
use App\Models\Ticket;
use App\Services\PublicChannels;
use App\Services\StatsService;
use App\Services\SurveyService;
use App\Services\TicketService;
use Illuminate\Auth\Access\AuthorizationException;
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
    public function __construct(
        private readonly StatsService $stats,
        private readonly TicketService $tickets,
        private readonly SurveyService $surveys,
    ) {}

    /** Beranda utama (tampilan gaya absol.id). */
    public function home(): Response
    {
        return Inertia::render('public/beranda-absol', $this->homeProps());
    }

    /**
     * Beranda tampilan standar (lama) sebagai pembanding — data SAMA dengan
     * {@see home()}, hanya komponen tampilannya yang berbeda.
     */
    public function homeStandard(): Response
    {
        return Inertia::render('public/beranda', $this->homeProps());
    }

    /**
     * Beranda baru (uji coba): contact center TARA, semua dimulai dari chat.
     * Beranda utama tetap yang lama dan menautkan ke sini lewat "Coba Desain Baru".
     */
    public function homeTransi(): Response
    {
        return Inertia::render('public/beranda-transi', [
            'kanal' => PublicChannels::get(),
        ]);
    }

    /** @return array<string, mixed> */
    private function homeProps(): array
    {
        return [
            'stats' => $this->stats->publicOverview(),
            'channels' => $this->channelList(),
            'faqs' => $this->faqs(),
        ];
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

    /**
     * FAQ beranda dari Basis Pengetahuan (artikel terbit yang paling sering
     * dipakai). Daftar bawaan dipakai hanya bila belum ada artikel terbit.
     *
     * @return array<int, array{question: string, answer: string}>
     */
    private function faqs(): array
    {
        $articles = KnowledgeArticle::query()
            ->published()
            ->orderByDesc('used_count')
            ->orderBy('id')
            ->limit(8)
            ->get(['title', 'body']);

        if ($articles->isNotEmpty()) {
            return $articles->map(fn (KnowledgeArticle $a) => ['question' => $a->title, 'answer' => $a->body])->all();
        }

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
