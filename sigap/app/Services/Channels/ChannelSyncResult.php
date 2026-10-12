<?php

namespace App\Services\Channels;

/** Hasil satu siklus sinkronisasi kanal. */
final class ChannelSyncResult
{
    public function __construct(
        public readonly string $channel,
        public readonly int $pulledCount,
        public readonly string $status = 'berhasil',
        public readonly ?string $message = null,
        public readonly bool $stub = true,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'channel' => $this->channel,
            'pulled_count' => $this->pulledCount,
            'status' => $this->status,
            'message' => $this->message,
            'stub' => $this->stub,
        ];
    }
}
