// Policy sebagai fungsi murni, port sigap/app/Policies/TicketPolicy.php & UserPolicy.php (laravel-baseline).
// Perbandingan id memakai === seperti PHP (int vs int; null tidak pernah sama).

import { adalahAdmin, adalahSuperAdmin, type Pengguna } from './peran';

type P = Pick<Pengguna, 'id' | 'role' | 'regionId'>;

/** Kolom tiket yang dipakai TicketPolicy. */
export interface TiketPolicy {
    isInternal: boolean;
    reporterId: number | null;
}

export const TicketPolicy = {
    /** Lihat daftar & detail tiket di panel admin. */
    viewAny: (u: P) => adalahAdmin(u),
    /** Terbitkan tiket dari input manual. */
    create: (u: P) => adalahAdmin(u),
    view(u: P, t: TiketPolicy): boolean {
        if (adalahSuperAdmin(u)) return true;
        // Admin kawasan: semua pengaduan publik (tiket internal hanya super admin).
        if (u.role === 'admin_kawasan') return !t.isInternal;
        // Warga (dan peran lain): hanya tiket miliknya.
        return t.reporterId !== null && t.reporterId === u.id;
    },
    /** Ubah status / kelola tiket. */
    update: (u: P, t: TiketPolicy) => adalahSuperAdmin(u) || (u.role === 'admin_kawasan' && !t.isInternal),
    reply: (u: P, t: TiketPolicy) => TicketPolicy.update(u, t),
    /** Tiket internal pegawai: super admin saja. */
    viewInternal: (u: P) => adalahSuperAdmin(u),
    manageMaster: (u: P) => adalahAdmin(u),
    manageAdmins: (u: P) => adalahSuperAdmin(u),
};

export const UserPolicy = {
    manageMaster: (u: P) => adalahAdmin(u),
    /** Super admin, atau admin kawasan untuk kawasannya sendiri. */
    updateRegion: (u: P, region: { id: number }) => adalahSuperAdmin(u) || (adalahAdmin(u) && u.regionId !== null && u.regionId === region.id),
    manageAdmins: (u: P) => adalahSuperAdmin(u),
};
