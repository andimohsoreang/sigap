<?php

namespace App\Services\Channels;

use InvalidArgumentException;

/**
 * Memilih adapter kanal nasional berdasarkan tipe ('sp4n' | 'wbs').
 * Titik tunggal untuk menukar stub -> implementasi nyata (PRD D7).
 */
class ChannelAdapterManager
{
    /** @var array<string, class-string<PengaduanChannelAdapter>> */
    protected array $map = [
        'sp4n' => Sp4nLaporStubAdapter::class,
        'wbs' => WbsStubAdapter::class,
    ];

    public function for(string $type): PengaduanChannelAdapter
    {
        $type = strtolower($type);

        if (! isset($this->map[$type])) {
            throw new InvalidArgumentException("Adapter kanal tidak dikenal: {$type}");
        }

        return app($this->map[$type]);
    }

    /** @return array<int, string> */
    public function keys(): array
    {
        return array_keys($this->map);
    }
}
