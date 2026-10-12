<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ChannelResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type?->value,
            'type_label' => $this->type?->label(),
            'name' => $this->name,
            'account_name' => $this->account_name,
            'url' => $this->url,
            'status' => $this->status,
            'last_synced_at' => $this->last_synced_at?->toIso8601String(),
        ];
    }
}
