<?php

namespace App\Enums;

enum TicketVisibility: string
{
    case Publik = 'publik';
    case Anonim = 'anonim';
    case Rahasia = 'rahasia';

    public function label(): string
    {
        return match ($this) {
            self::Publik => 'Publik',
            self::Anonim => 'Anonim',
            self::Rahasia => 'Rahasia',
        };
    }

    /** Identitas pelapor perlu disembunyikan. */
    public function hidesIdentity(): bool
    {
        return in_array($this, [self::Anonim, self::Rahasia], true);
    }

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}