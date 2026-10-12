<?php

namespace App\Policies;

use App\Models\User;

/**
 * Otorisasi atas akun & master data (SEC-07).
 *
 * `manageMaster`  : admin kawasan & super admin (kawasan, kanal, pengaturan).
 * `manageAdmins`  : super admin saja (kelola akun admin, integrasi).
 */
class UserPolicy
{
    public function manageMaster(User $user): bool
    {
        return $user->isAdmin();
    }

    public function manageAdmins(User $user): bool
    {
        return $user->isSuperAdmin();
    }
}