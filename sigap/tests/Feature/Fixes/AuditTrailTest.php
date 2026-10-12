<?php

namespace Tests\Feature\Fixes;

use App\Models\ActivityLog;
use App\Models\Region;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * D-02: jejak audit untuk login/logout, unduh lampiran, dan mutasi admin API.
 */
class AuditTrailTest extends TestCase
{
    use RefreshDatabase;

    public function test_web_login_failure_success_and_logout_are_audited(): void
    {
        $admin = User::factory()->admin()->create();

        $this->post('/masuk', ['identifier' => $admin->username, 'password' => 'salah'])->assertSessionHasErrors('identifier');
        $this->post('/masuk', ['identifier' => $admin->username, 'password' => 'password'])->assertRedirect();
        $this->post('/keluar')->assertRedirect('/');

        $this->assertDatabaseHas('activity_logs', ['action' => 'auth.login_failed']);
        $this->assertDatabaseHas('activity_logs', ['action' => 'auth.login', 'user_id' => $admin->id]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'auth.logout', 'user_id' => $admin->id]);
    }

    public function test_failed_nik_login_does_not_store_full_nik(): void
    {
        $this->postJson('/api/v1/auth/login', ['identifier' => '3171010101010001', 'password' => 'x'])->assertUnauthorized();

        $log = ActivityLog::where('action', 'auth.login_failed')->firstOrFail();
        $this->assertSame('3171********0001', $log->properties['identifier']);
    }

    public function test_attachment_download_is_audited(): void
    {
        Storage::fake('local');
        $admin = User::factory()->admin()->create();
        $path = UploadedFile::fake()->create('bukti.pdf', 5, 'application/pdf')->store('lampiran', 'local');
        $ticket = Ticket::factory()->create(['attachment_path' => $path]);

        $this->actingAs($admin)->get("/admin/tiket/{$ticket->ticket_no}/lampiran")->assertOk();

        $this->assertDatabaseHas('activity_logs', ['action' => 'ticket.attachment_downloaded', 'user_id' => $admin->id]);
    }

    public function test_api_admin_mutations_are_audited(): void
    {
        $admin = User::factory()->admin()->create();
        $ticket = Ticket::factory()->create();

        $this->actingAs($admin, 'sanctum')->postJson("/api/v1/admin/tickets/{$ticket->ticket_no}/status", ['status' => 'diproses'])->assertOk();
        $this->actingAs($admin, 'sanctum')->postJson("/api/v1/admin/tickets/{$ticket->ticket_no}/tanggapan", ['body' => 'Ditangani.'])->assertCreated();
        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/admin/kawasan', ['code' => 'KWS-A', 'name' => 'Kawasan A'])->assertCreated();
        $region = Region::where('code', 'KWS-A')->firstOrFail();
        $this->actingAs($admin, 'sanctum')->putJson("/api/v1/admin/kawasan/{$region->id}", ['name' => 'Kawasan B'])->assertOk();
        $this->actingAs($admin, 'sanctum')->deleteJson("/api/v1/admin/kawasan/{$region->id}")->assertNoContent();
        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/admin/kanal', ['type' => 'sosmed', 'name' => 'IG', 'url' => 'https://instagram.com/x'])->assertCreated();
        $this->actingAs($admin, 'sanctum')->putJson('/api/v1/admin/pengaturan', ['ews_enabled' => true])->assertOk();

        foreach (['ticket.status_changed', 'ticket.replied', 'region.created', 'region.updated', 'region.deleted', 'channel.created', 'settings.updated'] as $action) {
            $this->assertDatabaseHas('activity_logs', ['action' => $action, 'user_id' => $admin->id]);
        }
    }
}
