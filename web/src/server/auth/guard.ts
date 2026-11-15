// Guard rute sebagai fungsi murni: masukan = permintaan + pengguna, keluaran = keputusan berbentuk respons Laravel.
// Sumber (laravel-baseline):
// - `auth`  : Illuminate\Auth\Middleware\Authenticate → AuthenticationException → Handler::unauthenticated
//             (JSON 401 {"message":"Unauthenticated."}, selain itu redirect()->guest(route('masuk')));
// - `guest` : RedirectIfAuthenticated → redirect(route('home')) (bootstrap/app.php redirectUsersTo);
// - `role`  : sigap/app/Http/Middleware/EnsureRole.php;
// - `portal.verified`: sigap/app/Http/Middleware/EnsurePortalVerified.php;
// - pemasangan per rute: sigap/routes/web.php & api.php (grup prefix + middleware).

import { adalahAdmin, PERAN_ADMIN, terverifikasiPortal, type Pengguna, type Peran } from './peran';

export interface KonteksGuard {
    metode: string;
    /** pathname mentah (belum didekode). */
    jalur: string;
    /** path + query permintaan (untuk url.intended pada GET). */
    jalurPenuh: string;
    /** shouldRenderJsonWhen: `is('api/*') || expectsJson()`. */
    json: boolean;
    /** `expectsJson()` saja (EnsurePortalVerified memakai ini, bukan shouldRenderJsonWhen). */
    inginJson: boolean;
    /** `$request->path()` terdekode (tanpa '/' awal). */
    path: string;
    /** previous(): Referer yang sudah disaring jalurAman (null → '/'). */
    sebelumnya: string | null;
}

export type Keputusan =
    | { jenis: 'lanjut' }
    | {
          jenis: 'redirect';
          ke: string;
          /** Simpan url.intended (redirect()->guest). */
          intended?: string;
          /** Flash (`->with(...)`) di sesi setelah keputusan diterapkan. */
          kilat?: Record<string, unknown>;
          /** Keluarkan & invalidasi sesi dulu (akun nonaktif). */
          keluarkan?: boolean;
          /** Catat audit auth.blocked_inactive. */
          audit?: boolean;
      }
    | { jenis: 'json'; status: number; body: unknown; keluarkan?: boolean; audit?: boolean }
    | { jenis: 'galat'; status: number; pesan?: string };

export type Langkah = 'masuk' | 'tamu' | 'portal' | { peran: readonly Peran[] };

const LANJUT: Keputusan = { jenis: 'lanjut' };

/** Middleware `auth` (guard web/sanctum berbasis sesi). */
export function wajibMasuk(k: KonteksGuard, p: Pengguna | null): Keputusan {
    if (p) return LANJUT;
    if (k.json) return { jenis: 'json', status: 401, body: { message: 'Unauthenticated.' } };
    // Redirector::guest: GET non-JSON → URL penuh permintaan; selain itu previous() (Referer, bawaan '/').
    const intended = k.metode === 'GET' && !k.inginJson ? k.jalurPenuh : (k.sebelumnya ?? '/');
    return { jenis: 'redirect', ke: '/masuk', intended };
}

/** Middleware `guest`. */
export function wajibTamu(p: Pengguna | null): Keputusan {
    return p ? { jenis: 'redirect', ke: '/' } : LANJUT;
}

const PESAN_NONAKTIF = 'Akun Anda dinonaktifkan. Hubungi admin Contact Center.';
const PESAN_PERAN = 'Akses khusus petugas';

/** EnsureRole::handle. */
export function wajibPeran(k: KonteksGuard, p: Pengguna | null, peran: readonly Peran[]): Keputusan {
    if (!p) {
        return k.json
            ? { jenis: 'json', status: 401, body: { authenticated: false, error: 'Silakan masuk terlebih dahulu.' } }
            : { jenis: 'redirect', ke: '/masuk' };
    }
    if (!p.isActive) {
        return k.json
            ? { jenis: 'json', status: 403, body: { authenticated: false, error: PESAN_NONAKTIF }, keluarkan: true, audit: true }
            : { jenis: 'redirect', ke: '/masuk', kilat: { error: PESAN_NONAKTIF }, keluarkan: true, audit: true };
    }
    if ((peran as readonly string[]).includes(p.role)) return LANJUT;
    if (k.json) return { jenis: 'json', status: 403, body: { authenticated: true, error: PESAN_PERAN } };
    // Salah area → dialihkan ke area sendiri; di area sendiri → 403 (str_starts_with pada path tanpa '/').
    if (adalahAdmin(p)) return k.path.startsWith('admin') ? { jenis: 'galat', status: 403, pesan: PESAN_PERAN } : { jenis: 'redirect', ke: '/admin' };
    if (p.role === 'warga') {
        return k.path.startsWith('portal-warga') ? { jenis: 'galat', status: 403, pesan: PESAN_PERAN } : { jenis: 'redirect', ke: '/portal-warga' };
    }
    return { jenis: 'galat', status: 403, pesan: PESAN_PERAN };
}

/** EnsurePortalVerified: JSON → abort(403) berpesan; selain itu Redirect::guest(route('verification.notice')). */
export function wajibPortalTerverifikasi(k: KonteksGuard, p: Pengguna | null): Keputusan {
    if (!p || terverifikasiPortal(p)) return LANJUT;
    if (k.inginJson) return { jenis: 'galat', status: 403, pesan: 'Alamat surel Anda belum diverifikasi.' };
    return { jenis: 'redirect', ke: '/verifikasi-email', intended: k.metode === 'GET' ? k.jalurPenuh : (k.sebelumnya ?? '/') };
}

const ADMIN = { peran: PERAN_ADMIN } as const;
const SUPER = { peran: ['super_admin'] as const } as const;

/**
 * Middleware per rute dari routes/web.php & api.php, dicocokkan dengan path terdekode. Aturan pertama yang cocok
 * dipakai, jadi yang lebih spesifik (super_admin) di atas. Tidak membedakan rute yang tidak ada (Laravel: 404
 * sebelum middleware) — rute itu tetap 404 di Next.js setelah guard lolos.
 */
export const ATURAN_RUTE: readonly { pola: RegExp; metode?: readonly string[]; langkah: readonly Langkah[] }[] = [
    // web.php:192-212 grup role:super_admin di dalam /admin
    { pola: /^admin\/(petugas|unit-kerja|log-aktivitas|kesehatan-ai|admins)(\/|$)/, langkah: ['masuk', ADMIN, SUPER] },
    { pola: /^admin\/tiket\/[^/]+\/disposisi$/, metode: ['POST', 'DELETE'], langkah: ['masuk', ADMIN, SUPER] },
    // web.php:132 grup /admin
    { pola: /^admin(\/|$)/, langkah: ['masuk', ADMIN] },
    // web.php:216 grup /portal-warga
    { pola: /^portal-warga(\/|$)/, langkah: ['masuk', { peran: ['warga'] }, 'portal'] },
    // web.php:73-84 grup guest
    { pola: /^(masuk|daftar|lupa-sandi|atur-ulang-sandi)(\/|$)/, langkah: ['tamu'] },
    // web.php:85 & 88-95
    { pola: /^keluar$/, metode: ['POST'], langkah: ['masuk'] },
    { pola: /^verifikasi-email(\/|$)/, langkah: ['masuk'] },
    // api.php:45,59,67,89 (auth:sanctum berbasis sesi; token Bearer menyusul di S15)
    { pola: /^api\/v1\/auth\/logout$/, metode: ['POST'], langkah: ['masuk'] },
    { pola: /^api\/v1\/warga(\/|$)/, langkah: ['masuk', { peran: ['warga'] }] },
    { pola: /^api\/v1\/admin\/admins$/, langkah: ['masuk', ADMIN, SUPER] },
    { pola: /^api\/v1\/admin(\/|$)/, langkah: ['masuk', ADMIN] },
];

/** Langkah guard untuk permintaan (kosong = rute publik). */
export function langkahRute(metode: string, path: string): readonly Langkah[] {
    const p = path.replace(/\/{2,}/g, '/');
    return ATURAN_RUTE.find((a) => a.pola.test(p) && (!a.metode || a.metode.includes(metode)))?.langkah ?? [];
}

/** Jalankan langkah berurutan; keputusan pertama yang bukan 'lanjut' menang (urutan middleware Laravel). */
export function jalankanGuard(k: KonteksGuard, p: Pengguna | null, langkah: readonly Langkah[]): Keputusan {
    for (const l of langkah) {
        const hasil =
            l === 'masuk'
                ? wajibMasuk(k, p)
                : l === 'tamu'
                  ? wajibTamu(p)
                  : l === 'portal'
                    ? wajibPortalTerverifikasi(k, p)
                    : wajibPeran(k, p, l.peran);
        if (hasil.jenis !== 'lanjut') return hasil;
    }
    return LANJUT;
}
