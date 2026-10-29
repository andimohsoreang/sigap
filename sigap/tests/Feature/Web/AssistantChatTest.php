<?php

namespace Tests\Feature\Web;

use App\Enums\UserRole;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\KnowledgeArticle;
use App\Models\Referral;
use App\Models\Ticket;
use App\Models\User;
use App\Services\Ai\AiException;
use App\Services\Ai\FakeLlmClient;
use App\Services\Ai\LlmClient;
use App\Services\ChatService;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AssistantChatTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
        config(['services.ai.enabled' => true, 'services.ai.driver' => 'fake']);
        // Selasa 10.00 WIB = jam layanan.
        Carbon::setTestNow(Carbon::parse('2026-10-13 10:00', 'Asia/Jakarta'));

        KnowledgeArticle::create([
            'title' => 'Bagaimana cara mendaftar program transmigrasi?',
            'body' => 'Daftar di dinas kabupaten/kota yang membidangi transmigrasi dengan membawa KTP dan KK.',
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

    private function startGuest(): ChatConversation
    {
        $this->postJson('/chat/mulai', ['nama' => 'Siti Aminah'])->assertCreated();

        return ChatConversation::query()->latest('id')->firstOrFail();
    }

    private function ask(string $body): TestResponse
    {
        return $this->postJson('/chat/pesan', ['body' => $body])->assertCreated();
    }

    public function test_new_conversation_starts_with_assistant(): void
    {
        $conversation = $this->startGuest();

        $this->assertSame('ai', $conversation->handled_by);
        $this->getJson('/chat/pesan')->assertJsonPath('asisten.aktif', true)->assertJsonPath('asisten.mode', 'ai');
    }

    public function test_assistant_answers_from_published_article_with_source(): void
    {
        $conversation = $this->startGuest();

        $this->ask('Bagaimana cara daftar program transmigrasi?')
            ->assertJsonPath('balasan.0.sender_type', 'ai')
            ->assertJsonPath('balasan.0.jenis', 'jawaban')
            ->assertJsonPath('balasan.0.penulis', 'TARA')
            ->assertJsonPath('balasan.0.sumber.0.label', 'Pedoman Seleksi · Hal. 12')
            ->assertJsonPath('balasan.0.sumber.0.url', 'https://jdih.transmigrasi.go.id/web/regulations');

        // Ditangani AI → petugas tidak diberi badge.
        $this->assertSame(0, $conversation->fresh()->unread_admin);
        $this->assertSame(1, KnowledgeArticle::query()->value('used_count'));
    }

    public function test_question_about_complaint_procedure_is_not_treated_as_a_complaint(): void
    {
        KnowledgeArticle::create([
            'title' => 'Bagaimana cara melacak tiket pengaduan?',
            'body' => 'Masukkan nomor tiket di menu Lacak Tiket.',
            'status' => KnowledgeArticle::STATUS_PUBLISHED,
        ]);
        $this->startGuest();

        $this->ask('Bagaimana cara melacak tiket pengaduan saya?')
            ->assertJsonPath('balasan.0.jenis', 'jawaban')
            ->assertJsonPath('asisten.mode', 'ai');
    }

    public function test_assistant_says_it_does_not_know_and_logs_question(): void
    {
        $this->startGuest();

        $this->ask('Kapan pembagian bibit kakao di kawasan Bulungan?')
            ->assertJsonPath('balasan.0.jenis', 'tidak_tahu')
            ->assertJsonPath('asisten.mode', 'ai');

        $this->actingAs(User::factory()->admin(UserRole::SuperAdmin)->create())
            ->get('/admin/pengetahuan')
            ->assertInertia(fn (Assert $page) => $page->where('unanswered.0.question', 'Kapan pembagian bibit kakao di kawasan Bulungan?'));
    }

    public function test_complaint_is_summarised_and_handed_to_staff(): void
    {
        $conversation = $this->startGuest();

        $this->ask('Jalan poros SP3 rusak parah sudah 3 bulan')
            ->assertJsonPath('balasan.0.jenis', 'ringkasan')
            ->assertJsonPath('balasan.1.sender_type', 'system')
            ->assertJsonPath('balasan.1.jenis', 'diteruskan')
            ->assertJsonPath('asisten.mode', 'petugas');

        $conversation->refresh();
        $this->assertSame('petugas', $conversation->handled_by);
        $this->assertSame('aduan', $conversation->handoff_reason);
        $this->assertStringContainsString('Jalan poros SP3', (string) $conversation->ai_summary);
        $this->assertMatchesRegularExpression('/^REF-\d{6}-[A-Z0-9]{4}$/', (string) $conversation->reference);
        $this->assertSame(1, $conversation->unread_admin);

        // Setelah diteruskan, pesan warga masuk ke petugas; TARA hanya memberi tanda terima.
        $this->ask('Halo, ada petugas?')->assertJsonCount(1, 'balasan')->assertJsonPath('balasan.0.jenis', 'menunggu_petugas');
        $this->assertSame(2, $conversation->fresh()->unread_admin);
    }

    public function test_complaint_without_details_asks_for_them_before_referring_or_handing_off(): void
    {
        $conversation = $this->startGuest();

        // Tombol cepat "Lapor masalah": belum ada isi aduannya.
        $this->ask('Saya mau melapor masalah')
            ->assertJsonCount(1, 'balasan')
            ->assertJsonPath('balasan.0.jenis', 'tanya_detail')
            ->assertJsonPath('asisten.mode', 'ai');

        $conversation->refresh();
        $this->assertSame('ai', $conversation->handled_by);
        $this->assertSame(0, Referral::query()->count());

        // Setelah warga menjelaskan, aduan diringkas dan diteruskan seperti biasa.
        $this->ask('Jalan poros SP3 rusak parah sudah 3 bulan')->assertJsonPath('balasan.0.jenis', 'ringkasan');
        $this->assertSame('petugas', $conversation->fresh()->handled_by);
    }

    public function test_out_of_hours_handoff_asks_for_contact_and_stores_it_encrypted(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-17 21:00', 'Asia/Jakarta')); // Sabtu malam
        $conversation = $this->startGuest();

        $this->postJson('/chat/petugas')
            ->assertJsonPath('balasan.0.jenis', 'minta_kontak')
            ->assertJsonPath('asisten.butuh_kontak', true);

        $this->postJson('/chat/kontak', ['kontak' => 'bukan kontak'])->assertUnprocessable();
        $this->postJson('/chat/kontak', ['kontak' => '0812-3456-7890'])
            ->assertOk()
            ->assertJsonPath('balasan.0.jenis', 'kontak_tersimpan')
            ->assertJsonPath('asisten.butuh_kontak', false);

        $this->assertSame('0812-3456-7890', $conversation->fresh()->contact);
        $this->assertNotSame('0812-3456-7890', DB::table('chat_conversations')->value('contact'));
    }

    public function test_explicit_handoff_is_idempotent(): void
    {
        $conversation = $this->startGuest();

        $this->postJson('/chat/petugas')->assertJsonPath('balasan.0.jenis', 'diteruskan');
        $this->postJson('/chat/petugas')->assertJsonCount(0, 'balasan');

        $this->assertSame('diminta', $conversation->fresh()->handoff_reason);
        $this->assertSame(1, ChatMessage::query()->where('sender_type', 'system')->count());
    }

    public function test_ticket_number_returns_public_status_but_hides_internal_tickets(): void
    {
        $this->startGuest();
        $ticket = Ticket::factory()->create();
        $internal = Ticket::factory()->internal()->create();

        $this->ask("Cek tiket {$ticket->ticket_no}")
            ->assertJsonPath('balasan.0.jenis', 'status_tiket')
            ->assertJsonPath('balasan.0.tiket.nomor', $ticket->ticket_no)
            ->assertJsonPath('balasan.0.tiket.status_label', 'Menunggu');

        $this->ask("status {$internal->ticket_no}")
            ->assertJsonPath('balasan.0.jenis', 'info')
            ->assertJsonMissingPath('balasan.0.tiket.nomor');
    }

    public function test_ai_failure_hands_conversation_to_staff(): void
    {
        $this->app->bind(LlmClient::class, fn () => new class implements LlmClient
        {
            public function complete(array $messages, bool $json = false): string
            {
                throw new AiException('mati');
            }
        });
        $conversation = $this->startGuest();

        $this->ask('Bagaimana cara daftar program transmigrasi?')
            ->assertJsonPath('balasan.0.jenis', 'info')
            ->assertJsonPath('balasan.1.jenis', 'diteruskan');

        $this->assertSame('ai_gagal', $conversation->fresh()->handoff_reason);
    }

    public function test_personal_data_is_masked_before_reaching_the_model(): void
    {
        $spy = new class extends FakeLlmClient
        {
            public array $sent = [];

            public function complete(array $messages, bool $json = false): string
            {
                $this->sent[] = $messages;

                return parent::complete($messages, $json);
            }
        };
        $this->app->instance(LlmClient::class, $spy);
        $this->startGuest();

        $this->ask('NIK saya 3201234567890123, HP 081234567890, cara daftar transmigrasi?');

        $payload = json_encode($spy->sent);
        $this->assertStringNotContainsString('3201234567890123', $payload);
        $this->assertStringNotContainsString('081234567890', $payload);
        $this->assertStringContainsString('[NIK]', $payload);

        // Pesan asli tetap tersimpan utuh di SIGAP.
        $this->assertDatabaseHas('chat_messages', ['sender_type' => 'guest', 'body' => 'NIK saya 3201234567890123, HP 081234567890, cara daftar transmigrasi?']);
    }

    public function test_answer_citing_unknown_source_is_rejected(): void
    {
        $this->app->bind(LlmClient::class, fn () => new class implements LlmClient
        {
            public function complete(array $messages, bool $json = false): string
            {
                return '{"jenis":"informasi","jawaban":"Jawaban karangan [9]","sumber":[9],"perlu_petugas":false,"ringkasan":""}';
            }
        });
        $this->startGuest();

        $this->ask('Bagaimana cara daftar program transmigrasi?')->assertJsonPath('balasan.0.jenis', 'tidak_tahu');
    }

    /** Model tiruan yang selalu menandai pertanyaan sebagai pertanyaan kebijakan. */
    private function policyModel(string $type, string $answer, array $sources): void
    {
        $this->app->bind(LlmClient::class, fn () => new class($type, $answer, $sources) implements LlmClient
        {
            public function __construct(private string $type, private string $answer, private array $sources) {}

            public function complete(array $messages, bool $json = false): string
            {
                return json_encode(['jenis' => $this->type, 'jawaban' => $this->answer, 'sumber' => $this->sources, 'beda_sumber' => false, 'kebijakan' => true, 'portal' => null, 'perlu_petugas' => false, 'ringkasan' => '']);
            }
        });
    }

    public function test_policy_question_is_answered_from_sources_with_ppid_note_without_handoff(): void
    {
        KnowledgeArticle::create([
            'title' => 'Apa tujuan program transmigrasi?',
            'body' => 'Transmigrasi diselenggarakan untuk meningkatkan kesejahteraan dan mendorong pemerataan pembangunan daerah.',
            'category' => 'Program',
            'status' => KnowledgeArticle::STATUS_PUBLISHED,
        ]);
        // Model keliru menandai "hak individu" sebagai urusan pribadi; tetap dijawab sebagai informasi.
        $this->policyModel('pribadi', 'Tujuan program: kesejahteraan dan pemerataan pembangunan [1]. Data evaluasi belum tersedia di sumber resmi yang saya miliki. Untuk data kinerja, ajukan permohonan informasi ke PPID.', [1]);
        $conversation = $this->startGuest();

        $this->ask('Atas dasar apa program transmigrasi dibenarkan untuk pemerataan pembangunan dan kesejahteraan dibanding hak individu memilih tempat tinggal?')
            ->assertJsonCount(1, 'balasan')
            ->assertJsonPath('balasan.0.jenis', 'jawaban')
            ->assertJsonPath('balasan.0.kebijakan', true)
            ->assertJsonPath('balasan.0.sumber.0.no', 1)
            ->assertJsonPath('asisten.mode', 'ai');

        $conversation->refresh();
        $this->assertSame('ai', $conversation->handled_by);
        $this->assertNull($conversation->handoff_reason);
        $this->assertTrue(ChatMessage::query()->where('sender_type', 'ai')->sole()->meta['kebijakan']);
    }

    public function test_policy_question_without_sources_points_to_ppid_instead_of_plain_unknown(): void
    {
        $this->policyModel('informasi', '', []);
        $conversation = $this->startGuest();

        $reply = $this->ask('Bagaimana kementerian menentukan keseimbangan antara kepentingan nasional untuk membuka pusat-pusat pertumbuhan ekonomi baru dan hak individu maupun keluarga untuk menentukan tempat tinggal, pekerjaan, serta masa depan mereka secara bebas?')
            ->assertJsonCount(1, 'balasan')
            ->assertJsonPath('balasan.0.jenis', 'tidak_tahu')
            ->assertJsonPath('balasan.0.kebijakan', true)
            ->assertJsonPath('asisten.mode', 'ai');

        $this->assertStringContainsString('PPID', $reply->json('balasan.0.body'));
        $this->assertSame('ai', $conversation->fresh()->handled_by);
    }

    /** Model tiruan dengan balasan JSON tetap (kunci yang tidak diisi = bawaan). */
    private function fixedModel(array $reply): void
    {
        $json = json_encode($reply + ['jawaban' => '', 'sumber' => [], 'beda_sumber' => false, 'kebijakan' => false, 'portal' => null, 'perlu_petugas' => false, 'kompleks' => false, 'ringkasan' => '']);
        $this->app->bind(LlmClient::class, fn () => new class($json) implements LlmClient
        {
            public function __construct(private string $json) {}

            public function complete(array $messages, bool $json = false): string
            {
                return $this->json;
            }
        });
    }

    public function test_complaint_flagged_for_staff_by_model_still_goes_through_complaint_flow(): void
    {
        $this->fixedModel(['jenis' => 'aduan', 'perlu_petugas' => true, 'ringkasan' => 'Jalan poros SP3 rusak sejak 3 bulan.']);
        $conversation = $this->startGuest();

        $this->ask('Jalan poros SP3 rusak parah sudah 3 bulan')
            ->assertJsonPath('balasan.0.jenis', 'ringkasan')
            ->assertJsonPath('balasan.1.jenis', 'diteruskan');

        $this->assertSame('aduan', $conversation->fresh()->handoff_reason);
    }

    public function test_complaint_with_regulation_question_shows_sourced_answer_before_summary(): void
    {
        $this->fixedModel(['jenis' => 'aduan', 'jawaban' => 'Pendaftaran dilakukan di dinas kabupaten/kota [1].', 'sumber' => [1], 'ringkasan' => 'Warga ditolak saat mendaftar program transmigrasi.']);
        $conversation = $this->startGuest();

        $this->ask('Saya ditolak dinas saat mau daftar program transmigrasi, sebenarnya daftar di mana?')
            ->assertJsonPath('balasan.0.jenis', 'jawaban')
            ->assertJsonPath('balasan.0.sumber.0.no', 1)
            ->assertJsonPath('balasan.1.jenis', 'ringkasan')
            ->assertJsonPath('asisten.mode', 'petugas');

        $this->assertSame('aduan', $conversation->fresh()->handoff_reason);
    }

    public function test_complex_regulation_question_is_answered_then_handed_to_staff(): void
    {
        $this->fixedModel(['jenis' => 'informasi', 'jawaban' => 'Pendaftaran dilakukan di dinas kabupaten/kota [1].', 'sumber' => [1], 'kompleks' => true, 'ringkasan' => 'Warga kota tanpa dinas transmigrasi menanyakan jalur daftar program transmigrasi.']);
        $conversation = $this->startGuest();

        $this->ask('Kota saya tidak punya dinas transmigrasi, bagaimana aturan daftar program transmigrasi untuk kasus seperti ini?')
            ->assertJsonPath('balasan.0.jenis', 'jawaban')
            ->assertJsonPath('balasan.1.jenis', 'kompleks')
            ->assertJsonPath('balasan.2.jenis', 'diteruskan')
            ->assertJsonPath('asisten.mode', 'petugas');

        $conversation->refresh();
        $this->assertSame('kompleks', $conversation->handoff_reason);
        $this->assertStringContainsString('tanpa dinas transmigrasi', (string) $conversation->ai_summary);
    }

    public function test_simple_regulation_question_stays_with_assistant(): void
    {
        $this->fixedModel(['jenis' => 'informasi', 'jawaban' => 'Pendaftaran dilakukan di dinas kabupaten/kota [1].', 'sumber' => [1]]);
        $conversation = $this->startGuest();

        $this->ask('Bagaimana cara daftar program transmigrasi?')
            ->assertJsonCount(1, 'balasan')
            ->assertJsonPath('balasan.0.jenis', 'jawaban')
            ->assertJsonPath('asisten.mode', 'ai');

        $this->assertSame('ai', $conversation->fresh()->handled_by);
    }

    public function test_general_question_is_answered_while_waiting_for_first_staff_reply(): void
    {
        $conversation = $this->startGuest();
        $this->ask('Jalan poros SP3 rusak parah sudah 3 bulan')->assertJsonPath('asisten.mode', 'petugas');

        // Pertanyaan umum bersumber tetap dijawab; penghitung petugas tetap naik.
        $this->ask('Bagaimana cara daftar program transmigrasi?')
            ->assertJsonCount(1, 'balasan')
            ->assertJsonPath('balasan.0.jenis', 'jawaban')
            ->assertJsonPath('asisten.mode', 'petugas');
        $this->assertSame(2, $conversation->fresh()->unread_admin);

        // Pesan yang tidak bisa dijawab diberi satu tanda terima, tidak diulang.
        $this->ask('Jembatan SP3 juga ambruk sejak minggu lalu')
            ->assertJsonCount(1, 'balasan')
            ->assertJsonPath('balasan.0.jenis', 'menunggu_petugas');
        $this->ask('Baik, terima kasih')->assertJsonCount(0, 'balasan');
        $this->assertSame(4, $conversation->fresh()->unread_admin);

        // Selama petugas aktif membalas, TARA tidak ikut menjawab.
        $this->actingAs(User::factory()->admin(UserRole::SuperAdmin)->create());
        app(ChatService::class)->send($conversation->fresh(), 'Halo, saya petugas.', 'admin', auth()->id());
        auth()->logout();
        $this->ask('Bagaimana cara daftar program transmigrasi?')->assertJsonCount(0, 'balasan');
        $this->assertSame('guest', $conversation->messages()->getQuery()->reorder('id', 'desc')->value('sender_type'));

        // Balasan petugas yang sudah lama (mis. percakapan lama yang dibuka lagi) tidak membungkam TARA.
        Carbon::setTestNow(now()->addMinutes(31));
        $this->ask('Bagaimana cara daftar program transmigrasi?')
            ->assertJsonCount(1, 'balasan')
            ->assertJsonPath('balasan.0.jenis', 'jawaban');
    }

    public function test_complaint_is_never_downgraded_to_policy_question(): void
    {
        $this->policyModel('aduan', '', []);
        $this->startGuest();

        $this->ask('Jalan poros SP3 rusak parah sudah 3 bulan, kebijakan transmigrasi gagal')
            ->assertJsonPath('balasan.0.jenis', 'ringkasan')
            ->assertJsonPath('balasan.0.kebijakan', false)
            ->assertJsonPath('asisten.mode', 'petugas');
    }

    public function test_feedback_updates_article_stats_once_and_only_for_own_answers(): void
    {
        $this->startGuest();
        $answerId = $this->ask('Bagaimana cara daftar program transmigrasi?')->json('balasan.0.id');

        $this->postJson("/chat/pesan/{$answerId}/nilai", ['membantu' => true])->assertOk()->assertJsonPath('message.nilai', 1);
        $this->postJson("/chat/pesan/{$answerId}/nilai", ['membantu' => false])->assertOk()->assertJsonPath('message.nilai', 1);
        $this->assertSame(1, KnowledgeArticle::query()->value('helpful_count'));
        $this->assertSame(0, KnowledgeArticle::query()->value('unhelpful_count'));

        // Pengunjung lain tidak dapat menilai pesan percakapan ini.
        $this->flushSession();
        $this->postJson('/chat/mulai', ['nama' => 'Orang Lain'])->assertCreated();
        $this->postJson("/chat/pesan/{$answerId}/nilai", ['membantu' => false])->assertNotFound();
    }

    public function test_closed_conversation_reopens_with_assistant(): void
    {
        $conversation = $this->startGuest();
        $conversation->forceFill(['handled_by' => 'petugas', 'outcome' => 'terjawab_petugas', 'closed_at' => now(), 'reference' => 'REF-261013-ABCD'])->save();

        $this->ask('Bagaimana cara daftar program transmigrasi?')->assertJsonPath('balasan.0.jenis', 'jawaban');

        $conversation->refresh();
        $this->assertSame('ai', $conversation->handled_by);
        $this->assertNull($conversation->outcome);
        $this->assertNull($conversation->reference);
    }

    public function test_disabled_assistant_keeps_classic_live_chat(): void
    {
        config(['services.ai.enabled' => false]);
        $conversation = $this->startGuest();

        $this->ask('Bagaimana cara daftar program transmigrasi?')->assertJsonCount(0, 'balasan');

        $this->assertSame('petugas', $conversation->fresh()->handled_by);
        $this->assertSame(1, $conversation->fresh()->unread_admin);
    }
}
