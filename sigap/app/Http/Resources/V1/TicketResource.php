<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Detail tiket untuk pelacakan publik.
 *
 * SEC-11 (memperbaiki bug B4): tiket internal tidak pernah dikembalikan oleh
 * endpoint publik — penyaringan dilakukan di controller, resource ini juga
 * menyembunyikan identitas sesuai klasifikasi privasi.
 */
class TicketResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $visibility = $this->visibility;
        $hideIdentity = $visibility instanceof \App\Enums\TicketVisibility
            ? $visibility->hidesIdentity()
            : false;

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
            'petugas' => $this->whenLoaded('assignee', fn () => $this->assignee?->name),
            'pelapor' => $hideIdentity ? 'Anonim' : $this->reporter_name,
            'nik' => $hideIdentity ? null : $this->maskedNik(),
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
                    'author' => $r->author?->name,
                    'body' => $r->body,
                    'is_public' => (bool) $r->is_public,
                    'created_at' => $r->created_at?->toIso8601String(),
                ])->values()),
        ];
    }
}