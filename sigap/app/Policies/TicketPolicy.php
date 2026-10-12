<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\Ticket;
use App\Models\User;

/**
 * Otorisasi tiket (SEC-07).
 *
 * - Warga hanya boleh mengakses tiket miliknya.
 * - Admin kawasan hanya wilayah tugasnya.
 * - Super admin akses penuh.
 */
class TicketPolicy
{
    /** Lihat daftar & detail tiket di panel admin. */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    /** Terbitkan tiket dari input manual (admin/agen). */
    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    public function view(User $user, Ticket $ticket): bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        if ($user->role === UserRole::AdminKawasan) {
            return $ticket->region_id !== null && $ticket->region_id === $user->region_id;
        }

        // Warga: hanya tiket miliknya.
        return $ticket->reporter_id !== null && $ticket->reporter_id === $user->id;
    }

    /** Ubah status / kelola tiket. */
    public function update(User $user, Ticket $ticket): bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        return $user->role === UserRole::AdminKawasan
            && $ticket->region_id !== null
            && $ticket->region_id === $user->region_id;
    }

    public function reply(User $user, Ticket $ticket): bool
    {
        return $this->update($user, $ticket);
    }

    /**
     * Daftar & statistik tiket internal pegawai (A-05): super admin saja,
     * karena tiket internal tidak terikat kawasan mana pun.
     */
    public function viewInternal(User $user): bool
    {
        return $user->isSuperAdmin();
    }

    /** Kelola master data (kawasan, kanal, admin, pengaturan). */
    public function manageMaster(User $user): bool
    {
        return $user->isAdmin();
    }

    public function manageAdmins(User $user): bool
    {
        return $user->isSuperAdmin();
    }
}
