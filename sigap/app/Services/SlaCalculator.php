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
 * dihitung dari kategori, bukan dari prioritas resmi Pedoman Layanan SIGAP.
 *
 * Pemetaan (Pedoman Layanan SIGAP):
 *   Kritis  -> Darurat   : respons 1x24 jam, selesai 3 hari kerja
 *   Tinggi  -> Prioritas : respons 3x24 jam, selesai 7 hari kerja
 *   Sedang  -> Umum      : respons 5 hari,  selesai 14 hari kerja
 *   Rendah  -> Umum      : respons 5 hari,  selesai 14 hari kerja
 */
class SlaCalculator
{
    /**
     * Tenggat penyelesaian: N hari KERJA setelah waktu acuan.
     * Sabtu & Minggu dilewati; hari libur nasional dapat ditambahkan kemudian.
     */
    public function dueAt(TicketImpact $impact, ?CarbonInterface $from = null): CarbonInterface
    {
        $from = $from ? Carbon::parse($from) : Carbon::now();

        return $this->addWorkingDays($from->copy(), $impact->resolveDays());
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
     */
    public function status(bool $isOpen, ?CarbonInterface $due, CarbonInterface $now): string
    {
        if ($due === null) {
            return 'berjalan';
        }

        if ($isOpen) {
            return $due->isPast() ? 'terlambat' : 'berjalan';
        }

        return 'terpenuhi';
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