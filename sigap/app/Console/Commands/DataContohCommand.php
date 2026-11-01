<?php

namespace App\Console\Commands;

use App\Enums\TicketImpact;
use App\Enums\TicketStatus;
use App\Enums\TicketVisibility;
use App\Enums\UserRole;
use App\Models\Category;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\KnowledgeArticle;
use App\Models\Portal;
use App\Models\Referral;
use App\Models\ReferralEvent;
use App\Models\Survey;
use App\Models\Ticket;
use App\Models\TicketHistory;
use App\Models\TicketReply;
use App\Models\User;
use App\Services\SlaCalculator;
use App\Services\StatsService;
use Carbon\CarbonInterface;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Data contoh untuk demo: tiket dari berbagai provinsi & kanal dengan kasus
 * yang umum (tepat/lewat SLA, ditolak, rahasia, dari chat, internal), serta
 * percakapan TARA (terjawab AI, menunggu petugas, dirujuk ke portal, jadi
 * tiket). Ditulis langsung ke basis data tanpa memicu surel/notifikasi.
 * Penanda: surel @contoh.test & token tamu "contoh-". Hapus dengan
 * sigap:reset-transaksi.
 */
class DataContohCommand extends Command
{
    protected $signature = 'sigap:data-contoh {--force : Tetap jalan walau sudah ada data transaksi}';

    protected $description = 'Isi data contoh (tiket & percakapan) untuk demo sistem dan panel admin';

    private const ALPHABET = Ticket::NUMBER_ALPHABET;

    /** @var array<string, int> */
    private array $categories = [];

    /** @var list<User> */
    private array $staff = [];

    public function __construct(private readonly SlaCalculator $sla)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        if (! $this->option('force') && (Ticket::withTrashed()->exists() || ChatConversation::query()->exists())) {
            $this->error('Masih ada data transaksi. Jalankan sigap:reset-transaksi dulu, atau pakai --force.');

            return self::FAILURE;
        }

        $this->categories = Category::query()->pluck('id', 'slug')->all();
        if (count($this->categories) < 4) {
            $this->error('Kategori master belum lengkap (jalankan MasterSeeder).');

            return self::FAILURE;
        }

        DB::transaction(function () {
            $this->staff = [
                $this->staffUser('Rina Puspitasari', 'contoh.rina'),
                $this->staffUser('Dimas Pratama', 'contoh.dimas'),
            ];

            foreach ($this->tickets() as $i => $t) {
                $this->createTicket($t, $i);
            }
            $this->createConversations();
        });

        Cache::forget(StatsService::PUBLIC_CACHE_KEY);
        $this->info(sprintf('Selesai: %d tiket, %d percakapan, %d rujukan contoh.', Ticket::query()->count(), ChatConversation::query()->count(), Referral::query()->count()));

        return self::SUCCESS;
    }

    private function staffUser(string $name, string $username): User
    {
        return User::query()->firstOrCreate(['username' => $username], [
            'name' => $name,
            'email' => $username.'@contoh.test',
            'role' => UserRole::AdminKawasan,
            // Akun contoh tidak untuk login: sandi acak yang tidak pernah ditampilkan.
            'password' => Str::password(40),
            'is_active' => true,
        ]);
    }

    /* ------------------------------------------------------------ Tiket */

    /**
     * [judul, uraian, kategori, dampak, provinsi, lokasi, hari lalu, status, kanal, opsi]
     * kanal: web | call_center | surat | instagram | tatap_muka | facebook | internal
     * opsi: telat (selesai melewati SLA), rating, komentar, tolak (alasan), rahasia, anonim, balas
     *
     * @return list<array<int, mixed>>
     */
    private function tickets(): array
    {
        return [
            ['Sertifikat lahan pekarangan belum terbit sejak 2019', 'Kami warga SP 7 sudah menempati lahan sejak 2018. Sertifikat lahan pekarangan (LP) belum terbit, padahal warga di SP sebelah sudah menerima. Mohon kejelasan jadwal penerbitan.', 'tata-kelola-lahan', 'tinggi', 'Papua Selatan', 'Kab. Merauke, SP 7 Kurik', 74, 'selesai', 'web', ['rating' => 5, 'komentar' => 'Terima kasih, sertifikat sudah dibagikan di balai desa.', 'balas' => 'Sertifikat LP untuk 46 KK SP 7 dijadwalkan dibagikan bersama BPN pada 12 Agustus di balai desa.']],
            ['Jembatan kayu penghubung SP 3 ke jalan poros rusak', 'Jembatan kayu sepanjang 12 meter yang menghubungkan permukiman SP 3 ke jalan poros patah di bagian tengah. Anak sekolah harus memutar 6 km. Mohon perbaikan segera.', 'infrastruktur-dasar', 'kritis', 'Kalimantan Utara', 'Kab. Bulungan, SP 3 Tanjung Buka', 20, 'diproses', 'web', ['balas' => 'Tim teknis sudah meninjau lokasi pada 14 Oktober. Perbaikan dimasukkan dalam paket pemeliharaan triwulan IV.']],
            ['Air bersih tidak mengalir ke blok C', 'Sumur bor komunal untuk blok C mati sejak dua minggu lalu. Warga mengambil air dari sungai yang keruh.', 'infrastruktur-dasar', 'kritis', 'Sulawesi Selatan', 'Kab. Luwu Timur, Mahalona', 9, 'baru', 'call_center', []],
            ['Bantuan bibit jagung tahap II belum diterima', 'Kelompok tani kami sudah mengisi formulir pengajuan bibit jagung tahap II pada Juli, tetapi sampai sekarang belum ada kabar.', 'bantuan-sosial', 'sedang', 'Kalimantan Barat', 'Kab. Sambas, Rantau Panjang', 33, 'selesai', 'web', ['telat' => true, 'rating' => 3, 'komentar' => 'Bibit sudah sampai, tapi agak lama prosesnya.', 'balas' => 'Bibit tahap II sudah dikirim melalui UPT dan diterima ketua kelompok tani.']],
            ['Data KK transmigran tidak sesuai di aplikasi', 'Nama istri dan jumlah anggota keluarga di data transmigran berbeda dengan KK terbaru. Takut berpengaruh ke bantuan.', 'layanan-data-tik', 'rendah', 'Jawa Tengah', 'Kab. Grobogan', 41, 'selesai', 'web', ['rating' => 4, 'balas' => 'Data keluarga sudah diperbarui sesuai KK terbaru yang Bapak kirim.']],
            ['Jalan usaha tani tergenang saat hujan', 'Jalan usaha tani menuju lahan II tergenang setinggi lutut setiap hujan sehingga hasil panen sulit diangkut.', 'infrastruktur-dasar', 'tinggi', 'Sumatera Selatan', 'Kab. Ogan Komering Ilir, Air Sugihan', 27, 'verifikasi', 'instagram', []],
            ['Sengketa batas lahan usaha dengan warga desa sekitar', 'Sebagian lahan usaha II kami diklaim warga desa sebelah. Sudah dua kali mediasi di kecamatan belum selesai.', 'tata-kelola-lahan', 'kritis', 'Jambi', 'Kab. Tebo, SP 4 Sungai Bengkal', 16, 'diproses', 'surat', ['balas' => 'Mediasi lanjutan dijadwalkan bersama BPN dan pemerintah desa. Petugas kami ikut mendampingi.']],
            ['Lampu jalan permukiman padam', 'Sebanyak 8 lampu jalan tenaga surya di permukiman padam sejak bulan lalu, malam hari sangat gelap.', 'infrastruktur-dasar', 'rendah', 'Lampung', 'Kab. Mesuji', 12, 'baru', 'web', []],
            ['Permohonan ikut program transmigrasi tahun depan', 'Saya ingin mendaftar program transmigrasi untuk tahun 2027. Bagaimana prosedur dan syaratnya?', 'layanan-data-tik', 'rendah', 'Jawa Timur', 'Kab. Bojonegoro', 6, 'ditolak', 'web', ['tolak' => 'Bukan pengaduan: pertanyaan pendaftaran sudah dijawab dan diarahkan ke Dinas Transmigrasi kabupaten.']],
            ['Pungutan liar saat pengurusan surat keterangan', 'Ada oknum yang meminta uang untuk mempercepat surat keterangan domisili transmigran.', 'tata-kelola-lahan', 'tinggi', 'Sulawesi Tengah', 'Kab. Morowali', 22, 'diproses', 'tatap_muka', ['rahasia' => true]],
            ['Rumah transmigran bocor sebelum serah terima', 'Atap rumah tipe 36 di jalur 2 bocor di beberapa titik, padahal belum diserahterimakan.', 'infrastruktur-dasar', 'sedang', 'Nusa Tenggara Timur', 'Kab. Kupang', 55, 'selesai', 'web', ['rating' => 5, 'balas' => 'Kontraktor sudah memperbaiki atap 12 unit rumah pada masa pemeliharaan.']],
            ['Jaminan hidup bulan September terlambat', 'Jaminan hidup (jadup) bulan September belum cair, biasanya tanggal 10 sudah diterima.', 'bantuan-sosial', 'tinggi', 'Maluku Utara', 'Kab. Halmahera Timur', 38, 'selesai', 'call_center', ['telat' => true, 'rating' => 2, 'komentar' => 'Cair tetapi terlambat hampir sebulan.', 'balas' => 'Jadup September sudah disalurkan pada 4 Oktober setelah verifikasi ulang data penerima.']],
            ['Klinik pembantu tidak ada tenaga kesehatan', 'Bangunan pustu di permukiman sudah ada, tetapi tidak ada bidan atau perawat yang bertugas.', 'bantuan-sosial', 'tinggi', 'Kalimantan Tengah', 'Kab. Kotawaringin Timur', 47, 'baru', 'facebook', []],
            ['Sinyal internet hilang di permukiman', 'Menara BTS di kawasan mati sejak badai dua pekan lalu sehingga warga tidak bisa mengakses layanan daring.', 'layanan-data-tik', 'sedang', 'Papua Selatan', 'Distrik Tanah Miring', 14, 'verifikasi', 'web', []],
            ['Lahan usaha II belum dibuka', 'Sudah tiga tahun menempati, lahan usaha II kami masih hutan dan belum dibuka sesuai janji.', 'tata-kelola-lahan', 'tinggi', 'Kalimantan Utara', 'Kab. Nunukan', 64, 'diproses', 'surat', ['balas' => 'Pembukaan lahan usaha II masuk usulan anggaran 2027; kami kabari bila sudah ditetapkan.']],
            ['Pupuk bersubsidi tidak sampai ke kelompok tani', 'Kuota pupuk kelompok tani kawasan transmigrasi tidak tersalurkan oleh kios resmi.', 'bantuan-sosial', 'sedang', 'Sumatera Selatan', 'Kab. Musi Rawas', 8, 'baru', 'web', ['anonim' => true]],
            ['Drainase permukiman tersumbat', 'Saluran drainase di jalur 4 tersumbat sedimen sehingga air meluap ke halaman rumah.', 'infrastruktur-dasar', 'rendah', 'Sulawesi Selatan', 'Kab. Luwu Utara', 3, 'baru', 'web', []],
            ['Nomor tiket lama tidak bisa dilacak', 'Saya pernah melapor lewat aplikasi lama, tetapi nomor tiketnya tidak ditemukan di halaman Lacak.', 'layanan-data-tik', 'rendah', 'DKI Jakarta', 'Jakarta Timur', 18, 'selesai', 'web', ['rating' => 4, 'balas' => 'Tiket lama Anda sudah kami temukan dan statusnya selesai; kami kirimkan nomor baru ke email Anda.']],
            ['Tanggul irigasi jebol', 'Tanggul saluran irigasi sekunder jebol sepanjang 5 meter, sawah 20 hektare terancam kekeringan.', 'infrastruktur-dasar', 'kritis', 'Lampung', 'Kab. Tulang Bawang', 11, 'diproses', 'call_center', ['balas' => 'Perbaikan darurat dengan karung pasir sudah dilakukan; perbaikan permanen dijadwalkan bulan depan.']],
            ['Bantuan sarana produksi perikanan tidak merata', 'Bantuan bibit ikan dan pakan hanya diterima sebagian anggota kelompok.', 'bantuan-sosial', 'sedang', 'Kalimantan Barat', 'Kab. Kubu Raya', 29, 'ditolak', 'instagram', ['tolak' => 'Di luar kewenangan: bantuan perikanan disalurkan Dinas Kelautan dan Perikanan kabupaten; laporan diteruskan ke dinas terkait.']],
            ['Gedung sekolah dasar retak', 'Dinding ruang kelas SD di kawasan retak besar setelah gempa kecil, orang tua khawatir.', 'infrastruktur-dasar', 'tinggi', 'Sulawesi Tengah', 'Kab. Sigi', 5, 'verifikasi', 'web', []],
            ['Perubahan nama penerima lahan karena kepala keluarga meninggal', 'Suami saya meninggal tahun lalu. Bagaimana mengalihkan nama penerima lahan ke saya sebagai ahli waris?', 'tata-kelola-lahan', 'sedang', 'Jambi', 'Kab. Merangin', 50, 'selesai', 'web', ['rating' => 5, 'komentar' => 'Dijelaskan dengan sabar, berkas sudah diproses.', 'balas' => 'Pengalihan hak sudah diproses dengan surat keterangan ahli waris dari desa.']],
            ['Pelatihan keterampilan dibatalkan tanpa pemberitahuan', 'Pelatihan menjahit untuk ibu-ibu transmigran dibatalkan mendadak padahal peserta sudah datang.', 'bantuan-sosial', 'rendah', 'Nusa Tenggara Barat', 'Kab. Sumbawa', 24, 'selesai', 'tatap_muka', ['rating' => 4, 'balas' => 'Pelatihan dijadwalkan ulang 2–4 Oktober; peserta dihubungi satu per satu.']],
            ['Jalan poros rusak berat', 'Jalan poros sepanjang 7 km rusak berat, truk pengangkut sawit sering terperosok.', 'infrastruktur-dasar', 'tinggi', 'Riau', 'Kab. Kampar', 2, 'baru', 'web', []],
            // Internal pegawai.
            ['Printer ruang layanan rusak', 'Printer di ruang layanan lantai 2 tidak bisa mencetak sejak Senin.', 'layanan-data-tik', 'rendah', null, 'Kantor Pusat, Lantai 2', 4, 'diproses', 'internal', []],
            ['Akses VPN pegawai sering terputus', 'VPN kantor terputus setiap 10 menit saat bekerja dari balai.', 'layanan-data-tik', 'sedang', null, 'BBPPMT Yogyakarta', 10, 'selesai', 'internal', []],
        ];
    }

    /** @param array<int, mixed> $t */
    private function createTicket(array $t, int $i, ?CarbonInterface $at = null): Ticket
    {
        [$title, $desc, $cat, $impactValue, $province, $location, $daysAgo, $statusValue, $kanal, $opt] = $t;
        $impact = TicketImpact::from($impactValue);
        $status = TicketStatus::from($statusValue);
        $internal = $kanal === 'internal';
        $created = $at ?? now()->subDays($daysAgo)->setTime(8 + ($i % 9), (13 * $i) % 60);
        $due = $this->sla->dueAt($impact, $created, $internal ? null : 14);
        $handler = $this->staff[$i % 2];
        $name = $this->names()[$i % count($this->names())];

        $ticket = new Ticket;
        $ticket->forceFill([
            'ticket_no' => $this->ticketNo($created),
            'title' => $title,
            'description' => $desc,
            'status' => $status,
            'priority' => $this->sla->priorityFor($impact),
            'impact' => $impact,
            'visibility' => ($opt['rahasia'] ?? false) ? TicketVisibility::Rahasia : (($opt['anonim'] ?? false) ? TicketVisibility::Anonim : TicketVisibility::Publik),
            'is_internal' => $internal,
            'category_id' => $this->categories[$cat],
            'province' => $province,
            'location' => $location,
            'reporter_name' => $internal ? "Pegawai {$name}" : $name,
            'reporter_nik' => $internal ? null : '32'.str_pad((string) (73010101900000 + $i * 7919), 14, '0', STR_PAD_LEFT),
            'reporter_email' => Str::slug($name, '.').'@contoh.test',
            'reporter_phone' => '0812'.str_pad((string) (55500000 + $i * 37), 8, '0', STR_PAD_LEFT),
            'reporter_nip' => $internal ? '19900101'.str_pad((string) $i, 10, '0', STR_PAD_LEFT) : null,
            'reporter_unit' => $internal ? 'Biro Umum' : null,
            'source' => in_array($kanal, ['web', 'internal', 'chat'], true) ? null : $kanal,
            'received_by' => in_array($kanal, ['web', 'internal', 'chat'], true) ? null : $handler->name,
            'assignee_id' => $status === TicketStatus::Baru ? null : $handler->id,
            'sla_due_at' => $due,
        ]);
        $ticket->created_at = $created;
        $ticket->updated_at = $created;
        $ticket->save();

        $this->history($ticket, null, TicketStatus::Baru, $created, null, 'Tiket diterima.');
        $steps = match ($status) {
            TicketStatus::Baru => [],
            TicketStatus::Verifikasi => [TicketStatus::Verifikasi],
            TicketStatus::Diproses => [TicketStatus::Verifikasi, TicketStatus::Diproses],
            TicketStatus::Selesai => [TicketStatus::Verifikasi, TicketStatus::Diproses, TicketStatus::Selesai],
            TicketStatus::Ditolak => [TicketStatus::Verifikasi, TicketStatus::Ditolak],
        };

        $from = TicketStatus::Baru;
        $time = $created->copy();
        foreach ($steps as $n => $step) {
            $previous = $time->copy();
            $time = $step === TicketStatus::Selesai
                ? (($opt['telat'] ?? false) ? $due->copy()->addDays(3)->setTime(14, 0) : $due->copy()->subDays(2)->setTime(10, 30))
                : $time->copy()->addHours($n === 0 ? 5 : 30);
            // Urutan waktu riwayat tetap maju.
            if ($time->lessThanOrEqualTo($previous)) {
                $time = $previous->copy()->addHours(2);
            }
            if ($time->isFuture()) {
                $time = now()->subHours(2);
            }
            $note = match ($step) {
                TicketStatus::Verifikasi => 'Data & lokasi dicek.',
                TicketStatus::Diproses => "Didisposisikan ke {$handler->name}.",
                TicketStatus::Selesai => 'Penanganan selesai.',
                TicketStatus::Ditolak => $opt['tolak'] ?? 'Ditolak.',
                default => null,
            };
            $this->history($ticket, $from, $step, $time, $handler, $note);
            $from = $step;
        }

        $ticket->forceFill([
            'responded_at' => $steps === [] ? null : $created->copy()->addHours(5),
            'resolved_at' => $status === TicketStatus::Selesai ? $time : null,
            'updated_at' => $time,
        ])->saveQuietly();

        if (isset($opt['balas'])) {
            $this->reply($ticket, $handler, $opt['balas'], true, $time->copy()->subMinutes(20));
        }
        if ($status === TicketStatus::Diproses && ! $internal) {
            $this->reply($ticket, $handler, 'Catatan internal: koordinasi dengan UPT setempat sudah dimulai.', false, $time->copy()->addHours(2));
        }
        if (isset($opt['rating'])) {
            $survey = new Survey(['ticket_id' => $ticket->id, 'rating' => $opt['rating'], 'comment' => $opt['komentar'] ?? null]);
            $survey->created_at = $time->copy()->addDay();
            $survey->updated_at = $survey->created_at;
            $survey->save();
        }

        return $ticket;
    }

    private function history(Ticket $ticket, ?TicketStatus $from, TicketStatus $to, CarbonInterface $at, ?User $actor, ?string $note): void
    {
        $h = new TicketHistory([
            'ticket_id' => $ticket->id,
            'from_status' => $from?->value,
            'to_status' => $to->value,
            'actor_id' => $actor?->id,
            'note' => $note,
        ]);
        $h->created_at = $at;
        $h->updated_at = $at;
        $h->save();
    }

    private function reply(Ticket $ticket, User $author, string $body, bool $public, CarbonInterface $at): void
    {
        $r = new TicketReply(['ticket_id' => $ticket->id, 'author_id' => $author->id, 'body' => $body, 'is_public' => $public]);
        $r->created_at = $at;
        $r->updated_at = $at;
        $r->save();
    }

    private function ticketNo(CarbonInterface $created): string
    {
        do {
            $no = 'TKT-'.Carbon::parse($created)->format('ymd').'-'.$this->randomCode(6);
        } while (Ticket::withTrashed()->where('ticket_no', $no)->exists());

        return $no;
    }

    /** Huruf/angka tanpa karakter ambigu (sama dengan nomor tiket). */
    private function randomCode(int $length): string
    {
        $code = '';
        for ($i = 0; $i < $length; $i++) {
            $code .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
        }

        return $code;
    }

    /** @return list<string> Nama rekaan (bukan orang nyata). */
    private function names(): array
    {
        return ['Sutrisno Wibowo', 'Maria Goreti Laka', 'Andi Baso Tenri', 'Yohanes Kambu', 'Siti Rohmah', 'Made Sudarsana', 'Rahmat Hidayat', 'Fransiska Wenda', 'Ahmad Fauzi', 'Lestari Handayani', 'Hendrikus Gebze', 'Nurhayati Lubis', 'Ketut Arsana', 'Paulus Mahuze', 'Dewi Kartika'];
    }

    /* ------------------------------------------------------ Percakapan */

    private function createConversations(): void
    {
        $article = KnowledgeArticle::query()->published()->orderBy('id')->first();
        $sumber = $article ? [['no' => 1, 'jenis' => 'artikel', 'id' => $article->id, 'judul' => $article->title, 'label' => $article->sourceLabel(), 'url' => $article->source_url]] : [];

        // 1–3. Terjawab TARA dari sumber resmi.
        foreach ([
            ['Wayan Sukerta', 'Bali', 'Kab. Jembrana', 'Apa saja syarat ikut program transmigrasi?', 'Syarat umum calon transmigran antara lain WNI, sudah berkeluarga, sehat jasmani dan rohani, serta terdaftar di Dinas Transmigrasi kabupaten asal [1].', 3],
            ['Rosmawati', 'Sulawesi Selatan', 'Kab. Luwu Timur', 'Bagaimana cara melacak tiket pengaduan saya?', 'Buka menu Lacak Tiket, lalu masukkan nomor tiket berformat TKT-YYMMDD-XXXXXX beserta kode akses yang dikirim ke email Anda [1].', 1],
            ['Hasan Basri', 'Kalimantan Selatan', null, 'Berapa lama pengaduan ditangani?', 'Lama penanganan mengikuti tingkat dampak sesuai Pedoman Layanan; status dan tenggatnya bisa dipantau di halaman Lacak Tiket [1].', 0],
        ] as $i => [$name, $prov, $loc, $q, $a, $daysAgo]) {
            $at = now()->subDays($daysAgo)->setTime(9 + $i, 15);
            $c = $this->conversation($name, $prov, $loc, $at, ['handled_by' => ChatConversation::HANDLED_AI, 'outcome' => 'terjawab_ai', 'closed_at' => $at->copy()->addMinutes(6)]);
            $this->message($c, 'guest', $q, $at);
            $this->message($c, 'ai', $a, $at->copy()->addSeconds(8), ['kind' => 'jawaban', 'sumber' => $sumber]);
            $this->message($c, 'guest', 'Baik, terima kasih.', $at->copy()->addMinutes(2));
        }

        // 4. Diteruskan ke petugas, masih menunggu (tampil di antrean Pesan Masuk).
        $at = now()->subHours(3);
        $c = $this->conversation('Yakobus Mahuze', 'Papua Selatan', 'Kab. Merauke, SP 9', $at, [
            'handled_by' => ChatConversation::HANDLED_STAFF, 'handoff_at' => $at->copy()->addMinutes(1), 'handoff_reason' => 'aduan',
            'ai_summary' => 'Warga SP 9 melaporkan jalan lingkungan amblas sehingga kendaraan tidak bisa lewat.', 'unread_admin' => 2,
        ]);
        $this->message($c, 'guest', 'Jalan lingkungan di SP 9 amblas sejak kemarin, motor tidak bisa lewat.', $at);
        $this->message($c, 'ai', 'Terima kasih sudah melapor. Aduan Anda saya ringkas dan teruskan ke petugas agar ditindaklanjuti.', $at->copy()->addSeconds(9), ['kind' => 'ringkasan']);
        $this->message($c, 'system', 'Percakapan diteruskan ke petugas.', $at->copy()->addMinutes(1), ['kind' => 'diteruskan']);

        // 5. Ditangani petugas lalu diterbitkan tiket.
        $at = now()->subDays(13)->setTime(10, 5);
        $ticket = $this->createTicket(['Pembagian sembako tidak merata di blok B', 'Warga blok B tidak menerima paket sembako yang dibagikan minggu lalu, padahal terdaftar.', 'bantuan-sosial', 'sedang', 'Jawa Barat', 'Kab. Garut', 13, 'diproses', 'chat', ['balas' => 'Daftar penerima blok B sedang dicocokkan dengan data desa.']], 40, $at->copy()->addMinutes(25));
        $c = $this->conversation('Asep Saepudin', 'Jawa Barat', 'Kab. Garut', $at, [
            'handled_by' => ChatConversation::HANDLED_STAFF, 'handoff_at' => $at->copy()->addMinutes(2), 'handoff_reason' => 'aduan',
            'assigned_to' => $this->staff[0]->id, 'outcome' => 'tiket', 'ticket_id' => $ticket->id, 'closed_at' => $at->copy()->addMinutes(26), 'closed_by' => $this->staff[0]->id,
        ]);
        $this->message($c, 'guest', 'Blok B tidak kebagian sembako minggu lalu, padahal nama kami terdaftar.', $at);
        $this->message($c, 'admin', 'Baik Pak Asep, saya catat. Saya terbitkan tiket agar bisa dipantau.', $at->copy()->addMinutes(20), [], $this->staff[0]);
        $this->message($c, 'system', "Tiket {$ticket->ticket_no} telah diterbitkan untuk laporan Anda.", $at->copy()->addMinutes(25), ['kind' => 'tiket_terbit', 'tiket' => ['nomor' => $ticket->ticket_no, 'url' => '/lacak/'.$ticket->ticket_no]]);

        // 6–7. Dirujuk ke portal: berhasil & butuh bantuan.
        $portal = Portal::query()->where('track_completion', true)->orderBy('sort')->first();
        if ($portal) {
            foreach ([['Marthen Kogoya', 'Papua', 'Kab. Jayapura', 9, Referral::STATUS_DONE], ['Sri Wahyuni', 'Kalimantan Timur', 'Kab. Paser', 1, Referral::STATUS_HELP]] as $j => [$name, $prov, $loc, $daysAgo, $status]) {
                $at = now()->subDays($daysAgo)->setTime(13, 10 + $j);
                $c = $this->conversation($name, $prov, $loc, $at, [
                    'handled_by' => ChatConversation::HANDLED_AI,
                    'outcome' => $status === Referral::STATUS_DONE ? 'rujuk_portal' : null,
                    'closed_at' => $status === Referral::STATUS_DONE ? $at->copy()->addDays(2) : null,
                ]);
                $this->message($c, 'guest', 'Saya mau mengurus sertifikat lahan transmigrasi, lewat mana ya?', $at);
                $this->message($c, 'ai', "Pengurusan ini dilayani lewat portal {$portal->name}. Saya buatkan rujukan dan pendamping akan memastikan Anda berhasil.", $at->copy()->addSeconds(10), ['kind' => 'rujukan']);
                $ref = Referral::create([
                    'token' => Str::random(48),
                    'code' => 'RJK-'.$at->format('ymd').'-'.$this->randomCode(4),
                    'portal_id' => $portal->id,
                    'conversation_id' => $c->id,
                    'citizen_name' => $name,
                    'summary' => 'Warga ingin mengurus sertifikat lahan transmigrasi.',
                    'status' => $status,
                    'assigned_to' => $this->staff[1]->id,
                    'opened_at' => $at->copy()->addMinutes(5),
                    'confirmed_at' => $status === Referral::STATUS_DONE ? $at->copy()->addDays(2) : null,
                    // Sama seperti ReferralService: rujukan berhasil = ditutup (KPI "Berhasil 30 hari" membaca closed_at).
                    'closed_at' => $status === Referral::STATUS_DONE ? $at->copy()->addDays(2) : null,
                    'follow_up_due_at' => $at->copy()->addDays(3),
                ]);
                $ref->forceFill(['created_at' => $at, 'updated_at' => $at])->saveQuietly();
                foreach (array_filter([
                    ['ai', 'dibuat', "Dirujuk ke {$portal->name}.", 0],
                    ['warga', 'dibuka', 'Warga membuka portal.', 5],
                    $status === Referral::STATUS_DONE ? ['petugas', 'berhasil', 'Bukti pendaftaran dari portal tercatat.', 2880] : ['warga', 'butuh_bantuan', 'Warga tidak menemukan menu unggah dokumen.', 60],
                ]) as [$actor, $type, $note, $minutes]) {
                    ReferralEvent::create(['referral_id' => $ref->id, 'actor' => $actor, 'type' => $type, 'note' => $note, 'created_at' => $at->copy()->addMinutes($minutes)]);
                }
            }
        }

        // 8. Pertanyaan kebijakan diarahkan ke PPID.
        $at = now()->subDays(5)->setTime(15, 40);
        $c = $this->conversation('Benny Tanoto', 'Riau', null, $at, ['handled_by' => ChatConversation::HANDLED_AI, 'outcome' => 'terjawab_ai', 'closed_at' => $at->copy()->addMinutes(3)]);
        $this->message($c, 'guest', 'Berapa anggaran transmigrasi tahun ini untuk provinsi Riau?', $at);
        $this->message($c, 'ai', 'Data anggaran rinci merupakan informasi publik yang dapat dimohonkan ke PPID Kementerian Transmigrasi.', $at->copy()->addSeconds(7), ['kind' => 'tidak_tahu', 'kebijakan' => true]);

        // 9. Diarahkan ke SP4N-LAPOR! (melibatkan instansi lain).
        $at = now()->subDays(8)->setTime(11, 0);
        $c = $this->conversation('Theresia Lewar', 'Maluku', 'Kab. Seram Bagian Timur', $at, ['handled_by' => ChatConversation::HANDLED_STAFF, 'handoff_at' => $at->copy()->addMinutes(1), 'handoff_reason' => 'aduan', 'assigned_to' => $this->staff[1]->id, 'outcome' => 'lapor', 'closed_at' => $at->copy()->addHours(1), 'closed_by' => $this->staff[1]->id]);
        $this->message($c, 'guest', 'Puskesmas di kecamatan kami kekurangan obat.', $at);
        $this->message($c, 'admin', 'Layanan puskesmas di bawah Dinas Kesehatan; silakan sampaikan melalui SP4N-LAPOR! agar diteruskan ke instansi berwenang.', $at->copy()->addMinutes(40), [], $this->staff[1]);
    }

    /** @param array<string, mixed> $extra */
    private function conversation(string $name, string $province, ?string $location, CarbonInterface $at, array $extra): ChatConversation
    {
        $c = new ChatConversation;
        $c->forceFill([
            'guest_token' => 'contoh-'.Str::random(24),
            'guest_name' => $name,
            'province' => $province,
            'location' => $location,
            'subject' => 'Live Chat (Tamu)',
            'last_message_at' => $at,
            'reference' => 'REF-'.Carbon::parse($at)->format('ymd').'-'.$this->randomCode(4),
            ...$extra,
        ]);
        $c->created_at = $at;
        $c->updated_at = $at;
        $c->save();

        return $c;
    }

    /** @param array<string, mixed> $meta */
    private function message(ChatConversation $c, string $sender, string $body, CarbonInterface $at, array $meta = [], ?User $author = null): void
    {
        $m = new ChatMessage(['conversation_id' => $c->id, 'sender_type' => $sender, 'sender_id' => $author?->id, 'body' => $body, 'meta' => $meta ?: null]);
        $m->created_at = $at;
        $m->updated_at = $at;
        $m->save();
        $c->forceFill(['last_message_at' => $at])->saveQuietly();
    }
}
