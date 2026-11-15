import { describe, expect, it } from 'vitest';

import { bacaKunci } from '@/server/legacy/laravel-crypt';
import { hashSandi, verifikasiSandi } from '@/server/legacy/sandi';
import { hashSandiUntukSesi } from '@/server/legacy/sesi';

import { fixture, type FixtureSandi } from './fixture';

const f = fixture<FixtureSandi>('sandi.json');
const LAMBAT = 60_000; // bcrypt cost 12 di bcryptjs ±0,2–0,4 dtk per cek

describe('sandi: vektor Hash::make / Hash::check (bcrypt $2y$ cost 12)', () => {
    it.each(f.kasus)(
        'verifikasi hash Laravel untuk $sandi',
        async ({ hash, cek, perlu_rehash }) => {
            expect(hash).toMatch(/^\$2y\$12\$/);
            expect(perlu_rehash).toBe(false);
            for (const c of cek) expect(await verifikasiSandi(c.sandi, hash), c.sandi).toBe(c.hasil);
        },
        LAMBAT,
    );

    it.each(f.negatif)('negatif $label sama dengan Laravel', async ({ hash, galat, hasil }) => {
        if (galat) await expect(verifikasiSandi('rahasia123', hash)).rejects.toThrow(galat.pesan);
        else expect(await verifikasiSandi('rahasia123', hash)).toBe(hasil);
    });

    it(
        'hashSandi menghasilkan $2y$12$ yang terverifikasi',
        async () => {
            const hash = await hashSandi('Sandi Baru ñ 🙂');
            expect(hash).toMatch(/^\$2y\$12\$[./A-Za-z0-9]{53}$/);
            expect(await verifikasiSandi('Sandi Baru ñ 🙂', hash)).toBe(true);
            expect(await verifikasiSandi('Sandi Baru', hash)).toBe(false);
        },
        LAMBAT,
    );

    it('hashSandi menolak NUL seperti Laravel', async () => {
        await expect(hashSandi('a\0b')).rejects.toThrow(f.galat_make_nul!.pesan);
    });

    it('password_hash_web = hashPasswordForCookie dengan APP_KEY mentah', () => {
        const kunci = bacaKunci(f.app_key);
        for (const k of f.kasus) expect(hashSandiUntukSesi(k.hash, kunci)).toBe(k.password_hash_web);
    });
});
