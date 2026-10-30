<?php

namespace Tests\Feature\Web;

use App\Enums\TicketImpact;
use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\Category;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\Portal;
use App\Models\Referral;
use App\Models\Region;
use App\Models\Survey;
use App\Models\Ticket;
use App\Models\User;
use Database\Seeders\MasterSeeder;
use Database\Seeders\PortalSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Matriks Rekapitulasi (panel admin): alur penanganan, KPI, matriks per
 * sumbu, kartu dampak/kanal/kawasan, dan daftar "Perlu tindakan".
 */
class MatriksTest extends TestCase
{
    use RefreshDatabase;

    private Category $infra;

    private Category $lahan;

    private Region $merauke;

    private Region $bulungan;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-15 10:00:00');
        $this->seed([MasterSeeder::class, PortalSeeder::class]);

        $this->infra = Category::query()->where('slug', 'infrastruktur-dasar')->firstOrFail();
        $this->lahan = Category::query()->where('slug', 'tata-kelola-lahan')->firstOrFail();
        $this->merauke = Region::query()->where('code', 'KWS-001')->firstOrFail();
        $this->bulungan = Region::query()->where('code', 'KWS-002')->firstOrFail();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function superAdmin(): User
    {
        return User::factory()->admin(UserRole::SuperAdmin)->create();
    }

    /** @param  array<string, mixed>  $attributes */
    private function ticket(array $attributes): Ticket
    {
        return Ticket::factory()->create($attributes + [
            'category_id' => $this->infra->id,
            'region_id' => $this->merauke->id,
            'created_at' => now()->subDays(3),
        ]);
    }

    /**
     * Enam tiket bulan berjalan (berbeda status/kategori/dampak/pintu masuk)
     * + satu tiket lewat tenggat dari bulan lalu.
     */
    private function seedTickets(User $petugas): void
    {
        // Formulir web — Menunggu, kritis, lewat tenggat 2 hari.
        $this->ticket(['ticket_no' => 'TKT-261012-AAAAAA', 'status' => TicketStatus::Baru, 'impact' => TicketImpact::Kritis, 'sla_due_at' => now()->subDays(2)]);
        // Input manual (call center) — Diproses, tinggi, lewat tenggat 5 jam, ditangani petugas.
        $this->ticket(['ticket_no' => 'TKT-261012-BBBBBB', 'status' => TicketStatus::Diproses, 'impact' => TicketImpact::Tinggi, 'source' => 'call_center', 'received_by' => 'Petugas', 'assignee_id' => $petugas->id, 'sla_due_at' => now()->subHours(5), 'responded_at' => now()->subDays(3)->addHours(4)]);
        // Input manual (live chat) — Selesai tepat waktu, sedang.
        $tepat = $this->ticket(['ticket_no' => 'TKT-261012-CCCCCC', 'category_id' => $this->lahan->id, 'region_id' => $this->bulungan->id, 'status' => TicketStatus::Selesai, 'impact' => TicketImpact::Sedang, 'source' => 'live_chat', 'sla_due_at' => now()->addDays(5), 'responded_at' => now()->subDays(3)->addHours(2), 'resolved_at' => now()->subDay()]);
        // Input manual (Instagram) — Selesai terlambat, rendah.
        $this->ticket(['ticket_no' => 'TKT-261012-DDDDDD', 'category_id' => $this->lahan->id, 'region_id' => $this->bulungan->id, 'status' => TicketStatus::Selesai, 'impact' => TicketImpact::Rendah, 'source' => 'instagram', 'sla_due_at' => now()->subDays(2), 'resolved_at' => now()->subDay()]);
        // Diterbitkan dari percakapan Pesan Masuk (tanpa kolom source) — Ditolak.
        $dariChat = $this->ticket(['ticket_no' => 'TKT-261012-EEEEEE', 'region_id' => $this->bulungan->id, 'status' => TicketStatus::Ditolak, 'impact' => TicketImpact::Sedang]);
        ChatConversation::create(['guest_token' => Str::random(20), 'subject' => 'x', 'ticket_id' => $dariChat->id, 'outcome' => 'tiket']);
        // Formulir web — Diverifikasi, belum lewat tenggat.
        $this->ticket(['ticket_no' => 'TKT-261012-FFFFFF', 'status' => TicketStatus::Verifikasi, 'impact' => TicketImpact::Tinggi, 'sla_due_at' => now()->addDays(3)]);

        // Bulan lalu, masih berjalan & lewat tenggat.
        $this->ticket(['ticket_no' => 'TKT-260920-GGGGGG', 'status' => TicketStatus::Baru, 'impact' => TicketImpact::Sedang, 'created_at' => now()->subMonth(), 'sla_due_at' => now()->subDays(10)]);

        Survey::create(['ticket_id' => $tepat->id, 'rating' => 4]);
    }

    public function test_rekap_props_follow_status_category_impact_and_overdue(): void
    {
        $admin = $this->superAdmin();
        $this->seedTickets($admin);

        // Ditangani tanpa tiket: 1 percakapan dijawab TARA, 1 arahan PPID, 2 rujukan (1 berhasil).
        $chat = ChatConversation::create(['guest_token' => Str::random(20), 'subject' => 'Info', 'handled_by' => 'ai']);
        ChatMessage::create(['conversation_id' => $chat->id, 'sender_type' => 'ai', 'body' => 'Jawaban', 'meta' => ['kind' => 'jawaban']]);
        $ppid = ChatConversation::create(['guest_token' => Str::random(20), 'subject' => 'Kebijakan', 'handled_by' => 'ai']);
        ChatMessage::create(['conversation_id' => $ppid->id, 'sender_type' => 'ai', 'body' => 'PPID', 'meta' => ['kind' => 'tidak_tahu', 'kebijakan' => true]]);
        $portal = Portal::query()->firstOrFail();
        foreach ([Referral::STATUS_DONE, Referral::STATUS_REFERRED] as $i => $status) {
            Referral::create(['token' => Str::random(40), 'code' => 'RJK-'.$i, 'portal_id' => $portal->id, 'status' => $status]);
        }

        $this->actingAs($admin)
            ->get('/admin/matriks')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/matriks')
                ->where('periode.value', '2026-10')
                ->where('periode.label', 'Oktober 2026')
                ->where('filters.sumbu', 'kategori')
                ->has('tickets.data', 6)
                ->where('rekap.total', 6)
                // Alur: pintu masuk & tahap.
                ->where('rekap.alur.pintu.0', ['key' => 'web', 'label' => 'Formulir web', 'total' => 2])
                ->where('rekap.alur.pintu.1.total', 2)
                ->where('rekap.alur.pintu.2', ['key' => 'chat', 'label' => 'Chat TARA → petugas', 'total' => 2])
                ->where('rekap.alur.tahap.baru', ['jumlah' => 1, 'ews' => 1])
                ->where('rekap.alur.tahap.verifikasi', ['jumlah' => 1, 'ews' => 0])
                ->where('rekap.alur.tahap.diproses', ['jumlah' => 1, 'ews' => 1])
                ->where('rekap.alur.tahap.selesai.jumlah', 2)
                ->where('rekap.alur.tahap.selesai.tepat_waktu', 1)
                ->where('rekap.alur.tahap.ditolak.jumlah', 1)
                ->where('rekap.alur.tanpa_tiket', ['dijawab_tara' => 1, 'rujukan' => 2, 'rujukan_berhasil' => 1, 'ppid' => 1])
                // KPI.
                ->where('rekap.kpi.berjalan', 3)
                ->where('rekap.kpi.ews', 2)
                ->where('rekap.kpi.ews_luar_periode', 1)
                ->where('rekap.kpi.sla_pct', 50)
                ->where('rekap.kpi.sla_tepat', 1)
                ->where('rekap.kpi.sla_selesai', 2)
                ->where('rekap.kpi.respons_jam', 3)
                ->where('rekap.kpi.penyelesaian_hari', 2)
                // Matriks per kategori (baris Infrastruktur Dasar).
                ->where('rekap.matriks.rows.0.label', 'Infrastruktur Dasar')
                ->where('rekap.matriks.rows.0.param', ['category_id' => (string) $this->infra->id])
                ->where('rekap.matriks.rows.0.counts', ['baru' => 1, 'verifikasi' => 1, 'diproses' => 1, 'selesai' => 0, 'ditolak' => 1])
                ->where('rekap.matriks.rows.0.total', 4)
                ->where('rekap.matriks.rows.0.ews', 2)
                ->where('rekap.matriks.rows.0.sla_pct', null)
                ->where('rekap.matriks.rows.1.label', 'Tata Kelola Lahan')
                ->where('rekap.matriks.rows.1.counts.selesai', 2)
                ->where('rekap.matriks.rows.1.sla_pct', 50)
                ->has('rekap.matriks.rows', 4)
                ->where('rekap.matriks.total.total', 6)
                // Dampak × SLA.
                ->where('rekap.dampak.0.value', 'kritis')
                ->where('rekap.dampak.0.target', 'Respons 1×24 jam · selesai 3 hari kerja')
                ->where('rekap.dampak.0.tiket', 1)
                ->where('rekap.dampak.0.lewat', 1)
                ->where('rekap.dampak.2.value', 'sedang')
                ->where('rekap.dampak.2.target', 'Respons 5 hari · selesai 14 hari kerja')
                ->where('rekap.dampak.2.tepat', 1)
                ->where('rekap.dampak.2.selesai', 1)
                // Kanal & kawasan.
                ->where('rekap.kanal.0', ['key' => 'web', 'label' => 'Formulir web', 'total' => 2])
                ->where('rekap.kawasan.0.label', 'SP1 Merauke')
                ->where('rekap.kawasan.0.total', 3)
                ->where('rekap.kawasan.0.ews', 2)
                ->where('rekap.survei', ['rata' => 4, 'responden' => 1, 'selesai' => 2])
                // Perlu tindakan: terlama lewat tenggat lebih dulu.
                ->where('rekap.perlu_tindakan.total', 2)
                ->has('rekap.perlu_tindakan.items', 2)
                ->where('rekap.perlu_tindakan.items.0.nomor', 'TKT-261012-AAAAAA')
                ->where('rekap.perlu_tindakan.items.0.lewat_menit', 2 * 24 * 60)
                ->where('rekap.perlu_tindakan.items.1.petugas', $admin->name)
            );
    }

    public function test_period_selection_and_all_time(): void
    {
        $admin = $this->superAdmin();
        $this->seedTickets($admin);

        $this->actingAs($admin)
            ->get('/admin/matriks?periode=semua')
            ->assertInertia(fn (Assert $page) => $page
                ->where('periode.label', 'Semua waktu')
                ->where('rekap.total', 7)
                ->where('rekap.kpi.ews', 3)
                ->where('rekap.kpi.ews_luar_periode', 0)
                ->has('tickets.data', 7));

        $this->actingAs($admin)
            ->get('/admin/matriks?periode=2026-09')
            ->assertInertia(fn (Assert $page) => $page
                ->where('periode.label', 'September 2026')
                ->where('rekap.total', 1)
                ->where('tickets.data.0.nomor', 'TKT-260920-GGGGGG')
                ->where('options.months.0', ['value' => '2026-10', 'label' => 'Oktober 2026'])
                ->where('options.months.1', ['value' => '2026-09', 'label' => 'September 2026']));
    }

    public function test_matrix_axis_can_be_switched(): void
    {
        $admin = $this->superAdmin();
        $this->seedTickets($admin);

        $this->actingAs($admin)
            ->get('/admin/matriks?sumbu=kawasan')
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.sumbu', 'kawasan')
                ->where('rekap.matriks.sumbu', 'kawasan')
                ->has('rekap.matriks.rows', 3)
                ->where('rekap.matriks.rows.0.label', 'SP1 Merauke')
                ->where('rekap.matriks.rows.0.param', ['region_id' => (string) $this->merauke->id])
                ->where('rekap.matriks.rows.0.total', 3)
                ->where('rekap.matriks.rows.1.total', 3));

        $this->actingAs($admin)
            ->get('/admin/matriks?sumbu=kanal')
            ->assertInertia(fn (Assert $page) => $page
                ->where('rekap.matriks.rows.0.key', 'web')
                ->where('rekap.matriks.rows.0.total', 2)
                ->where('rekap.matriks.rows.1.key', 'chat')
                ->where('rekap.matriks.rows.1.param', ['kanal' => 'chat'])
                ->where('rekap.matriks.rows.1.total', 2)
                ->where('rekap.matriks.rows.2.key', 'medsos')
                ->where('rekap.matriks.rows.2.total', 1));

        $this->actingAs($admin)
            ->get('/admin/matriks?sumbu=petugas')
            ->assertInertia(fn (Assert $page) => $page
                ->has('rekap.matriks.rows', 2)
                ->where('rekap.matriks.rows.0.label', 'Belum ditugaskan')
                ->where('rekap.matriks.rows.0.total', 5)
                ->where('rekap.matriks.rows.1.label', $admin->name)
                ->where('rekap.matriks.rows.1.param', ['petugas' => (string) $admin->id]));

        // Sumbu tak dikenal kembali ke kategori.
        $this->actingAs($admin)
            ->get('/admin/matriks?sumbu=hapus')
            ->assertInertia(fn (Assert $page) => $page->where('rekap.matriks.sumbu', 'kategori'));
    }

    public function test_empty_period_keeps_structure_with_zero_values(): void
    {
        $admin = $this->superAdmin();
        // Tiket bulan lalu tidak ikut periode berjalan.
        $this->ticket(['status' => TicketStatus::Selesai, 'created_at' => now()->subMonth(), 'resolved_at' => now()->subMonth()->addDay()]);
        ChatConversation::create(['guest_token' => Str::random(20), 'subject' => 'Info', 'handled_by' => 'ai']);

        $this->actingAs($admin)
            ->get('/admin/matriks')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('rekap.total', 0)
                ->has('tickets.data', 0)
                ->where('rekap.alur.tahap.baru', ['jumlah' => 0, 'ews' => 0])
                ->where('rekap.kpi.berjalan', 0)
                ->where('rekap.kpi.sla_pct', null)
                ->where('rekap.kpi.respons_jam', null)
                ->where('rekap.kpi.penyelesaian_hari', null)
                ->has('rekap.matriks.rows', 4)
                ->where('rekap.matriks.rows.0.total', 0)
                ->where('rekap.matriks.rows.0.sla_pct', null)
                ->where('rekap.survei.rata', null)
                ->has('rekap.perlu_tindakan.items', 0));
    }

    public function test_role_scope_still_applies_to_rekap(): void
    {
        $this->seedTickets($this->superAdmin());
        $admin = User::factory()->admin(UserRole::AdminKawasan)->create(['region_id' => $this->merauke->id]);

        $this->actingAs($admin)
            ->get('/admin/matriks?sumbu=kawasan')
            ->assertInertia(fn (Assert $page) => $page
                ->where('region_locked', true)
                ->where('rekap.total', 3)
                ->where('rekap.kpi.ews', 2)
                ->has('rekap.matriks.rows', 1)
                ->where('rekap.matriks.rows.0.label', 'SP1 Merauke')
                ->has('rekap.kawasan', 1)
                ->has('tickets.data', 3));

        // Meminta kawasan lain lewat query tidak membuka tiket di luar cakupan.
        $this->actingAs($admin)
            ->get('/admin/matriks?region_id='.$this->bulungan->id)
            ->assertInertia(fn (Assert $page) => $page
                ->where('rekap.total', 0)
                ->has('tickets.data', 0));
    }

    public function test_ticket_list_accepts_matrix_drilldown_filters(): void
    {
        $admin = $this->superAdmin();
        $this->seedTickets($admin);

        $this->actingAs($admin)
            ->get('/admin/tiket?category_id='.$this->infra->id.'&status=baru&periode=2026-10')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/tiket')
                ->has('tickets.data', 1)
                ->where('tickets.data.0.nomor', 'TKT-261012-AAAAAA')
                ->where('filters.category_id', (string) $this->infra->id)
                ->where('chips.0', ['key' => 'periode', 'label' => 'Periode: Oktober 2026'])
                ->where('chips.1', ['key' => 'category_id', 'label' => 'Kategori: Infrastruktur Dasar']));

        $this->actingAs($admin)
            ->get('/admin/tiket?kanal=chat')
            ->assertInertia(fn (Assert $page) => $page->has('tickets.data', 2));

        $this->actingAs($admin)
            ->get('/admin/tiket?ews=1')
            ->assertInertia(fn (Assert $page) => $page->has('tickets.data', 3));

        $this->actingAs($admin)
            ->get('/admin/tiket?petugas='.$admin->id)
            ->assertInertia(fn (Assert $page) => $page
                ->has('tickets.data', 1)
                ->where('tickets.data.0.nomor', 'TKT-261012-BBBBBB'));
    }

    public function test_rekap_has_province_category_and_trend_data(): void
    {
        $admin = $this->superAdmin();
        $this->seedTickets($admin);

        $this->actingAs($admin)
            ->get('/admin/matriks')
            ->assertInertia(function (Assert $page) {
                $provinsi = collect($page->toArray()['props']['rekap']['provinsi'])->keyBy('provinsi');
                $this->assertSame(3, $provinsi['Papua Selatan']['total']);
                $this->assertSame(2, $provinsi['Papua Selatan']['ews']);
                $this->assertSame(['id' => $this->merauke->id, 'nama' => 'SP1 Merauke', 'total' => 3], $provinsi['Papua Selatan']['kawasan'][0]);
                $this->assertSame(3, $provinsi['Kalimantan Utara']['total']);
                $this->assertSame(2, $provinsi['Kalimantan Utara']['counts']['selesai']);
                $this->assertEquals(50, $provinsi['Kalimantan Utara']['sla_pct']);

                $kategori = collect($page->toArray()['props']['rekap']['kategori'])->pluck('total', 'label')->all();
                $this->assertSame(['Infrastruktur Dasar' => 4, 'Tata Kelola Lahan' => 2], $kategori);

                $tren = $page->toArray()['props']['rekap']['tren'];
                $this->assertSame('hari', $tren['satuan']);
                $this->assertCount(15, $tren['titik']); // 1–15 Oktober (hari ini)
                $byDay = collect($tren['titik'])->keyBy('key');
                $this->assertSame(6, $byDay['2026-10-12']['masuk']);
                $this->assertSame(2, $byDay['2026-10-14']['selesai']);
                $this->assertSame(6, collect($tren['titik'])->sum('masuk'));
            });

        $this->actingAs($admin)
            ->get('/admin/matriks?periode=semua')
            ->assertInertia(fn (Assert $page) => $page
                ->where('rekap.tren.satuan', 'bulan')
                ->where('rekap.tren.titik.0.key', '2026-09')
                ->where('rekap.tren.titik.0.masuk', 1)
                ->where('rekap.tren.titik.1.masuk', 6));
    }

    public function test_province_filter_narrows_rekap_list_and_chip(): void
    {
        $admin = $this->superAdmin();
        $this->seedTickets($admin);

        $this->actingAs($admin)
            ->get('/admin/matriks?provinsi=Kalimantan%20Utara')
            ->assertInertia(fn (Assert $page) => $page
                ->where('rekap.total', 3)
                ->has('tickets.data', 3)
                ->where('filters.provinsi', 'Kalimantan Utara')
                ->where('chips', fn ($chips) => collect($chips)->contains(fn ($c) => $c['key'] === 'provinsi' && $c['label'] === 'Provinsi: Kalimantan Utara'))
                ->where('rekap.kawasan', fn ($rows) => collect($rows)->pluck('label')->all() === ['SP3 Bulungan'])
                ->where('rekap.provinsi', fn ($rows) => collect($rows)->pluck('provinsi')->all() === ['Kalimantan Utara']));
    }

    public function test_public_map_shows_complaints_per_province_without_internal_tickets(): void
    {
        $this->seedTickets($this->superAdmin());
        $this->ticket(['ticket_no' => 'TKT-261012-HHHHHH', 'status' => TicketStatus::Baru, 'is_internal' => true]);

        $this->get('/peta')->assertInertia(function (Assert $page) {
            $provinsi = collect($page->toArray()['props']['provinsi'])->keyBy('provinsi');
            // Merauke: 3 bulan ini + 1 bulan lalu (semua waktu); tiket internal tidak dihitung.
            $this->assertSame(['provinsi' => 'Papua Selatan', 'total' => 4, 'selesai' => 0, 'berjalan' => 4, 'kawasan' => [['nama' => 'SP1 Merauke', 'total' => 4]]], $provinsi['Papua Selatan']);
            $this->assertSame(3, $provinsi['Kalimantan Utara']['total']);
            $this->assertSame(2, $provinsi['Kalimantan Utara']['selesai']);
            $this->assertArrayNotHasKey('Sulawesi Selatan', $provinsi->all());
        });
    }
}
