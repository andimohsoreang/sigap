<?php

namespace App\Enums;

enum UserRole: string
{
    case Warga = 'warga';
    case Pegawai = 'pegawai';
    case AdminKawasan = 'admin_kawasan';
    case SuperAdmin = 'super_admin';

    public function label(): string
    {
        return match ($this) {
            self::Warga => 'Warga',
            self::Pegawai => 'Pegawai Internal',
            self::AdminKawasan => 'Admin Kawasan',
            self::SuperAdmin => 'Super Admin',
        };
    }

    /** Peran yang boleh mengakses panel admin SIGAP. */
    public function isAdmin(): bool
    {
        return in_array($this, [self::AdminKawasan, self::SuperAdmin], true);
    }

    /** @return array<int, string> */
    public static function adminValues(): array
    {
        return [self::AdminKawasan->value, self::SuperAdmin->value];
    }
}