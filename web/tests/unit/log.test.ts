import { inspect } from 'node:util';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buatKlien } from '@/server/http/klien';
import { opsiLog } from '@/server/log';

import { serverUji } from './server-uji';

function logUji() {
    const baris: string[] = [];
    return { baris, log: pino(opsiLog, { write: (s: string) => baris.push(s) }) };
}

let srv: Awaited<ReturnType<typeof serverUji>>;

beforeAll(async () => {
    srv = await serverUji((_req, res) => res.writeHead(500, { 'Content-Type': 'application/json' }).end('{"message":"Server Error"}'));
});
afterAll(() => srv.tutup());

describe('log', () => {
    it('menyamarkan NIK, email, telepon, kontak, isi, sandi, dan token', () => {
        const { baris, log } = logUji();
        log.info({
            nik: '3201',
            tiket: { reporter_email: 'a@b.c', reporter_phone: '0812', telepon: '0813' },
            pesan: { body: 'isi chat', kontak: 'wa' },
            password: 'x',
            token: 't',
            status: 'baru',
        });

        const isi = JSON.parse(baris[0]);
        expect(isi).toMatchObject({ nik: '[REDACTED]', password: '[REDACTED]', token: '[REDACTED]', status: 'baru' });
        expect(isi.tiket).toEqual({ reporter_email: '[REDACTED]', reporter_phone: '[REDACTED]', telepon: '[REDACTED]' });
        expect(isi.pesan).toEqual({ body: '[REDACTED]', kontak: '[REDACTED]' });
    });

    it('galat axios tidak membocorkan header, body, atau query di jalur log mana pun', async () => {
        const err = await buatKlien({ baseURL: srv.url, timeoutMs: 2000, maxBytes: 1024 })
            .post('/ai?token=rahasia-query', { nik: '3201999999990001' }, { headers: { Authorization: 'Bearer rahasia-header' } })
            .catch((e: unknown) => e);
        const { baris, log } = logUji();
        log.error({ err }, 'gagal');
        log.error({ error: err }, 'kunci lain');
        log.error({ konteks: { err } }, 'bersarang');

        const ringkas = {
            type: 'AxiosError',
            message: 'Request failed with status code 500',
            code: 'ERR_BAD_RESPONSE',
            status: 500,
            method: 'POST',
            url: `${srv.url}/ai`,
        };
        expect(JSON.parse(baris[0]).err).toEqual(ringkas);
        expect(JSON.parse(baris[1]).error).toEqual(ringkas);
        expect(JSON.parse(baris[2]).konteks.err).toEqual(ringkas);
        // util.inspect = yang dipakai console.error (Next.js mencatat galat rute dengan console.error).
        for (const teks of [...baris, inspect(err), inspect({ err }, { depth: 5 }), JSON.stringify(err)]) {
            expect(teks).not.toMatch(/Bearer|rahasia|3201999999990001|token=/);
        }
    });

    it('galat biasa tetap memakai serializer standar pino', () => {
        const { baris, log } = logUji();
        log.error(new Error('putus'));
        expect(JSON.parse(baris[0]).err).toMatchObject({ type: 'Error', message: 'putus' });
    });
});
