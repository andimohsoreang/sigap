import { inspect } from 'node:util';

import { describe, expect, it } from 'vitest';

import { bacaKunci, base64Ketat, dekripsi, enkripsi, GalatDekripsi } from '@/server/legacy/laravel-crypt';

import { fixture, kunciUji, type FixtureEnkripsi } from './fixture';

const f = fixture<FixtureEnkripsi>('enkripsi.json');
const kunci = kunciUji(f);

describe('laravel-crypt: vektor Crypt::encryptString', () => {
    it.each(f.kasus)('dekripsi $label', ({ payload, plaintext }) => {
        expect(dekripsi(payload, kunci)).toBe(plaintext);
    });

    it.each(f.negatif)('negatif $label sama dengan Laravel', ({ payload, galat, plaintext }) => {
        if (galat) {
            expect(() => dekripsi(payload, kunci)).toThrow(new GalatDekripsi(galat.pesan));
        } else {
            expect(dekripsi(payload, kunci)).toBe(plaintext);
        }
    });

    it('payload kunci sebelumnya ditolak bila APP_PREVIOUS_KEYS kosong', () => {
        const tanpaLama = bacaKunci(f.app_key);
        const lama = f.kasus.find((k) => k.kunci === 'sebelumnya')!;
        expect(() => dekripsi(lama.payload, tanpaLama)).toThrow('The MAC is invalid.');
    });
});

describe('laravel-crypt: enkripsi', () => {
    it.each(f.kasus.filter((k) => k.kunci === 'sekarang'))('bolak-balik $label', ({ plaintext }) => {
        expect(dekripsi(enkripsi(plaintext, kunci), kunci)).toBe(plaintext);
    });

    it('amplop identik format Laravel: urutan kunci, iv 16 byte, mac hex, tag kosong, tanpa escape "/"', () => {
        const json = Buffer.from(enkripsi('x'.repeat(100), kunci), 'base64').toString('utf8');
        const a = JSON.parse(json);
        expect(Object.keys(a)).toEqual(['iv', 'value', 'mac', 'tag']);
        expect(Buffer.from(a.iv, 'base64')).toHaveLength(16);
        expect(a.mac).toMatch(/^[0-9a-f]{64}$/);
        expect(a.tag).toBe('');
        expect(json).not.toContain('\\/');
        // IV acak: dua enkripsi plaintext sama berbeda.
        expect(enkripsi('sama', kunci)).not.toBe(enkripsi('sama', kunci));
    });

    it('menolak payload terlalu besar dan bukan string', () => {
        expect(() => dekripsi('A'.repeat(4 * 1024 * 1024 + 4), kunci)).toThrow('The payload is invalid.');
        expect(() => dekripsi(123, kunci)).toThrow('The payload is invalid.');
    });
});

describe('laravel-crypt: kunci', () => {
    it('parseKey: base64 & mentah 32 byte, selain itu galat', () => {
        expect(bacaKunci('a'.repeat(32)).kunci).toHaveLength(32);
        expect(() => bacaKunci('')).toThrow('No application encryption key');
        expect(() => bacaKunci('base64:' + Buffer.alloc(16).toString('base64'))).toThrow('incorrect key length');
        expect(() => bacaKunci(f.app_key, ' ' + f.app_previous_keys)).toThrow('incorrect key length');
    });

    it('kunci tidak pernah tampil lewat JSON.stringify atau util.inspect', () => {
        const rahasia = Buffer.from(f.app_key.slice(7), 'base64').toString('hex');
        for (const teks of [JSON.stringify({ kunci }), inspect({ kunci }, { depth: 5 }), `${inspect(kunci, { showHidden: true })}`]) {
            expect(teks).toContain('[KunciLaravel]');
            expect(teks).not.toContain(f.app_key);
            expect(teks).not.toContain(f.app_key.slice(7));
            expect(teks).not.toContain(rahasia);
        }
    });

    it('APP_PREVIOUS_KEYS: explode(",") + array_filter', () => {
        expect(bacaKunci(f.app_key, `,${f.app_previous_keys},0,`).sebelumnya).toHaveLength(1);
        expect(bacaKunci(f.app_key).sebelumnya).toEqual([]);
    });

    it('base64Ketat mengikuti base64_decode($s, true) PHP', () => {
        expect(base64Ketat('YQ')?.toString()).toBe('a');
        expect(base64Ketat('YQ==')?.toString()).toBe('a');
        expect(base64Ketat('Y Q==\n')?.toString()).toBe('a');
        expect(base64Ketat('Y')).toBeNull();
        expect(base64Ketat('YQ=')).toBeNull();
        expect(base64Ketat('YQ==YQ==')).toBeNull();
        expect(base64Ketat('!!')).toBeNull();
    });
});
