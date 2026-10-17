<?php

namespace App\Console\Commands;

use App\Services\ReferralService;
use Illuminate\Console\Command;

/**
 * Ingatkan penanggung jawab atas rujukan yang lewat batas tindak lanjut atau
 * warganya meminta bantuan (dijadwalkan pagi hari kerja).
 */
class ReferralReminderCommand extends Command
{
    protected $signature = 'sigap:pantau-rujukan';

    protected $description = 'Ingatkan petugas atas rujukan portal yang perlu tindak lanjut';

    public function handle(ReferralService $referrals): int
    {
        $count = $referrals->remindOverdue();
        $this->line("{$count} rujukan perlu tindak lanjut.");

        return self::SUCCESS;
    }
}
