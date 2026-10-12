<?php

namespace App\Http\Resources\V1;

use App\Enums\TicketVisibility;
use App\Models\Ticket;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Detail tiket untuk pelacakan PUBLIK (lacak & GET /api/v1/tiket).
 *
 * SEC-11 (B4): tiket internal tidak pernah dikembalikan oleh endpoint publik —
 * penyaringan dilakukan di controller.
 *
 * A-02: identitas selalu disamarkan, apa pun klasifikasinya:
 * - `pelapor` : "Anonim" untuk anonim/rahasia, selain itu nama tersamar
 *               ("Budi Santoso" -> "B*** S***").
 * - `nik`     : selalu null.
 * - `petugas` : selalu null (nama petugas tidak dipublikasikan).
 * - tanggapan : penulis "Petugas SIGAP" untuk petugas, "Pelapor" untuk pelapor.
 *
 * Data lengkap untuk admin tersedia di {@see TicketAdminDetailResource}.
 */
class TicketResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $visibility = $this->visibility;
        $hideIdentity = $visibility instanceof TicketVisibility && $visibility->hidesIdentity();

        return [
            'nomor' => $this->ticket_no,
            'judul' => $this->title,
            'deskripsi' => $this->description,
            'status' => $this->status?->value,
            'prioritas' => $this->priority?->value,
            'impact' => $this->impact?->value,
            'kategori' => $this->whenLoaded('category', fn () => $this->category?->name),
            'kawasan' => $this->whenLoaded('region', fn () => $this->region?->name),
            'kanal' => $this->whenLoaded('channel', fn () => $this->channel?->name),
            'petugas' => null,
            'pelapor' => $hideIdentity ? 'Anonim' : (Ticket::maskName($this->reporter_name) ?? 'Anonim'),
            'nik' => null,
            'created_at' => $this->created_at?->toIso8601String(),
            'tenggat_sla' => $this->sla_due_at?->toIso8601String(),
            'is_internal' => (bool) $this->is_internal,
            'riwayat' => $this->whenLoaded('histories', fn () => $this->histories->map(fn ($h) => [
                'dari' => $h->from_status,
                'ke' => $h->to_status,
                'pada' => $h->created_at?->toIso8601String(),
            ])),
            'tanggapan' => $this->whenLoaded('replies', fn () => $this->replies
                ->where('is_public', true)
                ->map(fn ($r) => [
                    'id' => $r->id,
                    'author' => $this->publicAuthor($r),
                    'body' => $r->body,
                    'is_public' => (bool) $r->is_public,
                    'created_at' => $r->created_at?->toIso8601String(),
                ])->values()),
        ];
    }

    /** Penulis tanggapan untuk publik: pelapor sendiri atau "Petugas SIGAP". */
    private function publicAuthor($reply): string
    {
        $isReporter = $reply->author_id === null
            || ($this->reporter_id !== null && $reply->author_id === $this->reporter_id);

        return $isReporter ? 'Pelapor' : 'Petugas SIGAP';
    }
}
