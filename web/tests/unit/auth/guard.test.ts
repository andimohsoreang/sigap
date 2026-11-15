import { describe, expect, it } from 'vitest';

import { jalankanGuard, langkahRute, wajibMasuk, wajibPeran, wajibPortalTerverifikasi, wajibTamu, type KonteksGuard } from '@/server/auth/guard';
import type { Pengguna, Peran } from '@/server/auth/peran';
import { TicketPolicy, UserPolicy } from '@/server/auth/policy';

const pengguna = (role: Peran, lain: Partial<Pengguna> = {}): Pengguna => ({
    id: 7,
    name: 'Uji',
    username: 'uji',
    role,
    isActive: true,
    password: '$2y$04$x',
    emailVerifiedAt: new Date(),
    registeredBy: null,
    regionId: null,
    rememberToken: null,
    ...lain,
});

const ctx = (jalur: string, lain: Partial<KonteksGuard> = {}): KonteksGuard => {
    const [path] = jalur.split('?');
    return {
        metode: 'GET',
        jalur: path,
        jalurPenuh: jalur,
        json: path.startsWith('/api/'),
        inginJson: false,
        path: path.replace(/^\/+|\/+$/g, '') || '/',
        sebelumnya: null,
        ...lain,
    };
};

/** Jalankan aturan rute seperti proxy.ts. */
const akses = (jalur: string, p: Pengguna | null, lain: Partial<KonteksGuard> = {}) => {
    const k = ctx(jalur, lain);
    return jalankanGuard(k, p, langkahRute(k.metode, k.path));
};

describe('auth (Authenticate + Handler::unauthenticated)', () => {
    it('tamu GET halaman → redirect /masuk dengan url.intended = URL penuh', () => {
        expect(wajibMasuk(ctx('/admin/tiket?status=baru'), null)).toEqual({ jenis: 'redirect', ke: '/masuk', intended: '/admin/tiket?status=baru' });
    });
    it('tamu non-GET → intended = previous() (Referer, bawaan "/")', () => {
        expect(wajibMasuk(ctx('/keluar', { metode: 'POST', sebelumnya: '/chat' }), null)).toMatchObject({ intended: '/chat' });
        expect(wajibMasuk(ctx('/keluar', { metode: 'POST' }), null)).toMatchObject({ intended: '/' });
    });
    it('JSON / api → 401 {"message":"Unauthenticated."}', () => {
        expect(wajibMasuk(ctx('/api/v1/warga/profile'), null)).toEqual({ jenis: 'json', status: 401, body: { message: 'Unauthenticated.' } });
        expect(wajibMasuk(ctx('/admin', { json: true, inginJson: true }), null)).toMatchObject({ status: 401 });
    });
    it('login → lanjut', () => expect(wajibMasuk(ctx('/admin'), pengguna('warga')).jenis).toBe('lanjut'));
});

describe('guest (RedirectIfAuthenticated)', () => {
    it('login → redirect home /', () => {
        expect(wajibTamu(pengguna('warga'))).toEqual({ jenis: 'redirect', ke: '/' });
        expect(wajibTamu(null).jenis).toBe('lanjut');
        expect(akses('/masuk', pengguna('super_admin'), { metode: 'POST' })).toEqual({ jenis: 'redirect', ke: '/' });
        expect(akses('/atur-ulang-sandi/abc', pengguna('warga'))).toEqual({ jenis: 'redirect', ke: '/' });
    });
});

describe('EnsureRole', () => {
    const ADMIN = ['admin_kawasan', 'super_admin'] as const;

    it('AdminPanelTest: tamu → /masuk, warga di /admin → /portal-warga', () => {
        expect(akses('/admin', null)).toMatchObject({ jenis: 'redirect', ke: '/masuk' });
        expect(akses('/admin', pengguna('warga'))).toEqual({ jenis: 'redirect', ke: '/portal-warga' });
    });
    it('AdminPanelTest: admin_kawasan di rute super_admin → 403 "Akses khusus petugas", bukan redirect', () => {
        for (const j of ['/admin/petugas', '/admin/unit-kerja/3', '/admin/log-aktivitas', '/admin/kesehatan-ai', '/admin/admins']) {
            expect(akses(j, pengguna('admin_kawasan')), j).toEqual({ jenis: 'galat', status: 403, pesan: 'Akses khusus petugas' });
        }
        expect(akses('/admin/tiket/TKT-1/disposisi', pengguna('admin_kawasan'), { metode: 'POST' })).toMatchObject({ status: 403 });
        expect(akses('/admin/tiket/TKT-1/disposisi', pengguna('admin_kawasan')).jenis).toBe('lanjut');
        expect(akses('/admin/petugas', pengguna('super_admin')).jenis).toBe('lanjut');
        expect(akses('/admin/matriks', pengguna('admin_kawasan')).jenis).toBe('lanjut');
    });
    it('WargaPortalTest: tamu → /masuk, admin di portal → /admin; warga di admin → /portal-warga', () => {
        expect(akses('/portal-warga', null)).toMatchObject({ ke: '/masuk' });
        expect(akses('/portal-warga', pengguna('super_admin'))).toEqual({ jenis: 'redirect', ke: '/admin' });
        expect(akses('/portal-warga/profil', pengguna('warga'), { metode: 'PATCH' }).jenis).toBe('lanjut');
    });
    it('pegawai tidak punya area → 403 di mana pun', () => {
        expect(akses('/admin', pengguna('pegawai'))).toEqual({ jenis: 'galat', status: 403, pesan: 'Akses khusus petugas' });
        expect(akses('/portal-warga', pengguna('pegawai'))).toEqual({ jenis: 'galat', status: 403, pesan: 'Akses khusus petugas' });
    });
    it('warga di area sendiri pada rute khusus peran lain → 403 (str_starts_with path)', () => {
        expect(wajibPeran(ctx('/portal-warga/x'), pengguna('warga'), ['super_admin'])).toMatchObject({ status: 403 });
    });
    it('JSON: 403 {authenticated:true,error}, tamu 401 {authenticated:false,...}', () => {
        expect(akses('/api/v1/admin/tickets', pengguna('warga'))).toEqual({
            jenis: 'json',
            status: 403,
            body: { authenticated: true, error: 'Akses khusus petugas' },
        });
        expect(wajibPeran(ctx('/api/v1/admin'), null, ADMIN)).toEqual({
            jenis: 'json',
            status: 401,
            body: { authenticated: false, error: 'Silakan masuk terlebih dahulu.' },
        });
        expect(wajibPeran(ctx('/admin'), null, ADMIN)).toEqual({ jenis: 'redirect', ke: '/masuk' });
    });
    it('AccountSecurityTest: akun nonaktif → keluar + audit, redirect /masuk dengan flash error / JSON 403', () => {
        const nonaktif = pengguna('warga', { isActive: false });
        expect(akses('/portal-warga', nonaktif)).toEqual({
            jenis: 'redirect',
            ke: '/masuk',
            kilat: { error: 'Akun Anda dinonaktifkan. Hubungi admin Contact Center.' },
            keluarkan: true,
        });
        expect(akses('/api/v1/admin/tickets', pengguna('super_admin', { isActive: false }))).toMatchObject({
            jenis: 'json',
            status: 403,
            body: { authenticated: false, error: 'Akun Anda dinonaktifkan. Hubungi admin Contact Center.' },
            keluarkan: true,
        });
    });
    it('aturan super_admin API & path ganda/terenkode', () => {
        expect(akses('/api/v1/admin/admins', pengguna('admin_kawasan'))).toMatchObject({ status: 403 });
        expect(langkahRute('GET', 'admin//petugas')).toEqual(langkahRute('GET', 'admin/petugas'));
        expect(langkahRute('GET', 'administrasi')).toEqual([]);
        expect(langkahRute('GET', '/')).toEqual([]);
        expect(langkahRute('GET', 'keluar')).toEqual([]);
        expect(langkahRute('POST', 'keluar')).toEqual(['masuk']);
    });
});

describe('EnsurePortalVerified', () => {
    it('AkunWargaTest: belum verifikasi → /verifikasi-email (intended); didaftarkan petugas → lolos; JSON → 403 berpesan', () => {
        const belum = pengguna('warga', { emailVerifiedAt: null });
        expect(akses('/portal-warga', belum)).toEqual({ jenis: 'redirect', ke: '/verifikasi-email', intended: '/portal-warga' });
        expect(akses('/portal-warga', { ...belum, registeredBy: 3 }).jenis).toBe('lanjut');
        expect(wajibPortalTerverifikasi(ctx('/portal-warga', { inginJson: true }), belum)).toEqual({
            jenis: 'galat',
            status: 403,
            pesan: 'Alamat surel Anda belum diverifikasi.',
        });
    });
});

describe('TicketPolicy & UserPolicy (matriks lengkap)', () => {
    const PERAN: Peran[] = ['warga', 'pegawai', 'admin_kawasan', 'super_admin'];
    const tiket = (isInternal: boolean, reporterId: number | null) => ({ isInternal, reporterId });

    it('viewAny/create/manageMaster = admin; viewInternal/manageAdmins = super admin', () => {
        for (const r of PERAN) {
            const u = pengguna(r);
            const admin = r === 'admin_kawasan' || r === 'super_admin';
            expect([TicketPolicy.viewAny(u), TicketPolicy.create(u), TicketPolicy.manageMaster(u), UserPolicy.manageMaster(u)]).toEqual([
                admin,
                admin,
                admin,
                admin,
            ]);
            expect([TicketPolicy.viewInternal(u), TicketPolicy.manageAdmins(u), UserPolicy.manageAdmins(u)]).toEqual(
                Array(3).fill(r === 'super_admin'),
            );
        }
    });

    it('view/update/reply per peran × internal × pelapor', () => {
        const kasus: [Peran, boolean, number | null, boolean, boolean][] = [
            // peran, internal, reporterId, view, update(=reply)
            ['super_admin', true, null, true, true],
            ['super_admin', false, 99, true, true],
            ['admin_kawasan', false, null, true, true],
            ['admin_kawasan', true, 7, false, false],
            ['warga', false, 7, true, false],
            ['warga', false, 8, false, false],
            ['warga', false, null, false, false],
            ['warga', true, 7, true, false],
            ['pegawai', true, 7, true, false],
            ['pegawai', false, 1, false, false],
        ];
        for (const [r, internal, pelapor, view, update] of kasus) {
            const u = pengguna(r);
            const t = tiket(internal, pelapor);
            expect([TicketPolicy.view(u, t), TicketPolicy.update(u, t), TicketPolicy.reply(u, t)], `${r} ${internal} ${pelapor}`).toEqual([
                view,
                update,
                update,
            ]);
        }
    });

    it('updateRegion: super admin semua; admin kawasan hanya kawasannya; region_id null tidak pernah cocok', () => {
        expect(UserPolicy.updateRegion(pengguna('super_admin'), { id: 1 })).toBe(true);
        expect(UserPolicy.updateRegion(pengguna('admin_kawasan', { regionId: 1 }), { id: 1 })).toBe(true);
        expect(UserPolicy.updateRegion(pengguna('admin_kawasan', { regionId: 2 }), { id: 1 })).toBe(false);
        expect(UserPolicy.updateRegion(pengguna('admin_kawasan', { regionId: null }), { id: 1 })).toBe(false);
        expect(UserPolicy.updateRegion(pengguna('warga', { regionId: 1 }), { id: 1 })).toBe(false);
    });
});
