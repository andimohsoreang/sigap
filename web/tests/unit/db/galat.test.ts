import { DrizzleQueryError } from 'drizzle-orm';
import pg from 'pg';
import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { GalatUnik, petakanGalatDb } from '@/server/db/galat';
import { opsiLog } from '@/server/log';

const SUREL = 'warga.rahasia@contoh.id';
const TELEPON = '081299998888';

function galatDrizzle() {
    const pgErr = new pg.DatabaseError('duplicate key value violates unique constraint "users_email_unique"', 0, 'error');
    Object.assign(pgErr, { code: '23505', constraint: 'users_email_unique', detail: `Key (email)=(${SUREL}) already exists.` });
    return new DrizzleQueryError('insert into "users" ("email", "phone") values ($1, $2)', [SUREL, TELEPON], pgErr);
}

function catat(...arg: unknown[]) {
    const baris: string[] = [];
    const log = pino(opsiLog, { write: (s: string) => baris.push(s) });
    (log.error as (...a: unknown[]) => void)(...arg);
    return baris.join('\n');
}

describe('galat DB di log', () => {
    it('DrizzleQueryError langsung: tanpa params, detail, atau message asli', () => {
        for (const teks of [catat(galatDrizzle()), catat({ err: galatDrizzle() }, 'gagal')]) {
            expect(teks).not.toContain(SUREL);
            expect(teks).not.toContain(TELEPON);
            expect(JSON.parse(teks).err).toMatchObject({ type: 'GalatUnik', kode: '23505', constraint: 'users_email_unique' });
        }
    });

    it('DrizzleQueryError sebagai cause (bersarang) dan galat koneksi', () => {
        const luar = new Error('simpan tiket gagal', { cause: new Error('repo', { cause: galatDrizzle() }) });
        const koneksi = new DrizzleQueryError('select 1 where $1', [SUREL], new Error('Connection terminated unexpectedly'));
        const teks = catat({ err: luar }, 'gagal') + catat({ err: koneksi });

        expect(teks).not.toContain(SUREL);
        expect(teks).not.toContain(TELEPON);
        expect(teks).toContain('simpan tiket gagal');
        expect(teks).toContain('SQLSTATE 23505');
        expect(teks).toContain('Connection terminated unexpectedly');
        // Galat asli pemanggil tidak diubah.
        expect((luar.cause as Error).cause).toBeInstanceOf(DrizzleQueryError);
    });

    it('galat bukan DB dikembalikan apa adanya', () => {
        const e = new Error('domain');
        expect(petakanGalatDb(e)).toBe(e);
        expect(petakanGalatDb(galatDrizzle())).toBeInstanceOf(GalatUnik);
    });
});
