<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Detail tiket untuk PETUGAS (GET /api/v1/admin/tickets/{nomor}).
 *
 * Kunci JSON sama dengan {@see TicketResource} agar klien tidak berubah, tetapi
 * identitas pelapor & nama petugas ditampilkan (akses sudah dibatasi Policy).
 * NIK tetap disamarkan sebagian.
 */
class TicketAdminDetailResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'nomor' => $this->ticket_no,
            // Kode akses pelacakan — dapat diberikan petugas kepada pelapor.
            'kode_akses' => $this->lookup_token,
            'judul' => $this->title,
            'deskripsi' => $this->description,
            'status' => $this->status?->value,
            'prioritas' => $this->priority?->value,
            'impact' => $this->impact?->value,
            'visibility' => $this->visibility?->value,
            'kategori' => $this->whenLoaded('category', fn () => $this->category?->name),
            'kawasan' => $this->whenLoaded('region', fn () => $this->region?->name),
            'kanal' => $this->whenLoaded('channel', fn () => $this->channel?->name),
            'petugas' => $this->whenLoaded('assignee', fn () => $this->assignee?->name),
            'pelapor' => $this->reporter_name,
            'nik' => $this->maskedNik(),
            'email' => $this->reporter_email,
            'telepon' => $this->reporter_phone,
            'nip' => $this->reporter_nip,
            'unit' => $this->reporter_unit,
            'lokasi' => $this->location,
            'sumber_laporan' => $this->source,
            'tautan' => $this->source_url,
            'admin_penerima' => $this->received_by,
            'created_at' => $this->created_at?->toIso8601String(),
            'tenggat_sla' => $this->sla_due_at?->toIso8601String(),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'is_internal' => (bool) $this->is_internal,
            'transisi' => $this->status
                ? array_map(fn ($s) => $s->value, $this->status->allowedTransitions())
                : [],
            'riwayat' => $this->whenLoaded('histories', fn () => $this->histories->map(fn ($h) => [
                'dari' => $h->from_status,
                'ke' => $h->to_status,
                'catatan' => $h->note,
                'oleh' => $h->relationLoaded('actor') ? $h->actor?->name : null,
                'pada' => $h->created_at?->toIso8601String(),
            ])),
            'tanggapan' => $this->whenLoaded('replies', fn () => $this->replies
                ->map(fn ($r) => [
                    'id' => $r->id,
                    'author' => $r->author?->name ?? 'Pelapor',
                    'body' => $r->body,
                    'is_public' => (bool) $r->is_public,
                    'created_at' => $r->created_at?->toIso8601String(),
                ])->values()),
        ];
    }
}
