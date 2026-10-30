<?php

namespace Tests\Feature\Assistant;

use App\Enums\UserRole;
use App\Models\ChatConversation;
use App\Models\KnowledgeArticle;
use App\Models\Portal;
use App\Models\User;
use App\Services\Ai\AiException;
use App\Services\Ai\LlmClient;
use Database\Seeders\MasterSeeder;
use Database\Seeders\PortalSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Tes rekaman (golden) balasan TARA — pengunci Tahap 3 PRD-AI (Asisten dipecah).
 *
 * Satu skenario per cabang balasan: jenis, teks persis, urutan, meta penting,
 * dan status percakapan direkam di golden/replies.json dari kode sebelum
 * refaktor. Refaktor wajib menghasilkan rekaman yang identik. Rekam ulang
 * (GOLDEN_RECORD=1) HANYA bila perubahan perilaku memang disetujui pemilik.
 */
class ReplyGoldenTest extends TestCase
{
    use RefreshDatabase;

    private const FIXTURE = __DIR__.'/golden/replies.json';

    /** @var array<string, mixed> */
    private static array $recorded = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([MasterSeeder::class, PortalSeeder::class]);
        config(['services.ai.enabled' => true]);
        // Selasa 10.00 WIB = jam layanan.
        Carbon::setTestNow(Carbon::parse('2026-10-13 10:00', 'Asia/Jakarta'));
        User::factory()->admin(UserRole::SuperAdmin)->create(['name' => 'Rina Petugas']);

        KnowledgeArticle::create([
            'title' => 'Bagaimana cara mendaftar program transmigrasi?',
            'body' => 'Daftar di dinas kabupaten/kota yang membidangi transmigrasi dengan membawa KTP dan KK. Usia 19 - 53 tahun.',
            'category' => 'Program',
            'source' => 'Pedoman Seleksi',
            'source_ref' => 'Hal. 12',
            'source_url' => 'https://jdih.transmigrasi.go.id/web/regulations',
            'status' => KnowledgeArticle::STATUS_PUBLISHED,
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public static function tearDownAfterClass(): void
    {
        if (getenv('GOLDEN_RECORD') === '1' && self::$recorded !== []) {
            $all = is_file(self::FIXTURE) ? json_decode((string) file_get_contents(self::FIXTURE), true) : [];
            $all = array_merge($all, self::$recorded);
            ksort($all);
            @mkdir(dirname(self::FIXTURE), 0777, true);
            file_put_contents(self::FIXTURE, json_encode($all, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)."\n");
        }
        parent::tearDownAfterClass();
    }

    /** Model palsu: satu jawaban JSON tetap, atau galat bila $answer === null. */
    private function model(?array $answer): void
    {
        $this->app->bind(LlmClient::class, fn () => new class($answer) implements LlmClient
        {
            public function __construct(private ?array $answer) {}

            public function complete(array $messages, bool $json = false): string
            {
                if ($this->answer === null) {
                    throw new AiException('mati', 'koneksi');
                }

                return (string) json_encode($this->answer + [
                    'jenis' => 'informasi', 'jawaban' => '', 'sumber' => [], 'beda_sumber' => false, 'kebijakan' => false,
                    'portal' => null, 'perlu_petugas' => false, 'alasan_petugas' => null, 'kompleks' => false, 'ringkasan' => '',
                ]);
            }
        });
    }

    /**
     * Kirim pesan sebagai tamu (percakapan baru bila belum ada) dan rekam/cek.
     *
     * @param  list<string>  $messages  pesan warga berurutan; yang direkam balasan pesan terakhir
     */
    private function golden(string $name, array $messages): void
    {
        if (ChatConversation::query()->doesntExist()) {
            $this->postJson('/chat/mulai', ['nama' => 'Siti Aminah'])->assertCreated();
        }
        $reply = null;
        foreach ($messages as $body) {
            $reply = $this->postJson('/chat/pesan', ['body' => $body])->assertCreated();
        }
        $conversation = ChatConversation::query()->latest('id')->firstOrFail();

        $actual = [
            'balasan' => array_map(fn (array $m) => array_filter([
                'dari' => $m['sender_type'],
                'jenis' => $m['jenis'],
                'teks' => self::normalise($m['body']),
                'sumber' => array_map(fn (array $s) => [$s['no'], $s['jenis'], $s['judul'], $s['label'] ?? null], $m['sumber']),
                'beda_sumber' => $m['beda_sumber'] ?: null,
                'kebijakan' => $m['kebijakan'] ?: null,
                'portal' => $m['portal']['kode'] ?? null,
                'rujukan' => $m['rujukan'] !== null ? ['pendamping' => $m['rujukan']['pendamping'] ?? null] : null,
                'referensi' => $m['referensi'] !== null ? 'ada' : null,
                'tiket' => $m['tiket']['nomor'] ?? null,
            ], fn ($v) => $v !== null && $v !== []), $reply->json('balasan')),
            'percakapan' => [
                'ditangani' => $conversation->handled_by,
                'alasan' => $conversation->handoff_reason,
                'ringkasan' => $conversation->ai_summary === null ? null : self::normalise($conversation->ai_summary),
            ],
        ];

        if (getenv('GOLDEN_RECORD') === '1') {
            self::$recorded[$name] = $actual;
            $this->assertTrue(true);

            return;
        }

        $fixture = json_decode((string) file_get_contents(self::FIXTURE), true);
        $this->assertArrayHasKey($name, $fixture, "Skenario {$name} belum direkam.");
        $this->assertSame($fixture[$name], json_decode((string) json_encode($actual), true), "Balasan berubah: {$name}");
    }

    private static function normalise(string $text): string
    {
        return (string) preg_replace(['/REF-\d{6}-[A-Z0-9]{4}/', '/RJK-\d{6}-[A-Z0-9]{4}/'], ['REF-<…>', 'RJK-<…>'], $text);
    }

    private function secondArticle(array $basis = []): void
    {
        KnowledgeArticle::create($basis + [
            'title' => 'Berapa batas usia mendaftar program transmigrasi?',
            'body' => 'Batas usia mendaftar program transmigrasi 19 s/d 49 tahun.',
            'status' => KnowledgeArticle::STATUS_PUBLISHED,
        ]);
    }

    public function test_informasi_bersumber(): void
    {
        $this->model(['jawaban' => 'Daftar di dinas kabupaten/kota [1].', 'sumber' => [1]]);
        $this->golden('informasi_bersumber', ['Bagaimana cara daftar program transmigrasi?']);
    }

    public function test_informasi_tanpa_sumber(): void
    {
        $this->model([]);
        $this->golden('informasi_tanpa_sumber', ['Bagaimana cara daftar program transmigrasi?']);
    }

    public function test_kebijakan_tanpa_sumber(): void
    {
        $this->model(['kebijakan' => true]);
        $this->golden('kebijakan_tanpa_sumber', ['Bagaimana kementerian membuktikan program transmigrasi berhasil?']);
    }

    public function test_kebijakan_bersumber(): void
    {
        $this->model(['kebijakan' => true, 'jawaban' => 'Pendaftaran di dinas kabupaten/kota [1].', 'sumber' => [1]]);
        $this->golden('kebijakan_bersumber', ['Bagaimana cara daftar program transmigrasi?']);
    }

    public function test_portal_tanpa_sumber(): void
    {
        $this->model(['portal' => 'ppid']);
        $this->golden('portal_tanpa_sumber', ['Saya mau minta salinan dokumen resmi kementerian']);
    }

    public function test_informasi_dengan_portal_bersumber(): void
    {
        $this->model(['jawaban' => 'Daftar di dinas kabupaten/kota [1].', 'sumber' => [1], 'portal' => 'sibarduktrans']);
        $this->golden('informasi_dengan_portal_bersumber', ['Bagaimana cara daftar program transmigrasi?']);
    }

    public function test_diminta_petugas_jam_layanan(): void
    {
        $this->model(['perlu_petugas' => true, 'alasan_petugas' => 'diminta', 'ringkasan' => 'Warga minta bicara dengan petugas.']);
        $this->golden('diminta_petugas_jam_layanan', ['Saya mau bicara dengan petugas saja']);
    }

    public function test_diminta_petugas_di_luar_jam(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-17 21:00', 'Asia/Jakarta'));
        $this->model(['perlu_petugas' => true, 'alasan_petugas' => 'diminta']);
        $this->golden('diminta_petugas_di_luar_jam', ['Saya mau bicara dengan petugas saja']);
    }

    public function test_aduan_kurang_detail(): void
    {
        $this->model(['jenis' => 'aduan']);
        $this->golden('aduan_kurang_detail', ['mau lapor']);
    }

    public function test_aduan_bersumber(): void
    {
        $this->model(['jenis' => 'aduan', 'jawaban' => 'Pendaftaran di dinas kabupaten/kota [1].', 'sumber' => [1], 'ringkasan' => 'Warga ditolak dinas saat mendaftar.']);
        $this->golden('aduan_bersumber', ['Saya ditolak dinas saat mau daftar program transmigrasi, sebenarnya daftar di mana?']);
    }

    public function test_aduan_tanpa_sumber(): void
    {
        $this->model(['jenis' => 'aduan', 'ringkasan' => 'Jalan poros SP1 rusak sejak Juli.']);
        $this->golden('aduan_tanpa_sumber', ['Jalan poros di kawasan SP1 rusak parah sejak Juli, mohon ditindaklanjuti']);
    }

    public function test_aduan_dirujuk_portal(): void
    {
        $this->model(['jenis' => 'aduan', 'portal' => 'trans-tuntas', 'ringkasan' => 'Lahan usaha diserobot perusahaan.']);
        $this->golden('aduan_dirujuk_portal', ['Lahan usaha saya diserobot perusahaan sawit, mohon dibantu']);
    }

    public function test_aduan_dirujuk_portal_bersumber(): void
    {
        $this->model(['jenis' => 'aduan', 'portal' => 'sibarduktrans', 'jawaban' => 'Pendaftaran di dinas kabupaten/kota [1].', 'sumber' => [1], 'ringkasan' => 'Warga gagal mendaftar daring.']);
        $this->golden('aduan_dirujuk_portal_bersumber', ['Bagaimana cara daftar program transmigrasi? Saya gagal terus.']);
    }

    public function test_aduan_portal_gangguan(): void
    {
        Portal::query()->where('code', 'trans-tuntas')->update(['is_reachable' => false]);
        $this->model(['jenis' => 'aduan', 'portal' => 'trans-tuntas', 'ringkasan' => 'Lahan usaha diserobot perusahaan.']);
        $this->golden('aduan_portal_gangguan', ['Lahan usaha saya diserobot perusahaan sawit, mohon dibantu']);
    }

    public function test_aduan_portal_rujukan_kedua(): void
    {
        $this->model(['jenis' => 'aduan', 'portal' => 'trans-tuntas', 'ringkasan' => 'Lahan usaha diserobot perusahaan.']);
        $this->golden('aduan_portal_rujukan_kedua', [
            'Lahan usaha saya diserobot perusahaan sawit, mohon dibantu',
            'Formulir Trans Tuntas tidak bisa dikirim, lahan saya masih diserobot',
        ]);
    }

    public function test_pribadi_bersumber(): void
    {
        $this->model(['jenis' => 'pribadi', 'jawaban' => 'Ketentuan umumnya usia 19 - 53 tahun [1].', 'sumber' => [1], 'ringkasan' => 'Warga 50 tahun menanyakan kelayakan.']);
        $this->golden('pribadi_bersumber', ['Umur saya 50 tahun, masih bisa ikut program transmigrasi?']);
    }

    public function test_pribadi_tanpa_sumber(): void
    {
        $this->model(['jenis' => 'pribadi', 'ringkasan' => 'Warga menanyakan bantuan untuk keluarganya.']);
        $this->golden('pribadi_tanpa_sumber', ['Apakah keluarga saya berhak dapat bantuan bulan ini?']);
    }

    public function test_kompleks(): void
    {
        $this->model(['kompleks' => true, 'jawaban' => 'Pendaftaran di dinas kabupaten/kota [1].', 'sumber' => [1], 'ringkasan' => 'Kota tanpa dinas transmigrasi.']);
        $this->golden('kompleks', ['Kota saya tidak punya dinas transmigrasi, bagaimana aturan daftar program transmigrasi?']);
    }

    public function test_tidak_jelas(): void
    {
        $this->model(['jenis' => 'tidak_jelas']);
        $this->golden('tidak_jelas', ['asdkj qwe zxc']);
    }

    public function test_lainnya_dengan_jawaban(): void
    {
        $this->model(['jenis' => 'lainnya', 'jawaban' => 'Halo, saya TARA. Ada yang bisa saya bantu?']);
        $this->golden('lainnya_dengan_jawaban', ['halo']);
    }

    public function test_lainnya_tanpa_jawaban(): void
    {
        $this->model(['jenis' => 'lainnya']);
        $this->golden('lainnya_tanpa_jawaban', ['siapa juara piala dunia?']);
    }

    public function test_ai_gagal(): void
    {
        $this->model(null);
        $this->golden('ai_gagal', ['Bagaimana cara daftar program transmigrasi?']);
    }

    public function test_angka_tanpa_dasar_informasi(): void
    {
        $this->model(['jawaban' => 'Usia 19 - 49 tahun [1].', 'sumber' => [1]]);
        $this->golden('angka_tanpa_dasar_informasi', ['Bagaimana cara daftar program transmigrasi?']);
    }

    public function test_angka_tanpa_dasar_aduan(): void
    {
        $this->model(['jenis' => 'aduan', 'jawaban' => 'Usia 19 - 49 tahun [1].', 'sumber' => [1], 'ringkasan' => 'Warga ditolak karena usia.']);
        $this->golden('angka_tanpa_dasar_aduan', ['Saya ditolak dinas saat mau daftar program transmigrasi karena usia']);
    }

    public function test_sumber_berbeda_belum_diputuskan(): void
    {
        $this->secondArticle();
        $this->model(['jawaban' => 'Menurut sumber [1] dan sumber [2] ketentuannya berbeda.', 'sumber' => [1, 2], 'beda_sumber' => true]);
        $this->golden('sumber_berbeda_belum_diputuskan', ['Berapa usia untuk daftar program transmigrasi?']);
    }

    public function test_sumber_berbeda_diputuskan_label(): void
    {
        KnowledgeArticle::query()->update(['status_dasar' => 'berlaku', 'dasar_hukum' => 'Peraturan Baru']);
        $this->secondArticle(['status_dasar' => 'diganti', 'dasar_hukum' => 'Peraturan Lama', 'diganti_oleh' => 'Peraturan Baru']);
        $this->model(['jawaban' => 'Ketentuan yang berlaku ada di sumber [1]; ketentuan di sumber [2] adalah aturan lama yang sudah diganti.', 'sumber' => [1, 2], 'beda_sumber' => true]);
        $this->golden('sumber_berbeda_diputuskan_label', ['Berapa usia untuk daftar program transmigrasi?']);
    }

    public function test_status_tiket_tidak_ditemukan(): void
    {
        $this->model([]);
        $this->golden('status_tiket_tidak_ditemukan', ['cek TKT-261012-ABCDEF']);
    }

    public function test_menunggu_petugas_dijawab(): void
    {
        $this->model(['perlu_petugas' => true, 'alasan_petugas' => 'diminta']);
        $this->postJson('/chat/mulai', ['nama' => 'Siti Aminah'])->assertCreated();
        $this->postJson('/chat/pesan', ['body' => 'Saya mau bicara dengan petugas saja'])->assertCreated();
        $this->model(['jawaban' => 'Daftar di dinas kabupaten/kota [1].', 'sumber' => [1]]);
        $this->golden('menunggu_petugas_dijawab', ['Sambil menunggu, bagaimana cara daftar program transmigrasi?']);
    }

    public function test_menunggu_petugas_tanda_terima(): void
    {
        $this->model(['perlu_petugas' => true, 'alasan_petugas' => 'diminta']);
        $this->postJson('/chat/mulai', ['nama' => 'Siti Aminah'])->assertCreated();
        $this->postJson('/chat/pesan', ['body' => 'Saya mau bicara dengan petugas saja'])->assertCreated();
        $this->golden('menunggu_petugas_tanda_terima', ['baik']);
    }

    public function test_menunggu_petugas_angka_tanpa_dasar(): void
    {
        $this->model(['perlu_petugas' => true, 'alasan_petugas' => 'diminta']);
        $this->postJson('/chat/mulai', ['nama' => 'Siti Aminah'])->assertCreated();
        $this->postJson('/chat/pesan', ['body' => 'Saya mau bicara dengan petugas saja'])->assertCreated();
        $this->model(['jawaban' => 'Usia 19 - 49 tahun [1].', 'sumber' => [1]]);
        $this->golden('menunggu_petugas_angka_tanpa_dasar', ['Sambil menunggu, berapa batas usia daftar program transmigrasi?']);
    }

    public function test_ai_mati_tanpa_balasan(): void
    {
        config(['services.ai.enabled' => false]);
        $this->model([]);
        $this->golden('ai_mati_tanpa_balasan', ['Bagaimana cara daftar program transmigrasi?']);
    }
}
