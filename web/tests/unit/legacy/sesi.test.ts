import { describe, expect, it } from 'vitest';

import { enkripsiCookie } from '@/server/legacy/cookie';
import { enkripsiByte } from '@/server/legacy/laravel-crypt';
import { ObjekPhp, serialize, type NilaiPhp } from '@/server/legacy/php-serial';
import {
    bacaSesi,
    cekHashSandi,
    GalatSesiTakDidukung,
    KUNCI_LOGIN,
    NAMA_COOKIE_SESI,
    perbaruiKunci,
    simpanSesi,
    umurSesiMenit,
    type BarisSesi,
} from '@/server/legacy/sesi';

import { fixture, keJson, kunciUji, type FixtureSesi, type KasusSesi } from './fixture';

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
        expect(f.lifetime_menit).toBe(umurSesiMenit(undefined));
        expect(f.serialization).toBe('php');
        expect(f.kunci_login).toBe(KUNCI_LOGIN);
    });
});

describe('sesi: vektor sessions.payload dari Store Laravel asli', () => {
    it.each(f.kasus)('$label', async (k) => {
        const sesi = (await baca(k))!;
        expect(sesi.id).toBe(k.baris.id);
        expect(sesi.ada).toBe(true);
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

    it('sesi dengan errors (ViewErrorBag): user terbaca, objek utuh byte demi byte', async () => {
        const k = kasus('warga_dengan_errors');
        const sesi = (await baca(k))!;
        expect(sesi.userId).toBe(102);
        expect(sesi.data.get('errors')).toBeInstanceOf(ObjekPhp);
        expect(serialize(sesi.data)).toBe(k.serial);
        // Request berikutnya: flash errors dibuang seperti ageFlashData.
        expect(perbaruiKunci(sesi.data, {}, kunci).data.has('errors')).toBe(false);
    });

    it('referensi di dalam payload → GalatSesiTakDidukung (bukan dikosongkan)', async () => {
        const k = kasus('tamu');
        const serial = 'a:2:{s:1:"a";i:1;s:1:"b";R:2;}';
        const payload = Buffer.from(enkripsiByte(Buffer.from(`s:${serial.length}:"${serial}";`), kunci), 'latin1').toString('base64');
        await expect(baca(k, { ...k.baris, payload })).rejects.toThrow(GalatSesiTakDidukung);
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
        expect(sesi).toEqual({ id: kasus('warga').baris.id, data: new Map(), userId: null, passwordHash: null, ada: false });
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

    it.each([
        ['baris ada (termasuk kedaluwarsa) → UPDATE saja', 'kedaluwarsa', true],
        ['baris tidak ada → INSERT … ON CONFLICT', null, false],
    ])('simpanSesi: %s', async (_, label, ada) => {
        const k = kasus('warga');
        // Cookie warga menunjuk id warga; baris kedaluwarsa diberi id yang sama.
        const sesiAda = (await baca(k, label ? { ...kasus(label).baris, id: k.baris.id } : null))!;
        expect(sesiAda.ada).toBe(ada);
        const disimpan: unknown[] = [];
        const hasil = await simpanSesi({
            sesi: sesiAda,
            perubahan: { simpan: { password_hash_web: 'baru' } },
            kunci,
            simpan: async (b) => void disimpan.push(b),
            sekarang: 123,
        });
        expect(hasil.passwordHash).toBe('baru');
        expect(hasil.ada).toBe(true);
        expect(disimpan).toEqual([{ id: k.baris.id, payload: expect.any(String), last_activity: 123, user_id: null, ada }]);
    });

    it('simpanSesi meneruskan user_id dari sesi', async () => {
        const warga = (await baca(kasus('warga')))!;
        const disimpan: { user_id: number | null }[] = [];
        await simpanSesi({ sesi: warga, perubahan: { hapus: ['success'] }, kunci, simpan: async (b) => void disimpan.push(b) });
        expect(disimpan[0].user_id).toBe(101);
    });

    it('SESSION_LIFETIME dari env, bawaan 120, bukan angka → galat', async () => {
        expect(umurSesiMenit('')).toBe(120);
        expect(umurSesiMenit(' 30 ')).toBe(30);
        expect(() => umurSesiMenit('2 jam')).toThrow('SESSION_LIFETIME');
        // Baris "tepat_batas" (now - 120 mnt) kedaluwarsa bila umur 119 menit.
        const k = kasus('tepat_batas');
        const lama = process.env.SESSION_LIFETIME;
        process.env.SESSION_LIFETIME = '119';
        try {
            expect((await baca(k))!.data.size).toBe(0);
        } finally {
            if (lama === undefined) delete process.env.SESSION_LIFETIME;
            else process.env.SESSION_LIFETIME = lama;
        }
    });

    it('kunci string angka disamakan dengan kunci int ("5" = 5)', () => {
        const awal = new Map<number | string, NilaiPhp>([[5, 'lama']]);
        const { data } = perbaruiKunci(awal, { simpan: { '5': 'baru' }, flash: { '7': 'f' } }, kunci);
        expect([...data.keys()].filter((x) => x === 5 || x === '5')).toEqual([5]);
        expect(data.get(5)).toBe('baru');
        expect(data.get(7)).toBe('f');
        expect(perbaruiKunci(data, { hapus: ['5'] }, kunci).data.has(5)).toBe(false);
        // Request berikutnya membuang flash berkunci int.
        expect(perbaruiKunci(data, {}, kunci).data.has(7)).toBe(false);
    });

    it('user id string di atas 2^53 diabaikan', async () => {
        const { payload } = perbaruiKunci(new Map([[KUNCI_LOGIN, '9007199254740993']]), {}, kunci);
        const k = kasus('warga');
        expect((await baca(k, { ...k.baris, payload }))!.userId).toBeNull();
    });

    it('cekHashSandi: users.password kosong → cocok (AuthenticateSession dilewati)', () => {
        expect(cekHashSandi('apa saja', '', kunci)).toBe('cocok');
        expect(cekHashSandi(null, null, kunci)).toBe('cocok');
    });

    it('kunci bertitik dan errors ditolak', () => {
        expect(() => perbaruiKunci(new Map(), { simpan: { 'url.intended': '/' } }, kunci)).toThrow('bertitik');
        expect(() => perbaruiKunci(new Map(), { flash: { errors: 'x' } }, kunci)).toThrow('errors');
        expect(() => perbaruiKunci(new Map(), { hapus: ['errors'] }, kunci)).toThrow('errors');
    });
});
