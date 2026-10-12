<?php

namespace App\Enums;

enum ChannelType: string
{
    case Sosmed = 'sosmed';
    case Kantor = 'kantor';
    case Nasional = 'nasional';
    case Internal = 'internal';

    public function label(): string
    {
        return match ($this) {
            self::Sosmed => 'Media Sosial',
            self::Kantor => 'Kantor Pemerintahan',
            self::Nasional => 'Kanal Nasional',
            self::Internal => 'Internal',
        };
    }

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}