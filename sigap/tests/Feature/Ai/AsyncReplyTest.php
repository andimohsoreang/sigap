<?php

namespace Tests\Feature\Ai;

use App\Enums\UserRole;
use App\Events\ChatMessageSent;
use App\Jobs\RespondToMessage;
use App\Models\AiCall;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\KnowledgeArticle;
use App\Models\Referral;
use App\Models\User;
use App\Services\Ai\AssistantService;
use App\Services\Ai\LlmClient;
use App\Services\ChatService;
use Database\Seeders\MasterSeeder;
use Database\Seeders\PortalSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\TimeoutExceededException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Sleep;
use RuntimeException;
use Tests\TestCase;

/**
 * PRD-AI Tahap 2 — jawaban asinkron (FR-AI-04, §10 "Asinkron").
 */
class AsyncReplyTest extends TestCase
{
    use RefreshDatabase;

    private const QUESTION = 'Bagaimana cara daftar program transmigrasi?';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([MasterSeeder::class, PortalSeeder::class]);
        config(['services.ai.enabled' => true, 'services.ai.driver' => 'fake', 'services.ai.async' => true]);
        // Selasa 10.00 WIB = jam layanan.
        Carbon::setTestNow(Carbon::parse('2026-10-13 10:00', 'Asia/Jakarta'));
        KnowledgeArticle::create([
            'title' => 'Bagaimana cara mendaftar program transmigrasi?',
            'body' => 'Daftar di dinas kabupaten/kota yang membidangi transmigrasi dengan membawa KTP dan KK.',
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

    private function lastCitizenMessage(): ChatMessage
    {
        return ChatMessage::query()->whereIn('sender_type', ['user', 'guest'])->latest('id')->firstOrFail();
    }

    private function runJob(ChatMessage $message): void
    {
        (new RespondToMessage($message->conversation_id, $message->id))->handle(app(AssistantService::class));
    }

    /** @return int jumlah pesan TARA (ai) di percakapan */
    private function aiReplies(ChatConversation $conversation): int
    {
        return $conversation->messages()->getQuery()->where('sender_type', 'ai')->count();
    }

    public function test_message_is_accepted_immediately_and_the_reply_is_queued_on_ai(): void
    {
        Queue::fake();
        $model = new class implements LlmClient
        {
            public int $calls = 0;

            public function complete(array $messages, bool $json = false): string
            {
                $this->calls++;
                usleep(2_000_000);

                return '{}';
            }
        };
        $this->app->instance(LlmClient::class, $model);
        $conversation = $this->startGuest();

        $started = microtime(true);
        $this->postJson('/chat/pesan', ['body' => self::QUESTION])
            ->assertCreated()
            ->assertJsonCount(0, 'balasan')
            ->assertJsonPath('asisten.mengetik', true)
            ->assertJsonPath('asisten.mode', 'ai');
        $elapsedMs = (microtime(true) - $started) * 1000;

        $this->assertSame(0, $model->calls, 'POST /chat/pesan tidak menunggu model.');
        $this->assertLessThan(300, $elapsedMs, 'Pesan diterima < 300 ms tanpa model (PRD-AI NFR).');
        $this->assertNotNull($conversation->fresh()->ai_pending_at);
        Queue::assertPushedOn('ai', RespondToMessage::class, fn (RespondToMessage $job) => $job->messageId === $this->lastCitizenMessage()->id);
    }

    public function test_job_sends_the_reply_through_chat_service_and_clears_typing(): void
    {
        Queue::fake();
        $conversation = $this->startGuest();
        $this->postJson('/chat/pesan', ['body' => self::QUESTION])->assertJsonPath('asisten.mengetik', true);
        $this->getJson('/chat/pesan')->assertJsonPath('asisten.mengetik', true);

        Event::fake([ChatMessageSent::class]);
        $this->runJob($this->lastCitizenMessage());

        Event::assertDispatched(ChatMessageSent::class, fn (ChatMessageSent $e) => $e->message->sender_type === 'ai');
        $this->assertSame('jawaban', $conversation->messages()->getQuery()->where('sender_type', 'ai')->sole()->meta['kind']);
        $this->getJson('/chat/pesan')->assertJsonPath('asisten.mengetik', false);
        $this->assertNull($conversation->fresh()->ai_pending_at);
    }

    public function test_job_is_idempotent_per_message(): void
    {
        Queue::fake();
        $conversation = $this->startGuest();
        $this->postJson('/chat/pesan', ['body' => self::QUESTION]);
        $message = $this->lastCitizenMessage();
        $conversation->forceFill(['ai_pending_at' => now()])->save();

        $this->runJob($message);
        $conversation->forceFill(['ai_pending_at' => now()])->save();
        $this->runJob($message);

        $this->assertSame(1, $this->aiReplies($conversation));
        $this->assertSame((string) $message->id, (new RespondToMessage($conversation->id, $message->id))->uniqueId());
    }

    public function test_jobs_are_serialized_per_conversation_on_the_ai_queue(): void
    {
        $job = new RespondToMessage(12, 34);

        $this->assertSame('ai', $job->queue);
        $middleware = $job->middleware();
        $this->assertInstanceOf(WithoutOverlapping::class, $middleware[0]);
        $this->assertSame('percakapan:12', $middleware[0]->key);
        $this->assertSame(1, $job->maxExceptions);
    }

    public function test_older_message_is_skipped_and_the_newest_is_answered(): void
    {
        Queue::fake();
        $conversation = $this->startGuest();
        $this->postJson('/chat/pesan', ['body' => 'Saya mau tanya soal transmigrasi']);
        $older = $this->lastCitizenMessage();
        $this->postJson('/chat/pesan', ['body' => self::QUESTION]);
        $newer = $this->lastCitizenMessage();

        $this->runJob($older);
        $this->assertSame(0, $this->aiReplies($conversation), 'Pesan lama dilewati.');
        $this->assertNotNull($conversation->fresh()->ai_pending_at, 'Masih menunggu jawaban pesan terbaru.');

        $this->runJob($newer);
        $this->assertSame(1, $this->aiReplies($conversation));
        $this->assertNull($conversation->fresh()->ai_pending_at);
    }

    public function test_job_is_skipped_when_staff_took_over(): void
    {
        Queue::fake();
        $conversation = $this->startGuest();
        $this->postJson('/chat/pesan', ['body' => self::QUESTION]);
        $admin = User::factory()->admin(UserRole::SuperAdmin)->create();
        app(ChatService::class)->takeOver($conversation->fresh(), $admin->id);

        $this->runJob($this->lastCitizenMessage());

        $this->assertSame(0, $this->aiReplies($conversation));
        $this->assertNull($conversation->fresh()->ai_pending_at);
    }

    public function test_failed_job_hands_conversation_to_staff(): void
    {
        Queue::fake();
        $conversation = $this->startGuest();
        $this->postJson('/chat/pesan', ['body' => self::QUESTION]);

        (new RespondToMessage($conversation->id, $this->lastCitizenMessage()->id))->failed(new RuntimeException('worker mati'));

        $conversation->refresh();
        $this->assertSame('petugas', $conversation->handled_by);
        $this->assertSame('ai_gagal', $conversation->handoff_reason);
        $this->assertNull($conversation->ai_pending_at);
        $this->assertTrue($conversation->messages()->getQuery()->where('body', 'Maaf, asisten sedang tidak dapat menjawab. Pesan Anda kami teruskan ke petugas.')->exists());
    }

    public function test_provider_time_budget_fits_inside_the_job_timeout(): void
    {
        $job = new RespondToMessage(1, 1);
        $providerTimeout = (int) config('services.ai.timeout');
        $maxRetryPauseSeconds = 0.8;

        $this->assertSame(25, $providerTimeout, 'AI_TIMEOUT bawaan 25 dtk.');
        $this->assertTrue($job->failOnTimeout, 'Job yang dihentikan karena timeout harus memanggil failed().');
        $this->assertLessThan($job->timeout, 2 * $providerTimeout + $maxRetryPauseSeconds, 'Dua percobaan + jeda harus selesai sebelum job dihentikan.');
        $this->assertGreaterThan($job->timeout, (int) config('services.ai.pending_timeout'), 'ai-macet hanya cadangan setelah failed().');
    }

    public function test_job_killed_by_timeout_hands_over_immediately_via_failed(): void
    {
        Queue::fake();
        $conversation = $this->startGuest();
        $this->postJson('/chat/pesan', ['body' => self::QUESTION])->assertJsonPath('asisten.mengetik', true);
        $message = $this->lastCitizenMessage();

        // Worker menghentikan job yang melewati $timeout; dengan failOnTimeout ia memanggil failed().
        (new RespondToMessage($conversation->id, $message->id))->failed(new TimeoutExceededException('RespondToMessage has timed out.'));

        $conversation->refresh();
        $this->assertSame('ai_gagal', $conversation->handoff_reason);
        $this->assertTrue($conversation->handoff_at->equalTo(now()), 'Diserahkan saat itu juga, bukan menunggu ai-macet.');
        $this->assertNull($conversation->ai_pending_at);
        $this->getJson('/chat/pesan')
            ->assertJsonPath('asisten.mengetik', false)
            ->assertJsonPath('asisten.mode', 'petugas');
        $this->assertTrue($conversation->messages()->getQuery()->where('body', 'Maaf, asisten sedang tidak dapat menjawab. Pesan Anda kami teruskan ke petugas.')->exists());

        $this->artisan('sigap:ai-macet')->expectsOutputToContain('0 percakapan macet')->assertSuccessful();
    }

    public function test_hanging_provider_times_out_twice_then_citizen_gets_ai_gagal(): void
    {
        Queue::fake();
        Sleep::fake();
        config(['services.ai.driver' => 'openai', 'services.ai.base_url' => 'https://ai.contoh.test/v1']);
        Http::fake(fn () => throw new ConnectionException('cURL error 28: Operation timed out after 25001 milliseconds'));
        $conversation = $this->startGuest();
        $this->postJson('/chat/pesan', ['body' => self::QUESTION]);

        $this->runJob($this->lastCitizenMessage());

        $conversation->refresh();
        $this->assertSame('ai_gagal', $conversation->handoff_reason);
        $this->assertNull($conversation->ai_pending_at);
        // Dua percobaan (coba ulang sekali), keduanya habis waktu.
        $this->assertSame(['timeout', 'timeout'], AiCall::query()->orderBy('id')->pluck('status')->all());
        Sleep::assertSleptTimes(1);
    }

    public function test_stuck_pending_reply_is_handed_to_staff_by_the_scheduler(): void
    {
        Queue::fake();
        $stuck = $this->startGuest();
        $this->postJson('/chat/pesan', ['body' => self::QUESTION]);
        $stuck->forceFill(['ai_pending_at' => now()->subMinutes(2)])->save();

        $this->artisan('sigap:ai-macet')->assertSuccessful();

        $stuck->refresh();
        $this->assertNull($stuck->ai_pending_at);
        $this->assertSame('ai_gagal', $stuck->handoff_reason);

        // Bila worker pulih belakangan, job lama tidak menjawab lagi.
        $this->runJob($this->lastCitizenMessage());
        $this->assertSame(0, $this->aiReplies($stuck));
    }

    public function test_recent_pending_reply_is_left_alone(): void
    {
        Queue::fake();
        $conversation = $this->startGuest();
        $this->postJson('/chat/pesan', ['body' => self::QUESTION]);
        $conversation->forceFill(['ai_pending_at' => now()->subSeconds(10)])->save();

        $this->artisan('sigap:ai-macet')->assertSuccessful();

        $this->assertNotNull($conversation->fresh()->ai_pending_at);
        $this->assertSame('ai', $conversation->fresh()->handled_by);
    }

    // --- Jalur cepat tetap sinkron (tanpa model, tanpa antrean) ----------

    public function test_ticket_number_is_answered_synchronously(): void
    {
        Queue::fake();
        $this->startGuest();

        $this->postJson('/chat/pesan', ['body' => 'Cek status TKT-261012-ABC123'])
            ->assertJsonCount(1, 'balasan')
            ->assertJsonPath('asisten.mengetik', false);

        Queue::assertNotPushed(RespondToMessage::class);
    }

    public function test_referral_code_is_captured_synchronously(): void
    {
        config(['services.ai.async' => false]);
        $this->startGuest();
        $this->postJson('/chat/pesan', ['body' => 'Lahan saya diserobot orang, sengketa batas lahan di SP2'])->assertCreated();
        $referral = Referral::query()->latest('id')->firstOrFail();

        config(['services.ai.async' => true]);
        Queue::fake();
        $this->postJson('/chat/pesan', ['body' => 'kodenya tt-2026-00777'])
            ->assertJsonCount(1, 'balasan')
            ->assertJsonPath('balasan.0.referensi', $referral->code);

        Queue::assertNotPushed(RespondToMessage::class);
    }

    public function test_conversation_held_by_active_staff_gets_no_ai_and_no_queue(): void
    {
        Queue::fake();
        $conversation = $this->startGuest();
        $admin = User::factory()->admin(UserRole::SuperAdmin)->create();
        $chat = app(ChatService::class);
        $chat->takeOver($conversation, $admin->id);
        $chat->send($conversation->fresh(), 'Halo, saya petugas.', 'admin', $admin->id);

        $this->postJson('/chat/pesan', ['body' => self::QUESTION])
            ->assertJsonCount(0, 'balasan')
            ->assertJsonPath('asisten.mengetik', false);

        Queue::assertNotPushed(RespondToMessage::class);
    }

    public function test_short_reply_while_waiting_for_staff_stays_synchronous(): void
    {
        config(['services.ai.async' => false]);
        $conversation = $this->startGuest();
        $this->postJson('/chat/pesan', ['body' => 'Jalan poros SP3 rusak parah sudah 3 bulan'])->assertJsonPath('asisten.mode', 'petugas');

        config(['services.ai.async' => true]);
        Queue::fake();
        $this->postJson('/chat/pesan', ['body' => 'Baik, terima kasih'])->assertJsonPath('asisten.mengetik', false);

        Queue::assertNotPushed(RespondToMessage::class);
        $this->assertNull($conversation->fresh()->ai_pending_at);
    }

    public function test_async_off_keeps_the_old_synchronous_reply(): void
    {
        config(['services.ai.async' => false]);
        Queue::fake();
        $this->startGuest();

        $this->postJson('/chat/pesan', ['body' => self::QUESTION])
            ->assertJsonPath('balasan.0.jenis', 'jawaban')
            ->assertJsonPath('asisten.mengetik', false);

        Queue::assertNotPushed(RespondToMessage::class);
    }

    public function test_with_a_sync_queue_the_reply_arrives_in_the_same_request(): void
    {
        // Mis. lingkungan tanpa worker terpisah (QUEUE_CONNECTION=sync): event → job langsung jalan.
        $conversation = $this->startGuest();

        $this->postJson('/chat/pesan', ['body' => self::QUESTION])->assertCreated()->assertJsonPath('asisten.mengetik', false);

        $this->assertSame(1, $this->aiReplies($conversation));
    }
}
