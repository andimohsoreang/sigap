<?php

namespace Tests\Feature\Web;

use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Events\NotificationBroadcast;
use App\Mail\ReporterTicketMail;
use App\Models\Ticket;
use App\Models\User;
use App\Support\SurveyQuestionnaire;
use Database\Seeders\MasterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Survei Kepuasan Pasca-Penanganan Pengaduan (kuesioner skala 1–4). */
class SurveyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(MasterSeeder::class);
    }

    public function test_public_survey_is_stored_with_skm_index(): void
    {
        $ticket = Ticket::factory()->create(['ticket_no' => 'TKT-500', 'status' => TicketStatus::Selesai]);
        $payload = $this->surveyPayload(3, [
            'jawaban' => ['kemudahan' => 4, 'konfirmasi' => 4, 'respons' => 3, 'penyelesaian' => 2, 'informasi' => 3, 'kesesuaian' => 3, 'sikap' => 4, 'kompetensi' => 3, 'kerahasiaan' => 4],
            'baik' => 'Petugas ramah.',
            'perbaikan' => 'Waktu penyelesaian lebih cepat.',
            'usia' => '30-39',
            'pekerjaan' => 'petani',
        ]);

        $this->post('/lacak/survei', ['ticket' => 'TKT-500', 'kode' => $ticket->lookup_token] + $payload)
            ->assertRedirect('/lacak/TKT-500?kode='.$ticket->lookup_token)
            ->assertSessionHas('success');

        $survey = $ticket->survey()->firstOrFail();
        $this->assertSame(SurveyQuestionnaire::VERSION, $survey->version);
        $this->assertSame(2, $survey->answers['penyelesaian']);
        // (4+4+3+2+3+3+4+3+4) / 9 × 25 = 83,33 → mutu B.
        $this->assertSame('83.33', $survey->skm_index);
        $this->assertSame('B', SurveyQuestionnaire::grade((float) $survey->skm_index)['huruf']);
        $this->assertSame('Petugas ramah.', $survey->good_feedback);
        $this->assertSame('petani', $survey->occupation);
        $this->assertNull($ticket->fresh()->review_requested_at);
    }

    public function test_grade_bands_follow_skm_guideline(): void
    {
        $this->assertSame('A', SurveyQuestionnaire::grade(88.31)['huruf']);
        $this->assertSame('B', SurveyQuestionnaire::grade(88.30)['huruf']);
        $this->assertSame('C', SurveyQuestionnaire::grade(65.00)['huruf']);
        $this->assertSame('D', SurveyQuestionnaire::grade(64.99)['huruf']);
        $this->assertSame(100.0, SurveyQuestionnaire::index(array_fill_keys(array_keys(SurveyQuestionnaire::ASPECTS), 4)));
    }

    public function test_every_question_must_be_answered_on_a_one_to_four_scale(): void
    {
        $ticket = Ticket::factory()->create(['ticket_no' => 'TKT-503', 'status' => TicketStatus::Selesai]);
        $payload = $this->surveyPayload(4, ['keseluruhan' => 5, 'teratasi' => 'mungkin', 'usia' => '99']);
        unset($payload['jawaban']['sikap'], $payload['kembali']);

        $this->post('/lacak/survei', ['ticket' => 'TKT-503', 'kode' => $ticket->lookup_token] + $payload)
            ->assertSessionHasErrors(['jawaban.sikap', 'keseluruhan', 'teratasi', 'kembali', 'usia']);
        $this->assertDatabaseCount('surveys', 0);
    }

    public function test_unresolved_with_review_request_flags_ticket_and_notifies_staff(): void
    {
        Event::fake([NotificationBroadcast::class]);
        $admin = User::factory()->admin(UserRole::SuperAdmin)->create();
        $ticket = Ticket::factory()->create(['ticket_no' => 'TKT-505', 'status' => TicketStatus::Selesai]);

        $this->post('/lacak/survei', ['ticket' => 'TKT-505', 'kode' => $ticket->lookup_token] + $this->surveyPayload(3, ['teratasi' => 'sebagian', 'tinjau_ulang' => true]))
            ->assertSessionHas('success', fn (string $msg) => str_contains($msg, 'tinjau ulang'));

        $ticket->refresh();
        $this->assertSame(Ticket::REVIEW_REQUESTED, $ticket->review_reason);
        $this->assertTrue($ticket->needsReview());
        $this->assertSame(TicketStatus::Selesai, $ticket->status);
        $this->assertDatabaseHas('activity_logs', ['action' => 'ticket.review_requested']);
        Event::assertDispatched(NotificationBroadcast::class, fn (NotificationBroadcast $e) => $e->userId === $admin->id && $e->payload['event'] === 'tinjau_ulang');
    }

    public function test_low_overall_score_flags_ticket_even_without_request(): void
    {
        $ticket = Ticket::factory()->create(['ticket_no' => 'TKT-506', 'status' => TicketStatus::Selesai]);

        $this->post('/lacak/survei', ['ticket' => 'TKT-506', 'kode' => $ticket->lookup_token] + $this->surveyPayload(3, ['keseluruhan' => 2]));

        $this->assertSame(Ticket::REVIEW_LOW_SCORE, $ticket->fresh()->review_reason);
    }

    public function test_review_request_is_ignored_when_problem_is_fully_resolved(): void
    {
        $ticket = Ticket::factory()->create(['ticket_no' => 'TKT-507', 'status' => TicketStatus::Selesai]);

        $this->post('/lacak/survei', ['ticket' => 'TKT-507', 'kode' => $ticket->lookup_token] + $this->surveyPayload(4, ['tinjau_ulang' => true]));

        $this->assertNull($ticket->fresh()->review_requested_at);
    }

    public function test_survey_is_rejected_for_ticket_not_finished(): void
    {
        $ticket = Ticket::factory()->create(['ticket_no' => 'TKT-501', 'status' => TicketStatus::Diproses]);

        $this->post('/lacak/survei', ['ticket' => 'TKT-501', 'kode' => $ticket->lookup_token] + $this->surveyPayload())->assertSessionHasErrors('ticket');

        $this->assertDatabaseCount('surveys', 0);
    }

    public function test_survey_is_rejected_for_internal_ticket(): void
    {
        Ticket::factory()->create(['ticket_no' => 'TKT-502', 'status' => TicketStatus::Selesai, 'is_internal' => true]);

        $this->post('/lacak/survei', ['ticket' => 'TKT-502'] + $this->surveyPayload())
            ->assertRedirect()
            ->assertSessionHas('error');

        $this->assertDatabaseCount('surveys', 0);
    }

    public function test_track_page_reports_survey_state_and_who_may_fill_it(): void
    {
        $owner = User::factory()->warga()->create();
        $ticket = Ticket::factory()->forReporter($owner)->create(['ticket_no' => 'TKT-261111-SRVAAA', 'status' => TicketStatus::Selesai]);

        $this->get('/lacak/TKT-261111-SRVAAA')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('ticket.sudah_disurvei', false)
            ->where('ticket.boleh_survei', false));
        $this->actingAs($owner)->get('/lacak/TKT-261111-SRVAAA')->assertInertia(fn (Assert $page) => $page->where('ticket.boleh_survei', true));

        $ticket->survey()->create(['rating' => 4]);
        $this->get('/lacak/TKT-261111-SRVAAA')->assertInertia(fn (Assert $page) => $page->where('ticket.sudah_disurvei', true));
    }

    public function test_survey_page_shows_questionnaire_or_asks_owner_to_sign_in(): void
    {
        $owner = User::factory()->warga()->create();
        Ticket::factory()->forReporter($owner)->create(['ticket_no' => 'TKT-261111-SRVBBB', 'status' => TicketStatus::Selesai]);

        $this->get('/lacak/TKT-261111-SRVBBB/survei')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('public/survei')
                ->where('boleh_isi', false)
                ->has('kuesioner.aspek', count(SurveyQuestionnaire::ASPECTS)))
            ->assertSessionHas('url.intended', fn (string $url) => str_ends_with($url, '/lacak/TKT-261111-SRVBBB/survei'));

        $this->actingAs($owner)->get('/lacak/TKT-261111-SRVBBB/survei')->assertInertia(fn (Assert $page) => $page
            ->where('boleh_isi', true)
            ->where('tiket.nomor', 'TKT-261111-SRVBBB'));

        $this->get('/lacak/TKT-261111-XXXXXX/survei')->assertRedirect('/lacak');
    }

    public function test_questionnaire_is_available_over_api(): void
    {
        $this->getJson('/api/v1/survei/kuesioner')
            ->assertOk()
            ->assertJsonPath('versi', SurveyQuestionnaire::VERSION)
            ->assertJsonCount(9, 'aspek')
            ->assertJsonCount(3, 'teratasi.pilihan');
    }

    public function test_staff_see_review_tab_and_can_close_review_without_reopening(): void
    {
        $admin = User::factory()->admin(UserRole::SuperAdmin)->create();
        $ticket = Ticket::factory()->create(['status' => TicketStatus::Selesai, 'review_requested_at' => now(), 'review_reason' => Ticket::REVIEW_REQUESTED]);
        $ticket->survey()->create(['version' => 2, 'answers' => array_fill_keys(array_keys(SurveyQuestionnaire::ASPECTS), 2), 'overall' => 2, 'resolved' => 'sebagian', 'reuse' => 3, 'skm_index' => 50]);

        $this->actingAs($admin)->get('/admin/tiket?tinjau=1')->assertInertia(fn (Assert $page) => $page
            ->where('tab_counts.tinjau', 1)
            ->where('filters.tinjau', '1'));
        $this->actingAs($admin)->get("/admin/tiket/{$ticket->ticket_no}")->assertInertia(fn (Assert $page) => $page
            ->where('tinjau.perlu', true)
            ->where('survei.versi', 2)
            ->where('survei.mutu.huruf', 'D')
            ->where('survei.teratasi', 'Sebagian teratasi'));

        $this->actingAs($admin)->post("/admin/tiket/{$ticket->ticket_no}/tinjau-ulang", ['note' => 'Sudah dikonfirmasi ke pelapor.'])->assertSessionHas('success');

        $ticket->refresh();
        $this->assertFalse($ticket->needsReview());
        $this->assertSame($admin->id, $ticket->reviewed_by);
        $this->assertSame(TicketStatus::Selesai, $ticket->status);
        $this->assertDatabaseHas('ticket_replies', ['ticket_id' => $ticket->id, 'is_public' => false, 'body' => 'Sudah dikonfirmasi ke pelapor.']);
    }

    public function test_reopening_a_flagged_ticket_closes_the_review(): void
    {
        $admin = User::factory()->admin(UserRole::SuperAdmin)->create();
        $ticket = Ticket::factory()->create(['status' => TicketStatus::Selesai, 'review_requested_at' => now(), 'review_reason' => Ticket::REVIEW_LOW_SCORE]);

        $this->actingAs($admin)->post("/admin/tiket/{$ticket->ticket_no}/status", ['status' => 'diproses', 'note' => 'Dibuka kembali dari survei.'])->assertSessionHas('success');

        $ticket->refresh();
        $this->assertSame(TicketStatus::Diproses, $ticket->status);
        $this->assertFalse($ticket->needsReview());
        $this->assertNotNull($ticket->reviewed_at);
    }

    public function test_reminder_is_sent_once_three_days_after_completion(): void
    {
        Mail::fake();
        $due = Ticket::factory()->create(['status' => TicketStatus::Selesai, 'resolved_at' => now()->subDays(3)->subHour(), 'reporter_email' => 'warga@contoh.test']);
        $fresh = Ticket::factory()->create(['status' => TicketStatus::Selesai, 'resolved_at' => now()->subDay(), 'reporter_email' => 'baru@contoh.test']);
        $old = Ticket::factory()->create(['status' => TicketStatus::Selesai, 'resolved_at' => now()->subDays(30), 'reporter_email' => 'lama@contoh.test']);
        $done = Ticket::factory()->create(['status' => TicketStatus::Selesai, 'resolved_at' => now()->subDays(4), 'reporter_email' => 'sudah@contoh.test']);
        $done->survey()->create(['rating' => 5]);

        $this->artisan('sigap:pengingat-survei')->expectsOutput('1 pengingat survei terkirim.')->assertSuccessful();
        $this->artisan('sigap:pengingat-survei')->expectsOutput('0 pengingat survei terkirim.')->assertSuccessful();

        Mail::assertQueued(ReporterTicketMail::class, 1);
        Mail::assertQueued(ReporterTicketMail::class, fn ($mail) => $mail->hasTo('warga@contoh.test') && str_contains($mail->payload['cta_url'], '/survei'));
        $this->assertNotNull($due->fresh()->survey_reminded_at);
        $this->assertNull($fresh->fresh()->survey_reminded_at);
        $this->assertNull($old->fresh()->survey_reminded_at);
    }
}
