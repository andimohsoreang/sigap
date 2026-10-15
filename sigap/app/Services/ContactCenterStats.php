<?php

namespace App\Services;

use App\Models\ChatConversation;
use App\Models\ChatMessage;

/**
 * Dua angka utama contact center (30 hari terakhir):
 * - persentase percakapan yang selesai tanpa petugas (dijawab AI dengan
 *   sumber dan tidak pernah diteruskan);
 * - median waktu tunggu sejak diteruskan sampai balasan pertama petugas.
 */
class ContactCenterStats
{
    /** @return array{percakapan: int, selesai_tanpa_petugas: int|null, tunggu_median_menit: int|null} */
    public function overview(int $days = 30): array
    {
        $conversations = ChatConversation::query()
            ->where('created_at', '>=', now()->subDays($days))
            ->where(fn ($q) => $q->where('handled_by', ChatConversation::HANDLED_AI)->orWhereNotNull('handoff_at'))
            ->get(['id', 'handoff_at']);

        if ($conversations->isEmpty()) {
            return ['percakapan' => 0, 'selesai_tanpa_petugas' => null, 'tunggu_median_menit' => null];
        }

        $ids = $conversations->pluck('id');
        $messages = ChatMessage::query()
            ->whereIn('conversation_id', $ids)
            ->whereIn('sender_type', ['ai', 'admin'])
            ->orderBy('id')
            ->get(['conversation_id', 'sender_type', 'meta', 'created_at']);

        $answered = $messages
            ->filter(fn (ChatMessage $m) => $m->sender_type === 'ai' && $m->kind() === 'jawaban')
            ->pluck('conversation_id')
            ->unique();

        $aiOnly = $conversations->whereNull('handoff_at')->whereIn('id', $answered)->count();

        $waits = $conversations->whereNotNull('handoff_at')->map(function (ChatConversation $c) use ($messages) {
            $first = $messages->first(fn (ChatMessage $m) => $m->conversation_id === $c->id
                && $m->sender_type === 'admin'
                && $m->created_at->greaterThanOrEqualTo($c->handoff_at));

            return $first ? $c->handoff_at->diffInMinutes($first->created_at) : null;
        })->filter(fn ($v) => $v !== null)->sort()->values();

        return [
            'percakapan' => $conversations->count(),
            'selesai_tanpa_petugas' => (int) round($aiOnly / $conversations->count() * 100),
            'tunggu_median_menit' => $waits->isEmpty() ? null : (int) round($waits->median()),
        ];
    }
}
