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

    /**
     * Transisi status yang diizinkan (A-20).
     *
     *   baru       -> verifikasi | diproses | ditolak
     *   verifikasi -> diproses | selesai | ditolak
     *   diproses   -> verifikasi | selesai | ditolak
     *   selesai    -> diproses            (dibuka kembali)
     *   ditolak    -> verifikasi          (ditinjau ulang)
     *
     * @return array<int, self>
     */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Baru => [self::Verifikasi, self::Diproses, self::Ditolak],
            self::Verifikasi => [self::Diproses, self::Selesai, self::Ditolak],
            self::Diproses => [self::Verifikasi, self::Selesai, self::Ditolak],
            self::Selesai => [self::Diproses],
            self::Ditolak => [self::Verifikasi],
        };
    }

    public function canTransitionTo(self $to): bool
    {
        return in_array($to, $this->allowedTransitions(), true);
    }

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
