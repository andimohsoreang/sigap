import { describe, expect, it, vi } from 'vitest';

import { dekripsi } from '@/server/legacy/laravel-crypt';

import { fixture, kunciUji, type FixtureEnkripsi, type FixtureNik } from '../legacy/fixture';

const fe = fixture<FixtureEnkripsi>('enkripsi.json');
const fn = fixture<FixtureNik>('nik.json');
vi.stubEnv('APP_KEY', fe.app_key);
vi.stubEnv('APP_PREVIOUS_KEYS', fe.app_previous_keys);
vi.stubEnv('NIK_HASH_KEY', fn.kunci_nik.base64);
const { dariWib, keWib, keJsonLaravel, denganNikHash, denganReporterNikHash, hashNikApp } = await import('@/server/db/kolom');
const { users, tickets } = await import('@/server/db/schema');

describe('waktuWib', () => {
    it('membaca jam dinding WIB sebagai +07:00', () => {
        expect(dariWib('2026-11-14 10:00:00').toISOString()).toBe('2026-11-14T03:00:00.000Z');
        expect(dariWib('2026-01-01 00:00:00').toISOString()).toBe('2025-12-31T17:00:00.000Z');
    });

    it('menulis jam WIB dipotong ke detik: 23:59:59.999 tetap hari yang sama', () => {
        expect(keWib(new Date('2026-11-14T16:59:59.999Z'))).toBe('2026-11-14 23:59:59');
        expect(keWib(new Date('2026-11-14T17:00:00.000Z'))).toBe('2026-11-15 00:00:00');
        expect(keWib(dariWib('2026-11-14 10:00:00'))).toBe('2026-11-14 10:00:00');
    });

    it('menolak nilai yang bukan timestamp', () => {
        expect(() => keWib(new Date('bukan tanggal'))).toThrow('Waktu tidak valid.');
        expect(() => dariWib('infinity')).toThrow(/Format timestamp/);
    });

    it('format JSON Laravel: UTC, 6 digit mikrodetik', () => {
        expect(keJsonLaravel(dariWib('2026-11-14 10:00:00'))).toBe('2026-11-14T03:00:00.000000Z');
        expect(keJsonLaravel(new Date('2026-11-14T03:00:00.123Z'))).toBe('2026-11-14T03:00:00.123000Z');
        expect(keJsonLaravel(null)).toBeNull();
    });

    it('dipakai kolom timestamp skema', () => {
        expect(users.createdAt.mapToDriverValue(new Date('2026-11-14T03:00:00Z'))).toBe('2026-11-14 10:00:00');
        expect(tickets.slaDueAt.getSQLType()).toBe('timestamp(0) without time zone');
    });
});

describe('terenkripsi', () => {
    it('membaca ciphertext buatan Laravel (kunci sekarang & sebelumnya)', () => {
        for (const k of fe.kasus.slice(0, 6)) expect(users.nik.mapFromDriverValue(k.payload)).toBe(k.plaintext);
    });

    it('menulis format Crypt::encryptString dengan APP_KEY', () => {
        const payload = tickets.reporterNik.mapToDriverValue('3171234567890123') as string;
        expect(dekripsi(payload, kunciUji({ app_key: fe.app_key, app_previous_keys: '' }))).toBe('3171234567890123');
    });
});

describe('hash NIK (hook saving Laravel)', () => {
    const kasus = fn.kasus[0];

    it('sama dengan vektor PHP Nik::hash', () => {
        expect(hashNikApp(kasus.nik)).toBe(kasus.hash.base64);
    });

    it('diisi hanya bila kolom NIK ikut ditulis', () => {
        expect(denganNikHash({ nik: kasus.nik, name: 'A' })).toEqual({ nik: kasus.nik, name: 'A', nikHash: kasus.hash.base64 });
        expect(denganNikHash({ nik: null })).toEqual({ nik: null, nikHash: null });
        expect(denganNikHash({ name: 'A' })).toEqual({ name: 'A' });
        expect(denganReporterNikHash({ reporterNik: kasus.nik })).toEqual({ reporterNik: kasus.nik, reporterNikHash: kasus.hash.base64 });
    });
});
