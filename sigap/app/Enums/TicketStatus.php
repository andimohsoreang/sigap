<?php

namespace App\Enums;

enum TicketStatus: string
{
    case Baru = 'baru';
    case Verifikasi = 'verifikasi';
    case Diproses = 'diproses';
    case Selesai = 'selesai';
    case Ditolak = 'ditolak';

    public function label(): string
    {
        return match ($this) {
            self::Baru => 'Menunggu',
            self::Verifikasi => 'Diverifikasi',
            self::Diproses => 'Diproses',
            self::Selesai => 'Selesai',
            self::Ditolak => 'Ditolak',
        };
    }

    /** Apakah tiket masih berjalan (belum terminal). */
    public function isOpen(): bool
    {
        return in_array($this, [self::Baru, self::Verifikasi, self::Diproses], true);
    }

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}