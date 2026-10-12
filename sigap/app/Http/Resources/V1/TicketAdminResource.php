<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Baris tiket untuk daftar admin. */
class TicketAdminResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'nomor_tiket' => $this->ticket_no,
            'judul' => $this->title,
            'status' => $this->status?->value,
            'created_at' => $this->created_at?->toIso8601String(),
            'tenggat_sla' => $this->sla_due_at?->toIso8601String(),
            'is_internal' => (bool) $this->is_internal,
            'nama_pelapor' => $this->reporter_name,
            'kategori' => $this->whenLoaded('category', fn () => $this->category?->name),
            'kawasan' => $this->whenLoaded('region', fn () => $this->region?->name),
            'prioritas' => $this->priority?->value,
            'impact' => $this->impact?->value,
        ];
    }
}