<?php

namespace App\Services;

use App\Enums\TicketImpact;
use App\Enums\TicketPriority;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * Menghitung prioritas dan tenggat SLA sebuah tiket dari tingkat dampak.
 *
 * Memperbaiki bug audit B1/B2: sebelumnya `tingkatDampak` diabaikan dan SLA
 * dihitung dari kategori, bukan dari prioritas resmi Pedoman Layanan Contact Center.
 *
 * Pemetaan (Pedoman Layanan Contact Center):
 *   Kritis  -> Darurat   : respons 1x24 jam, selesai 3 hari kerja
 *   Tinggi  -> Prioritas : respons 3x24 jam, selesai 7 hari kerja
 *   Sedang  -> Umum      : respons 5 hari,  selesai 14 hari kerja
 *   Rendah  -> Umum      : respons 5 hari,  selesai 14 hari kerja
 *
 * TECH-SPEC §3.3 (D-06): bila kategori memiliki `sla_days` khusus, dipakai
 * nilai yang LEBIH KETAT (minimum) antara dampak dan kategori.
 */
class SlaCalculator
{
    /**
     * Tenggat penyelesaian: N hari KERJA setelah waktu acuan.
     * Sabtu & Minggu dilewati; hari libur nasional dapat ditambahkan kemudian.
     */
    public function dueAt(TicketImpact $impact, ?CarbonInterface $from = null, ?int $categoryDays = null): CarbonInterface
    {
        $from = $from ? Carbon::parse($from) : Carbon::now();

        return $this->addWorkingDays($from->copy(), $this->resolveDays($impact, $categoryDays));
    }

    /** Jumlah hari kerja efektif: min(dampak, kategori bila diisi). */
    public function resolveDays(TicketImpact $impact, ?int $categoryDays = null): int
    {
        $days = $impact->resolveDays();

        if ($categoryDays !== null && $categoryDays > 0) {
            $days = min($days, $categoryDays);
        }

        return $days;
    }

    /** Batas respons awal: N jam setelah waktu acuan. */
    public function respondAt(TicketImpact $impact, ?CarbonInterface $from = null): CarbonInterface
    {
        $from = $from ? Carbon::parse($from) : Carbon::now();

        return $from->copy()->addHours($impact->responseHours());
    }

    public function priorityFor(TicketImpact $impact): TicketPriority
    {
        return $impact->priority();
    }

    /**
     * Status SLA sebuah tiket: 'terpenuhi' | 'berjalan' | 'terlambat'.
     *
     * Tiket yang sudah ditutup hanya 'terpenuhi' bila diselesaikan paling
     * lambat pada tenggat (resolved_at <= sla_due_at).
     */
    public function status(bool $isOpen, ?CarbonInterface $due, CarbonInterface $now, ?CarbonInterface $resolvedAt = null): string
    {
        if ($due === null) {
            return 'berjalan';
        }

        if ($isOpen) {
            return $now->greaterThan($due) ? 'terlambat' : 'berjalan';
        }

        if ($resolvedAt === null) {
            return 'terlambat';
        }

        return $resolvedAt->lessThanOrEqualTo($due) ? 'terpenuhi' : 'terlambat';
    }

    /** Tambah N hari kerja, melewati Sabtu & Minggu. */
    private function addWorkingDays(CarbonInterface $date, int $days): CarbonInterface
    {
        $added = 0;

        while ($added < $days) {
            $date = $date->addDay();

            if ($date->isWeekday()) {
                $added++;
            }
        }

        return $date;
    }
}
