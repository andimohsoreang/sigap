<?php

namespace App\Console\Commands;

use App\Models\ChatConversation;
use App\Services\Ai\AssistantService;
use Illuminate\Console\Command;

/**
 * Penanda "TARA menyiapkan jawaban" yang terlalu lama (worker `queue-ai`
 * mati/macet) → percakapan diserahkan ke petugas dengan pesan `ai_gagal`
 * (PRD-AI §13). Dijadwalkan tiap 15 detik; ambang `AI_PENDING_TIMEOUT` (90 dtk)
 * dihitung sejak pesan diterima sehingga sudah mencakup waktu antre.
 */
class AiMacetCommand extends Command
{
    protected $signature = 'sigap:ai-macet';

    protected $description = 'Serahkan ke petugas percakapan yang jawaban TARA-nya macet di antrean';

    public function handle(AssistantService $assistant): int
    {
        $stuck = ChatConversation::query()
            ->whereNotNull('ai_pending_at')
            ->where('ai_pending_at', '<', now()->subSeconds(max(15, (int) config('services.ai.pending_timeout', 90))))
            ->get();

        foreach ($stuck as $conversation) {
            $conversation->forceFill(['ai_pending_at' => null])->save();
            $assistant->handoff($conversation, 'ai_gagal', null, 'Maaf, asisten sedang tidak dapat menjawab. Pesan Anda kami teruskan ke petugas.');
        }

        $this->info("{$stuck->count()} percakapan macet diserahkan ke petugas.");

        return self::SUCCESS;
    }
}
