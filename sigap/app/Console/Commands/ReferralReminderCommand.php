<?php

namespace App\Console\Commands;

use App\Services\ReferralService;
use Illuminate\Console\Command;

/**
 * Pemantauan rujukan (dijadwalkan per jam pada jam kerja):
 * - warga diingatkan lewat chat ±1 hari setelah dirujuk bila belum ada kode;
 * - penanggung jawab diingatkan (sekali sehari) atas rujukan yang lewat batas
 *   atau warganya meminta bantuan.
 */
class ReferralReminderCommand extends Command
{
    protected $signature = 'sigap:pantau-rujukan';

    protected $description = 'Ingatkan petugas atas rujukan portal yang perlu tindak lanjut';

    public function handle(ReferralService $referrals): int
    {
        $citizens = $referrals->remindCitizens();
        $count = $referrals->remindOverdue();
        $this->line("{$citizens} warga diingatkan lewat chat.");
        $this->line("{$count} rujukan perlu tindak lanjut.");

        return self::SUCCESS;
    }
}
