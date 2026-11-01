<?php

namespace App\Modules\Ai;

use App\Enums\UserRole;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Cache;

/**
 * Anggaran token harian (PRD-AI FR-AI-03): `AI_DAILY_TOKEN_BUDGET` (0 = tanpa
 * batas). Lewat 80% → Super Admin diberi tahu sekali per hari; lewat 100% →
 * semua tugas memakai cadangan sampai tengah malam WIB dan Super Admin
 * diberi tahu lagi (sekali per hari).
 */
final class TokenBudget
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function exhausted(): bool
    {
        $limit = $this->limit();

        return $limit > 0 && $this->used() >= $limit;
    }

    public function add(int $tokens): void
    {
        if ($tokens <= 0) {
            return;
        }

        $key = $this->key();
        Cache::add($key, 0, now()->addDays(2));
        $used = (int) Cache::increment($key, $tokens);

        $limit = $this->limit();
        if ($limit <= 0) {
            return;
        }
        // Satu panggilan bisa melewati 80% dan 100% sekaligus: cukup kabar "habis".
        if ($used >= $limit && Cache::add($key.':habis', true, now()->addDays(2))) {
            Cache::add($key.':diberitahu', true, now()->addDays(2));
            $this->warnExhausted($used, $limit);
        } elseif ($used >= $limit * 0.8 && Cache::add($key.':diberitahu', true, now()->addDays(2))) {
            $this->warn($used, $limit);
        }
    }

    public function used(): int
    {
        return (int) Cache::get($this->key(), 0);
    }

    /** Batas token per hari; 0 = tanpa batas. */
    public function limit(): int
    {
        return max(0, (int) config('services.ai.daily_token_budget', 0));
    }

    private function key(): string
    {
        return 'ai:token:'.now('Asia/Jakarta')->format('Y-m-d');
    }

    private function warn(int $used, int $limit): void
    {
        $percent = (int) floor($used / $limit * 100);
        $this->send('ai_anggaran', 'Anggaran token AI hampir habis', "Pemakaian token AI hari ini {$percent}% dari anggaran ({$used} dari {$limit}). Bila habis, TARA meneruskan semua percakapan ke petugas sampai tengah malam WIB.", $used, $limit);
    }

    private function warnExhausted(int $used, int $limit): void
    {
        $this->send('ai_anggaran_habis', 'Anggaran token AI habis', "Anggaran token AI hari ini sudah habis ({$used} dari {$limit}). TARA meneruskan semua percakapan ke petugas sampai tengah malam WIB. Naikkan AI_DAILY_TOKEN_BUDGET bila perlu.", $used, $limit);
    }

    private function send(string $event, string $title, string $body, int $used, int $limit): void
    {
        $this->notifications->notify([
            'event' => $event,
            'subject' => "[Contact Center] {$title}",
            'title' => $title,
            'body' => $body,
            'message' => $body,
            'cta_url' => '/admin/kesehatan-ai',
            'cta_label' => 'Buka Kesehatan AI',
            'meta' => ['Terpakai' => (string) $used, 'Anggaran' => (string) $limit],
        ], User::query()->where('is_active', true)->where('role', UserRole::SuperAdmin->value)->orderBy('id')->get());
    }
}
