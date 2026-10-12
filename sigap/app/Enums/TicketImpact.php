<?php

namespace App\Enums;

enum TicketImpact: string
{
    case Rendah = 'rendah';
    case Sedang = 'sedang';
    case Tinggi = 'tinggi';
    case Kritis = 'kritis';

    /**
     * Memetakan tingkat dampak (form "Tingkat Dampak") ke prioritas tiket.
     * Memperbaiki bug B1: sebelumnya tingkatDampak diabaikan sehingga semua
     * tiket menjadi prioritas "Sedang/umum".
     */
    public function priority(): TicketPriority
    {
        return match ($this) {
            self::Kritis => TicketPriority::Darurat,
            self::Tinggi => TicketPriority::Prioritas,
            self::Sedang, self::Rendah => TicketPriority::Umum,
        };
    }

    /** Target penyelesaian (hari kerja) sesuai Pedoman Layanan SIGAP. */
    public function resolveDays(): int
    {
        return match ($this) {
            self::Kritis => 3,
            self::Tinggi => 7,
            self::Sedang, self::Rendah => 14,
        };
    }

    /** Target respons awal (jam) sesuai Pedoman Layanan SIGAP. */
    public function responseHours(): int
    {
        return match ($this) {
            self::Kritis => 24,
            self::Tinggi => 72,
            self::Sedang, self::Rendah => 120,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Rendah => 'Rendah',
            self::Sedang => 'Sedang',
            self::Tinggi => 'Tinggi',
            self::Kritis => 'Kritis',
        };
    }

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}