<?php

namespace App\Enums;

enum TicketPriority: string
{
    case Umum = 'umum';
    case Prioritas = 'prioritas';
    case Darurat = 'darurat';

    public function label(): string
    {
        return match ($this) {
            self::Umum => 'Umum',
            self::Prioritas => 'Prioritas',
            self::Darurat => 'Darurat',
        };
    }

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}