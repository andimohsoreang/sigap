<?php

namespace Tests\Feature\Web;

use App\Enums\UserRole;
use App\Jobs\SyncKnowledgeSource;
use App\Models\ChatConversation;
use App\Models\KnowledgeDocument;
use App\Models\KnowledgePassage;
use App\Models\KnowledgeSource;
use App\Models\Region;
use App\Models\User;
use App\Services\Ai\LlmClient;
use App\Services\Knowledge\KnowledgeRetriever;
use App\Services\Knowledge\OfficialWebFetcher;
use App\Services\Knowledge\SourceIngestor;
use Database\Seeders\MasterSeeder;
use Database\Seeders\OfficialSourceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;
use ZipArchive;

class KnowledgeSourceTest extends TestCase
{
    use RefreshDatabase;

    private const PAGE = 'https://sibarduktrans.transmigrasi.go.id/tataCaraBertransmigrasi';

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
        Storage::fake('local');
        $this->admin = User::factory()->admin(UserRole::SuperAdmin)->create();
    }

    private function html(string $main, string $nav = ''): string
    {
        return <<<HTML
            <html><head><title>SIBARDUKTRANS</title><script>var x = "jangan diambil";</script></head>
            <body>
              <nav class="navbar"><a href="/">Beranda</a><a href="/login">Masuk</a>{$nav}</nav>
              <main><h1>Tata Cara<span>Bertransmigrasi</span></h1>{$main}</main>
              <footer>Hak cipta Kementerian Transmigrasi. Hubungi kami di media sosial resmi kementerian.</footer>
            </body></html>
            HTML;
    }

    private function requirements(string $age = '19 - 53'): string
    {
        return '<h3>PERSYARATAN CALON TRANSMIGRAN</h3><ul>'
            .'<li>Warga Negara Republik Indonesia yang memiliki KTP-el;</li>'
            .'<li>Berkeluarga yang dibuktikan dengan Surat Nikah dan KK;</li>'
            ."<li>Berusia produktif, yaitu usia antara {$age} tahun;</li></ul>"
            .'<h3>PENDAFTARAN</h3><p>Pelayanan pendaftaran dilaksanakan di Kantor Desa/Kelurahan domisili pendaftar atau di dinas kabupaten/kota.</p>';
    }

    private function site(array $attributes = []): KnowledgeSource
    {
        return KnowledgeSource::create($attributes + [
            'kind' => KnowledgeSource::KIND_SITE,
            'name' => 'SIBARDUKTRANS — Tata Cara',
            'url' => self::PAGE,
        ]);
    }

    public function test_only_official_hosts_are_allowed(): void
    {
        $fetcher = app(OfficialWebFetcher::class);

        $this->assertTrue($fetcher->isAllowed('https://transmigrasi.go.id/'));
        $this->assertTrue($fetcher->isAllowed('https://ppid.transmigrasi.go.id/faq'));
        $this->assertTrue($fetcher->isAllowed('http://WWW.Transmigrasi.go.id/layanan/'));
        $this->assertFalse($fetcher->isAllowed('https://transmigrasi.go.id.evil.com/'));
        $this->assertFalse($fetcher->isAllowed('https://nottransmigrasi.go.id/'));
        $this->assertFalse($fetcher->isAllowed('https://user:pass@ppid.transmigrasi.go.id/'));
        $this->assertFalse($fetcher->isAllowed('https://ppid.transmigrasi.go.id:8080/'));
        $this->assertFalse($fetcher->isAllowed('file:///etc/passwd'));
        $this->assertFalse($fetcher->isAllowed('http://127.0.0.1/'));
    }

    public function test_site_is_split_into_passages_by_heading_without_menu_or_scripts(): void
    {
        Carbon::setTestNow('2026-10-27 09:00');
        Http::fake([self::PAGE => Http::response($this->html($this->requirements()), 200, ['Content-Type' => 'text/html; charset=utf-8'])]);

        $source = $this->site();
        app(SourceIngestor::class)->sync($source);
        $source->refresh();

        $this->assertSame('siap', $source->status);
        $this->assertSame(2, $source->passages_count);
        $passages = $source->passages()->get();
        $this->assertSame('PERSYARATAN CALON TRANSMIGRAN', $passages[0]->heading);
        $this->assertSame('Tata Cara Bertransmigrasi', $passages[0]->title);
        $this->assertStringContainsString('19 - 53 tahun', $passages[0]->body);
        $this->assertSame('PENDAFTARAN', $passages[1]->heading);

        $all = $passages->pluck('body')->implode(' ');
        $this->assertStringNotContainsString('jangan diambil', $all);
        $this->assertStringNotContainsString('Hak cipta', $all);
        $this->assertStringNotContainsString('Masuk', $all);

        $this->assertSame('sibarduktrans.transmigrasi.go.id · diambil 27 Okt 2026', $passages[0]->label());
        $this->assertSame(self::PAGE, $passages[0]->link());
        Carbon::setTestNow();
    }

    public function test_resync_replaces_passages_only_when_content_changes_and_keeps_them_on_failure(): void
    {
        Http::fakeSequence(self::PAGE)
            ->push($this->html($this->requirements()), 200, ['Content-Type' => 'text/html'])
            ->push($this->html($this->requirements()), 200, ['Content-Type' => 'text/html'])
            ->push($this->html($this->requirements('19 - 49')), 200, ['Content-Type' => 'text/html'])
            ->push('Server error', 500);

        $source = $this->site();
        $ingestor = app(SourceIngestor::class);

        $ingestor->sync($source);
        $firstIds = $source->passages()->pluck('id')->all();
        $changedAt = $source->fresh()->changed_at;

        $this->travel(1)->days();
        $ingestor->sync($source->fresh());
        $this->assertSame($firstIds, $source->passages()->pluck('id')->all(), 'isi sama → kutipan tidak diganti');
        $this->assertEquals($changedAt, $source->fresh()->changed_at);

        $this->travel(1)->days();
        $ingestor->sync($source->fresh());
        $this->assertNotEquals($firstIds, $source->passages()->pluck('id')->all());
        $this->assertStringContainsString('19 - 49', $source->passages()->first()->body);

        $ingestor->sync($source->fresh());
        $source->refresh();
        $this->assertSame('gagal', $source->status);
        $this->assertStringContainsString('500', (string) $source->error);
        $this->assertSame(2, $source->passages()->count(), 'kutipan terakhir tetap dipakai');
    }

    public function test_follow_links_stays_inside_official_section(): void
    {
        $nav = '<a href="/tataCaraBertransmigrasi/seleksi">Seleksi</a><a href="https://twitter.com/x">X</a>';
        Http::fake([
            self::PAGE => Http::response($this->html($this->requirements(), $nav).'<a href="/berkas/pedoman.docx">Pedoman</a>', 200, ['Content-Type' => 'text/html']),
            self::PAGE.'/seleksi' => Http::response($this->html('<h3>SELEKSI CALON</h3><p>Seleksi dilaksanakan oleh dinas kabupaten/kota terhadap calon transmigran yang sudah terdaftar.</p>'), 200, ['Content-Type' => 'text/html']),
            '*' => Http::response('tidak ditemukan', 404),
        ]);

        $source = $this->site(['follow_links' => true]);
        app(SourceIngestor::class)->sync($source);

        $urls = collect(Http::recorded())->map(fn ($pair) => (string) $pair[0]->url())->all();
        $this->assertContains(self::PAGE.'/seleksi', $urls);
        $this->assertNotContains('https://twitter.com/x', $urls);
        $this->assertNotContains('https://sibarduktrans.transmigrasi.go.id/login', $urls);
        $this->assertTrue(KnowledgePassage::query()->where('heading', 'SELEKSI CALON')->where('url', self::PAGE.'/seleksi')->exists());
        $this->assertSame('siap', $source->fresh()->status);
    }

    public function test_admin_adds_only_official_urls_and_fetch_is_queued(): void
    {
        Queue::fake();

        $this->actingAs($this->admin)
            ->post('/admin/pengetahuan/sumber', ['url' => 'https://contoh-hoaks.com/transmigrasi'])
            ->assertSessionHasErrors('url');

        $this->post('/admin/pengetahuan/sumber', ['url' => 'https://ppid.transmigrasi.go.id/faq', 'nama' => 'PPID — Tanya Jawab'])
            ->assertRedirect();
        $source = KnowledgeSource::query()->sole();
        $this->assertSame('PPID — Tanya Jawab', $source->name);
        Queue::assertPushed(SyncKnowledgeSource::class, fn ($job) => $job->source->is($source));

        $this->post('/admin/pengetahuan/sumber', ['url' => 'https://ppid.transmigrasi.go.id/faq'])->assertSessionHasErrors('url');

        $this->get("/admin/pengetahuan/sumber?sumber={$source->id}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/pengetahuan-sumber')
                ->where('selected.id', $source->id)
                ->has('sources', 1));

        $kawasan = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => Region::query()->value('id')]);
        $this->actingAs($kawasan)->delete("/admin/pengetahuan/sumber/{$source->id}")->assertForbidden();
        $this->actingAs($this->admin)->delete("/admin/pengetahuan/sumber/{$source->id}")->assertRedirect();
        $this->assertModelMissing($source);
    }

    public function test_assistant_cites_passage_with_quote_link_and_fetch_date(): void
    {
        config(['services.ai.enabled' => true, 'services.ai.driver' => 'fake']);
        Carbon::setTestNow(Carbon::parse('2026-10-27 10:00', 'Asia/Jakarta'));
        Http::fake([self::PAGE => Http::response($this->html($this->requirements()), 200, ['Content-Type' => 'text/html'])]);
        $source = $this->site();
        app(SourceIngestor::class)->sync($source);

        $this->postJson('/chat/mulai', ['nama' => 'Pak Darto'])->assertCreated();
        $response = $this->postJson('/chat/pesan', ['body' => 'Berapa batas usia calon transmigran?'])->assertCreated();

        $response->assertJsonPath('balasan.0.jenis', 'jawaban')
            ->assertJsonPath('balasan.0.sumber.0.no', 1)
            ->assertJsonPath('balasan.0.sumber.0.jenis', 'kutipan')
            ->assertJsonPath('balasan.0.sumber.0.url', self::PAGE)
            ->assertJsonPath('balasan.0.sumber.0.label', 'sibarduktrans.transmigrasi.go.id · diambil 27 Okt 2026');
        $this->assertStringContainsString('19 - 53 tahun', $response->json('balasan.0.sumber.0.kutipan'));
        $this->assertStringContainsString('19 - 53 tahun', $response->json('balasan.0.body'));
        $this->assertSame(1, $source->fresh()->used_count);
        $this->assertSame('ai', ChatConversation::query()->sole()->handled_by);
        Carbon::setTestNow();
    }

    /** Dua situs resmi dengan batas usia berbeda, siap dikutip. */
    private function twoConflictingSites(): void
    {
        Http::fake([
            self::PAGE => Http::response($this->html($this->requirements('19 - 53')), 200, ['Content-Type' => 'text/html']),
            'https://www.transmigrasi.go.id/layanan/persyaratan-transmigrasi/' => Http::response(
                $this->html('<h3>Syarat Mendaftar Sebagai Transmigran</h3><ul><li>WNI yang memiliki KTP;</li><li>Berusia produktif, yaitu usia antara 19 s/d 49 tahun sesuai KTP;</li><li>Berbadan sehat dibuktikan surat keterangan dokter.</li></ul>'),
                200,
                ['Content-Type' => 'text/html'],
            ),
        ]);
        // Sumber ketiga merayapi halaman yang sama dengan sumber pertama.
        foreach ([self::PAGE, 'https://www.transmigrasi.go.id/layanan/persyaratan-transmigrasi/', self::PAGE] as $i => $url) {
            app(SourceIngestor::class)->sync(KnowledgeSource::create(['kind' => 'situs', 'name' => "Sumber {$i}", 'url' => $url]));
        }
    }

    public function test_retriever_skips_duplicate_text_and_gives_each_source_a_turn(): void
    {
        $this->twoConflictingSites();

        $passages = app(KnowledgeRetriever::class)->passages('berapa batas usia ikut transmigrasi?');

        $this->assertSame($passages->count(), $passages->unique(fn ($p) => md5($p->body))->count(), 'teks sama tidak dikirim dua kali');
        $bodies = $passages->pluck('body')->implode(' ');
        $this->assertStringContainsString('19 - 53', $bodies);
        $this->assertStringContainsString('19 s/d 49', $bodies);
    }

    /**
     * Model palsu yang menjawab dua versi batas usia dan merekam pesan yang
     * dikirim kepadanya (untuk memeriksa label dasar hukum).
     *
     * @param  array<string, mixed>  $answer
     */
    private function conflictModel(array $answer): object
    {
        $model = new class implements LlmClient
        {
            public array $answer = [];

            /** @var list<string> label "dasar" tiap sumber yang dikirim ke model */
            public array $bases = [];

            public function complete(array $messages, bool $json = false): string
            {
                $this->bases = array_column(json_decode((string) end($messages)['content'], true)['sumber'] ?? [], 'dasar');

                return (string) json_encode($this->answer);
            }
        };
        $model->answer = $answer + ['jenis' => 'informasi', 'portal' => null, 'ringkasan' => ''];
        $this->app->instance(LlmClient::class, $model);

        return $model;
    }

    /** Beri label dasar hukum: sumber 19–53 berlaku, sumber 19–49 diganti. */
    private function labelConflictingSites(): void
    {
        KnowledgeSource::query()->where('url', self::PAGE)->update(['dasar_hukum' => 'Peraturan Baru 2/2024', 'tanggal_dasar' => '2024-03-01', 'status_dasar' => 'berlaku']);
        KnowledgeSource::query()->where('url', '!=', self::PAGE)->update(['dasar_hukum' => 'Peraturan Lama 11/2017', 'tanggal_dasar' => '2017-06-01', 'status_dasar' => 'diganti', 'diganti_oleh' => 'Peraturan Baru 2/2024']);
    }

    public function test_conflict_without_deciding_labels_shows_both_versions_then_hands_off(): void
    {
        config(['services.ai.enabled' => true]);
        Carbon::setTestNow(Carbon::parse('2026-10-27 10:00', 'Asia/Jakarta'));
        $this->twoConflictingSites();
        // Model hanya menandai beda sumber; label "belum diketahui" → sistem tetap meneruskan ke petugas.
        $model = $this->conflictModel(['jawaban' => 'Menurut SIBARDUKTRANS 19–53 tahun [1]. Menurut halaman Persyaratan 19–49 tahun [2].', 'sumber' => [1, 2], 'beda_sumber' => true, 'perlu_petugas' => false]);

        $this->postJson('/chat/mulai', ['nama' => 'Bu Sri'])->assertCreated();
        $reply = $this->postJson('/chat/pesan', ['body' => 'Berapa batas usia ikut transmigrasi?'])->assertCreated();

        $reply->assertJsonPath('balasan.0.jenis', 'jawaban')
            ->assertJsonPath('balasan.0.beda_sumber', true)
            ->assertJsonPath('balasan.0.sumber.0.no', 1)
            ->assertJsonPath('balasan.0.sumber.1.no', 2)
            ->assertJsonCount(2, 'balasan.0.sumber')
            ->assertJsonPath('balasan.1.jenis', 'sumber_berbeda');
        $this->assertSame(['Dasar: tidak dicatat — BELUM DIKETAHUI', 'Dasar: tidak dicatat — BELUM DIKETAHUI'], $model->bases);
        $conversation = ChatConversation::query()->sole();
        $this->assertSame(ChatConversation::HANDLED_STAFF, $conversation->handled_by);
        $this->assertSame('sumber_berbeda', $conversation->handoff_reason);
        Carbon::setTestNow();
    }

    public function test_conflict_flagged_by_model_hands_off_with_reason(): void
    {
        config(['services.ai.enabled' => true]);
        $this->twoConflictingSites();
        $this->conflictModel(['jawaban' => 'Menurut SIBARDUKTRANS 19–53 tahun [1]. Menurut halaman Persyaratan 19–49 tahun [2].', 'sumber' => [1, 2], 'beda_sumber' => true, 'perlu_petugas' => true, 'alasan_petugas' => 'sumber_berbeda']);

        $this->postJson('/chat/mulai', ['nama' => 'Bu Sri'])->assertCreated();
        $this->postJson('/chat/pesan', ['body' => 'Berapa batas usia ikut transmigrasi?'])
            ->assertCreated()
            ->assertJsonPath('balasan.0.jenis', 'jawaban')
            ->assertJsonPath('balasan.1.jenis', 'sumber_berbeda');

        $this->assertSame('sumber_berbeda', ChatConversation::query()->sole()->handoff_reason);
    }

    public function test_conflict_decided_by_labels_answers_with_current_rule_and_stays_with_assistant(): void
    {
        config(['services.ai.enabled' => true]);
        $this->twoConflictingSites();
        $this->labelConflictingSites();
        $model = $this->conflictModel(['jawaban' => 'Batas usia 19–53 tahun [1]. Ketentuan 19–49 tahun [2] adalah aturan lama yang sudah diganti.', 'sumber' => [1, 2], 'beda_sumber' => true, 'perlu_petugas' => false]);

        $this->postJson('/chat/mulai', ['nama' => 'Bu Sri'])->assertCreated();
        $reply = $this->postJson('/chat/pesan', ['body' => 'Berapa batas usia ikut transmigrasi?'])->assertCreated();

        $reply->assertJsonPath('balasan.0.jenis', 'jawaban')
            ->assertJsonPath('balasan.0.beda_sumber', true)
            ->assertJsonCount(1, 'balasan');
        $this->assertContains('Dasar: Peraturan Baru 2/2024 (2024) — BERLAKU', $model->bases);
        $this->assertContains('Dasar: Peraturan Lama 11/2017 (2017) — DIGANTI oleh Peraturan Baru 2/2024', $model->bases);
        $this->assertSame('ai', ChatConversation::query()->sole()->handled_by);
    }

    public function test_admin_sets_legal_basis_of_a_source_and_it_is_audited(): void
    {
        $source = $this->site();

        $this->actingAs($this->admin)->put("/admin/pengetahuan/sumber/{$source->id}", ['status_dasar' => 'diganti', 'dasar_hukum' => 'Peraturan Lama 11/2017'])
            ->assertSessionHasErrors(['diganti_oleh' => 'Isi peraturan pengganti bila status dasarnya "diganti".']);

        $this->actingAs($this->admin)->put("/admin/pengetahuan/sumber/{$source->id}", [
            'dasar_hukum' => 'Peraturan Lama 11/2017',
            'tanggal_dasar' => '2017-06-01',
            'status_dasar' => 'diganti',
            'diganti_oleh' => 'Peraturan Baru 2/2024',
        ])->assertSessionHasNoErrors();

        $source->refresh();
        $this->assertSame('Dasar: Peraturan Lama 11/2017 (2017) — DIGANTI oleh Peraturan Baru 2/2024', $source->legalBasisLabel());
        $this->assertTrue($source->is_active, 'sumber lama tetap aktif');
        $this->assertDatabaseHas('activity_logs', ['action' => 'knowledge.source_basis', 'subject_id' => (string) $source->id]);

        // Dasar hukum dapat dikosongkan lagi.
        $this->actingAs($this->admin)->put("/admin/pengetahuan/sumber/{$source->id}", ['dasar_hukum' => null, 'tanggal_dasar' => null, 'status_dasar' => 'belum_diketahui', 'diganti_oleh' => null])
            ->assertSessionHasNoErrors();
        $this->assertSame('Dasar: tidak dicatat — BELUM DIKETAHUI', $source->fresh()->legalBasisLabel());

        $this->actingAs($this->admin)->get("/admin/pengetahuan/sumber?sumber={$source->id}")
            ->assertInertia(fn (Assert $page) => $page->where('selected.status_dasar', 'belum_diketahui')->where('selected.dasar_hukum', null));
    }

    public function test_personal_question_still_shows_general_rule_then_hands_off(): void
    {
        config(['services.ai.enabled' => true]);
        Carbon::setTestNow(Carbon::parse('2026-10-27 10:00', 'Asia/Jakarta'));
        $this->twoConflictingSites();
        $this->app->bind(LlmClient::class, fn () => new class implements LlmClient
        {
            public function complete(array $messages, bool $json = false): string
            {
                return json_encode(['jenis' => 'pribadi', 'jawaban' => 'Ketentuan umumnya: usia 19–53 tahun [1].', 'sumber' => [1], 'beda_sumber' => true, 'portal' => null, 'perlu_petugas' => false, 'ringkasan' => 'Warga 50 tahun menanyakan kelayakan.']);
            }
        });

        $this->postJson('/chat/mulai', ['nama' => 'Pak Darto'])->assertCreated();
        $reply = $this->postJson('/chat/pesan', ['body' => 'Umur saya 50 tahun, masih bisa ikut?'])->assertCreated();

        $reply->assertJsonPath('balasan.0.jenis', 'jawaban')
            ->assertJsonPath('balasan.0.beda_sumber', false) // satu sumber dikutip → tidak ditandai
            ->assertJsonPath('balasan.1.jenis', 'pribadi');
        $this->assertStringContainsString('19–53', $reply->json('balasan.0.body'));
        $this->assertStringContainsString('kasus Anda', $reply->json('balasan.1.body'));
        $this->assertSame(ChatConversation::HANDLED_STAFF, ChatConversation::query()->sole()->handled_by);
        Carbon::setTestNow();
    }

    public function test_long_multi_aspect_question_gets_more_passages_from_several_sources(): void
    {
        // Tiap aspek pertanyaan dibahas situs resmi yang berbeda, ditambah kutipan yang tidak relevan.
        $pages = [
            'Arah Kebijakan' => ['Transmigrasi sebagai strategi pembangunan', 'Transmigrasi modern ditempatkan sebagai strategi pembangunan kawasan, bukan sekadar pemindahan penduduk.'],
            'Evaluasi Kinerja' => ['Evaluasi keberhasilan pembangunan kawasan', 'Keberhasilan pendekatan pembangunan kawasan transmigrasi dievaluasi melalui indikator kinerja kawasan.'],
            'Persebaran Penduduk' => ['Perubahan demografi dan urbanisasi', 'Perubahan demografi dan laju urbanisasi menjadi pertimbangan persebaran penduduk ke kawasan baru.'],
            'Pemerataan Wilayah' => ['Ketimpangan ekonomi antarwilayah', 'Ketimpangan ekonomi antarwilayah dikurangi melalui pusat pertumbuhan baru di kawasan transmigrasi.'],
            'Masyarakat Setempat' => ['Penghormatan hak masyarakat lokal', 'Penghormatan terhadap hak masyarakat lokal dijamin, termasuk melalui pola transmigrasi lokal.'],
            'Layanan' => ['Jam layanan kantor', 'Kantor pelayanan buka Senin sampai Jumat pukul 08.00 sampai 15.00.'],
        ];
        foreach ($pages as $name => [$heading, $body]) {
            $source = $this->site(['name' => $name, 'url' => 'https://www.transmigrasi.go.id/'.str($name)->slug(), 'status' => KnowledgeSource::STATUS_READY]);
            $source->passages()->create(['title' => $name, 'heading' => $heading, 'body' => $body, 'url' => $source->url]);
        }

        $retriever = app(KnowledgeRetriever::class);
        $question = 'Jika transmigrasi modern diklaim sebagai strategi pembangunan, bagaimana kementerian mengevaluasi keberhasilan pendekatan tersebut dalam konteks perubahan demografi, urbanisasi, ketimpangan ekonomi, serta tuntutan penghormatan terhadap hak masyarakat lokal?';

        $this->assertTrue($retriever->isLong($question));
        $this->assertGreaterThanOrEqual(3, count($retriever->segments($question)));

        $passages = $retriever->sources($question)->filter(fn ($s) => $s instanceof KnowledgePassage);
        $this->assertGreaterThan(3, $passages->count(), 'pertanyaan panjang mendapat lebih dari 3 kutipan');
        $this->assertSame($passages->count(), $passages->unique('knowledge_source_id')->count(), 'kutipan dari sumber berbeda diutamakan');
        $this->assertNotContains('Layanan', $passages->map(fn ($p) => $p->title)->all());

        // Pertanyaan pendek tetap paling banyak 3 kutipan.
        $this->assertLessThanOrEqual(3, $retriever->sources('strategi pembangunan kawasan transmigrasi')->count());
    }

    public function test_inactive_source_is_not_used(): void
    {
        Http::fake([self::PAGE => Http::response($this->html($this->requirements()), 200, ['Content-Type' => 'text/html'])]);
        $source = $this->site();
        app(SourceIngestor::class)->sync($source);
        $retriever = app(KnowledgeRetriever::class);

        $this->assertNotEmpty($retriever->passages('batas usia calon transmigran'));

        $this->actingAs($this->admin)->put("/admin/pengetahuan/sumber/{$source->id}", ['aktif' => false])->assertRedirect();
        $this->assertEmpty($retriever->passages('batas usia calon transmigran'));
    }

    public function test_uploaded_docx_becomes_citable_and_file_link_respects_setting(): void
    {
        $this->actingAs($this->admin)
            ->post('/admin/pengetahuan/dokumen', ['dokumen' => UploadedFile::fake()->createWithContent('SOP Pendaftaran.docx', $this->docx())])
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        $document = KnowledgeDocument::query()->sole();
        $this->assertTrue($document->isDocx());
        $source = $document->source;
        $this->assertSame('berkas', $source->kind);
        $this->assertSame('siap', $source->status);

        $passage = $source->passages()->firstOrFail();
        $this->assertSame('Syarat Pendaftaran', $passage->heading);
        $this->assertStringContainsString('Kartu Keluarga', $passage->body);
        $this->assertSame("/sumber/berkas/{$source->id}", $passage->link());

        auth()->logout();
        $this->get("/sumber/berkas/{$source->id}")->assertOk()->assertDownload();

        $source->forceFill(['public_file' => false])->save();
        $this->get("/sumber/berkas/{$source->id}")->assertNotFound();
        $this->assertNull($passage->fresh()->link());

        // Dokumen dihapus → kutipannya ikut hilang.
        $this->actingAs($this->admin)->delete("/admin/pengetahuan/dokumen/{$document->id}");
        $this->assertSame(0, KnowledgePassage::query()->count());
    }

    public function test_official_source_seeder_only_registers_allowed_sites(): void
    {
        $this->seed(OfficialSourceSeeder::class);
        $this->seed(OfficialSourceSeeder::class);

        $fetcher = app(OfficialWebFetcher::class);
        $sources = KnowledgeSource::all();
        $this->assertGreaterThanOrEqual(5, $sources->count());
        $this->assertSame($sources->count(), $sources->unique('url')->count());
        $sources->each(fn (KnowledgeSource $s) => $this->assertTrue($fetcher->isAllowed($s->url), $s->url));
    }

    /** DOCX minimal: satu judul (gaya Heading1) dan satu butir daftar. */
    private function docx(): string
    {
        $w = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
        $document = <<<XML
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <w:document {$w}><w:body>
              <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Syarat Pendaftaran</w:t></w:r></w:p>
              <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Membawa KTP-el dan Kartu Keluarga ke dinas kabupaten atau kota domisili.</w:t></w:r></w:p>
              <w:p><w:r><w:t>Pendaftaran tidak dipungut biaya apa pun dan dapat dilakukan pada hari kerja.</w:t></w:r></w:p>
            </w:body></w:document>
            XML;

        $path = tempnam(sys_get_temp_dir(), 'docx');
        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::OVERWRITE);
        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
        $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
        $zip->addFromString('word/document.xml', trim($document));
        $zip->close();
        $bytes = file_get_contents($path);
        @unlink($path);

        return $bytes;
    }
}
