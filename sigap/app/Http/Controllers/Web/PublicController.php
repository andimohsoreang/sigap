<?php

namespace App\Http\Controllers\Web;

use App\Enums\TicketStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSurveyRequest;
use App\Http\Resources\V1\TicketResource;
use App\Models\Channel;
use App\Models\KnowledgeArticle;
use App\Models\Region;
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

    /** Beranda lama (tampilan gaya absol.id) sebagai pembanding. */
    public function homeAbsol(): Response
    {
        return Inertia::render('public/beranda-absol', $this->homeProps());
    }

    /**
     * Beranda tampilan standar (lama) sebagai pembanding — data SAMA dengan
     * {@see homeAbsol()}, hanya komponen tampilannya yang berbeda.
     */
    public function homeStandard(): Response
    {
        return Inertia::render('public/beranda', $this->homeProps());
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

    /** Data Terbuka Contact Center (tentang). */
    public function about(): Response
    {
        return Inertia::render('public/tentang', [
            'stats' => $this->stats->publicOverview(),
            'regions' => Region::query()->where('is_active', true)->get(['id', 'code', 'name', 'province', 'latitude', 'longitude', 'infrastructure_status', 'kk_count']),
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
            'provinsi' => $this->complaintsByProvince(),
        ]);
    }

    /**
     * Total pengaduan publik per provinsi untuk peta (hanya angka agregat;
     * tiket internal tidak dihitung). Nama provinsi seperti di data kawasan.
     *
     * @return list<array{provinsi: string, total: int, selesai: int, berjalan: int, kawasan: list<array{nama: string, total: int}>}>
     */
    private function complaintsByProvince(): array
    {
        $done = TicketStatus::Selesai->value;
        $open = "'".implode("', '", TicketFilters::openStatuses())."'";
        $rows = Ticket::query()->public()->whereNotNull('region_id')->toBase()
            ->selectRaw("region_id, COUNT(*) as total, SUM(CASE WHEN status = '{$done}' THEN 1 ELSE 0 END) as selesai, SUM(CASE WHEN status IN ({$open}) THEN 1 ELSE 0 END) as berjalan")
            ->groupBy('region_id')
            ->get()
            ->keyBy('region_id');
        $regions = Region::query()->whereKey($rows->keys()->all())->whereNotNull('province')->get(['id', 'name', 'province']);

        return $regions->groupBy(fn (Region $r) => trim($r->province))
            ->map(fn ($group, string $province) => [
                'provinsi' => $province,
                'total' => (int) $group->sum(fn (Region $r) => $rows[$r->id]->total),
                'selesai' => (int) $group->sum(fn (Region $r) => $rows[$r->id]->selesai),
                'berjalan' => (int) $group->sum(fn (Region $r) => $rows[$r->id]->berjalan),
                'kawasan' => $group->map(fn (Region $r) => ['nama' => $r->name, 'total' => (int) $rows[$r->id]->total])->sortByDesc('total')->values()->all(),
            ])
            ->sortByDesc('total')
            ->values()
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
            ['question' => 'Bagaimana cara mengadukan layanan?', 'answer' => 'Anda dapat membuat tiket aduan melalui menu "Katalog Pengaduan" memilih Contact Center di portal ini, mengisi formulir dengan detail lokasi, lalu menyimpannya.'],
            ['question' => 'Bagaimana caranya mendapatkan Hak Akses log in ke Contact Center?', 'answer' => 'Masyarakat umum dapat login lewat Portal Warga. Hak akses Admin dikhususkan bagi Pegawai terdaftar.'],
            ['question' => 'Bagaimana jika status tiket saya sudah RESOLVE?', 'answer' => 'Status Resolve menandakan keluhan Anda telah diselesaikan. Anda akan diminta mengisi survei kepuasan pelanggan.'],
            ['question' => 'Bagaimana Cara Mengajukan Permohonan Baru?', 'answer' => 'Pilih menu "Katalog Pengaduan" di halaman beranda, pilih layanan yang sesuai, lalu isi kolom formulir.'],
            ['question' => 'Bagaimana cara memperbaiki permohonan yang ditolak?', 'answer' => 'Jika tiket ditolak karena kurang lengkap, Anda dapat membuat tiket baru dengan mereferensikan nomor lama dan melampirkan bukti.'],
            ['question' => 'Bagaimana Cara Menghapus Dokumen yang sudah di Unggah?', 'answer' => 'Untuk alasan akuntabilitas, dokumen yang disubmit tidak dapat dihapus mandiri. Silakan hubungi admin via Live Chat.'],
        ];
    }
}
