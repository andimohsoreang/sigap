<?php

namespace App\Policies;

use App\Models\Region;
use App\Models\User;

/**
 * Otorisasi atas akun & master data (SEC-07, A-05).
 *
 * `manageMaster`  : admin kawasan & super admin — MELIHAT halaman master
 *                   (kawasan, kanal, pengaturan).
 * `updateRegion`  : super admin, atau admin kawasan untuk kawasannya sendiri.
 * `manageAdmins`  : super admin saja — akun admin, integrasi, pengaturan
 *                   sistem, kategori, serta membuat/menghapus kawasan & kanal.
 */
class UserPolicy
{
    public function manageMaster(User $user): bool
    {
        return $user->isAdmin();
    }

    public function updateRegion(User $user, Region $region): bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        return $user->isAdmin()
            && $user->region_id !== null
            && $user->region_id === $region->id;
    }

    public function manageAdmins(User $user): bool
    {
        return $user->isSuperAdmin();
    }
}
