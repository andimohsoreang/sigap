import { describe, expect, it } from 'vitest';

import { enkripsiCookie } from '@/server/legacy/cookie';
import { keJson, serialize } from '@/server/legacy/php-serial';
import {
    bacaSesi,
    cekHashSandi,
    GalatSesiTakDidukung,
    KUNCI_LOGIN,
    NAMA_COOKIE_SESI,
    perbaruiKunci,
    simpanSesi,
    UMUR_SESI_MENIT,
    type BarisSesi,
} from '@/server/legacy/sesi';

import { fixture, kunciUji, type FixtureSesi, type KasusSesi } from './fixture';

const f = fixture<FixtureSesi>('sesi.json');
const kunci = kunciUji(f);
const kasus = (label: string) => f.kasus.find((k) => k.label === label)!;

function baca(k: KasusSesi, baris: BarisSesi | null = k.baris) {
    return bacaSesi({
        cookieHeader: `XSRF-TOKEN=abc; ${NAMA_COOKIE_SESI}=${encodeURIComponent(k.cookie)}`,
        kunci,
        muat: async (id) => (id === baris?.id ? baris : null),
        sekarang: f.sekarang,
    });
}

describe('sesi: konfigurasi sama dengan Laravel', () => {
    it('nama cookie, umur, serialisasi, kunci login', () => {
        expect(f.cookie_sesi).toBe(NAMA_COOKIE_SESI);
        expect(f.lifetime_menit).toBe(UMUR_SESI_MENIT);
        expect(f.serialization).toBe('php');
        expect(f.kunci_login).toBe(KUNCI_LOGIN);
    });
});

describe('sesi: vektor sessions.payload dari Store Laravel asli', () => {
    it.each(f.kasus)('$label', async (k) => {
        if (k.harapan_galat) {
            await expect(baca(k)).rejects.toThrow(GalatSesiTakDidukung);
            return;
        }
        const sesi = (await baca(k))!;
        expect(sesi.id).toBe(k.baris.id);
        if (k.harapan_kosong) {
            expect(sesi.data.size).toBe(0);
            expect(sesi.userId).toBeNull();
            return;
        }
        expect(serialize(sesi.data)).toBe(k.serial);
        expect(keJson(sesi.data)).toEqual(k.data);
        expect(sesi.userId).toBe(k.harapan.user_id);
        expect(sesi.userId).toBe(k.baris.user_id);
        expect(sesi.passwordHash).toBe(k.harapan.password_hash);
    });

    it.each(f.password_hash_web)('cekHashSandi sama dengan AuthenticateSession::validatePasswordHash', ({ user_hash, tersimpan, cocok }) => {
        expect(cekHashSandi(tersimpan, user_hash, kunci)).toBe(cocok ? 'cocok' : 'beda');
        expect(cekHashSandi(null, user_hash, kunci)).toBe('kosong');
    });
});

describe('sesi: id dari cookie', () => {
    it('tanpa cookie, cookie rusak, atau id tidak 40 alfanumerik → null', async () => {
        const muat = async () => kasus('warga').baris;
        expect(await bacaSesi({ cookieHeader: null, kunci, muat })).toBeNull();
        expect(await bacaSesi({ cookieHeader: `${NAMA_COOKIE_SESI}=sampah`, kunci, muat })).toBeNull();
        const pendek = encodeURIComponent(enkripsiCookie(NAMA_COOKIE_SESI, 'pendek', kunci));
        expect(await bacaSesi({ cookieHeader: `${NAMA_COOKIE_SESI}=${pendek}`, kunci, muat })).toBeNull();
    });

    it('id sah tanpa baris → sesi kosong dengan id yang sama (Laravel memakai ulang id)', async () => {
        const sesi = await baca(kasus('warga'), null);
        expect(sesi).toEqual({ id: kasus('warga').baris.id, data: new Map(), userId: null, passwordHash: null });
    });

    it('payload tidak bisa didekripsi → sesi kosong (EncryptedStore)', async () => {
        const k = kasus('warga');
        const sesi = await baca(k, { ...k.baris, payload: Buffer.from('bukan payload').toString('base64') });
        expect(sesi!.data.size).toBe(0);
    });
});

describe('sesi: tulis seperti Store::save', () => {
    it('flash di request berikutnya identik byte dengan Laravel (ageFlashData)', async () => {
        const admin = (await baca(kasus('admin')))!;
        const { data, payload } = perbaruiKunci(admin.data, { flash: { error: 'Tiket tidak ditemukan.' } }, kunci);
        expect(serialize(data)).toBe(kasus('admin_request_berikutnya').serial);

        const lagi = await baca(kasus('admin'), { ...kasus('admin').baris, payload });
        expect(serialize(lagi!.data)).toBe(kasus('admin_request_berikutnya').serial);
    });

    it('flash pada sesi tamu membuat _flash dengan urutan seperti Laravel', async () => {
        const tamu = (await baca(kasus('tamu')))!;
        const { data } = perbaruiKunci(tamu.data, { flash: { success: 'ok' }, simpan: { chat_guest_token: 'x' } }, kunci);
        expect(keJson(data)).toMatchObject({ success: 'ok', chat_guest_token: 'x', _flash: { old: ['success'], new: [] } });
        // Request kedua tanpa flash baru membuang 'success'.
        expect(perbaruiKunci(data, {}, kunci).data.has('success')).toBe(false);
    });

    it('simpanSesi meneruskan baris ke penyimpan dengan user_id & last_activity', async () => {
        const warga = (await baca(kasus('warga')))!;
        const disimpan: unknown[] = [];
        const hasil = await simpanSesi({
            sesi: warga,
            perubahan: { simpan: { password_hash_web: 'baru' }, hapus: ['success'] },
            kunci,
            simpan: async (b) => void disimpan.push(b),
            sekarang: 123,
        });
        expect(hasil.passwordHash).toBe('baru');
        expect(disimpan).toEqual([{ id: warga.id, payload: expect.any(String), last_activity: 123, user_id: 101 }]);
    });

    it('kunci bertitik ditolak', () => {
        expect(() => perbaruiKunci(new Map(), { simpan: { 'url.intended': '/' } }, kunci)).toThrow('bertitik');
    });
});
