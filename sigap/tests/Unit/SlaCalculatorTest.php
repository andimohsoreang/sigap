<?php

namespace Tests\Unit;

use App\Enums\TicketImpact;
use App\Enums\TicketPriority;
use App\Services\SlaCalculator;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Mengunci pemetaan dampak -> prioritas & SLA (perbaikan bug audit B1/B2).
 */
class SlaCalculatorTest extends TestCase
{
    private SlaCalculator $sla;

    protected function setUp(): void
    {
        parent::setUp();
        $this->sla = new SlaCalculator;
    }

    public function test_impact_maps_to_expected_priority(): void
    {
        $this->assertSame(TicketPriority::Darurat, TicketImpact::Kritis->priority());
        $this->assertSame(TicketPriority::Prioritas, TicketImpact::Tinggi->priority());
        $this->assertSame(TicketPriority::Umum, TicketImpact::Sedang->priority());
        $this->assertSame(TicketPriority::Umum, TicketImpact::Rendah->priority());
    }

    public function test_priority_is_never_defaulted_to_sedang_for_all_tickets(): void
    {
        $priorities = array_map(
            fn (TicketImpact $i) => $i->priority()->value,
            TicketImpact::cases(),
        );

        $this->assertGreaterThan(1, count(array_unique($priorities)));
    }

    public function test_due_at_skips_weekends(): void
    {
        // Jumat 2026-10-02 + 3 hari kerja = Rabu 2026-10-07
        $from = Carbon::parse('2026-10-02 08:00:00'); // Friday
        $due = $this->sla->dueAt(TicketImpact::Kritis, $from);

        $this->assertSame('2026-10-07', $due->toDateString());
        $this->assertTrue($due->isWeekday());
    }

    public function test_response_hours_follow_impact(): void
    {
        $from = Carbon::parse('2026-10-05 08:00:00');

        $this->assertSame('2026-10-06 08:00', $this->sla->respondAt(TicketImpact::Kritis, $from)->format('Y-m-d H:i'));
        $this->assertSame('2026-10-08 08:00', $this->sla->respondAt(TicketImpact::Tinggi, $from)->format('Y-m-d H:i'));
        $this->assertSame('2026-10-10 08:00', $this->sla->respondAt(TicketImpact::Sedang, $from)->format('Y-m-d H:i'));
    }
}