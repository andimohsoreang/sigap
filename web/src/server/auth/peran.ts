// Model peran & pengguna untuk auth (fungsi murni, tanpa DB): App\Enums\UserRole dan helper App\Models\User.

/** App\Enums\UserRole. */
export type Peran = 'warga' | 'pegawai' | 'admin_kawasan' | 'super_admin';
export const PERAN_ADMIN: readonly Peran[] = ['admin_kawasan', 'super_admin'];

/** Kolom `users` yang dipakai auth. */
export interface Pengguna {
    id: number;
    name: string;
    username: string | null;
    role: string;
    isActive: boolean;
    password: string;
    emailVerifiedAt: Date | null;
    registeredBy: number | null;
    regionId: number | null;
    rememberToken: string | null;
}

/** User::isAdmin (UserRole::isAdmin: admin_kawasan, super_admin). */
export const adalahAdmin = (p: Pick<Pengguna, 'role'>) => p.role === 'admin_kawasan' || p.role === 'super_admin';
/** User::isSuperAdmin. */
export const adalahSuperAdmin = (p: Pick<Pengguna, 'role'>) => p.role === 'super_admin';
/** User::isVerifiedForPortal: surel terverifikasi, atau didaftarkan petugas. */
export const terverifikasiPortal = (p: Pick<Pengguna, 'emailVerifiedAt' | 'registeredBy'>) => p.emailVerifiedAt !== null || p.registeredBy !== null;
