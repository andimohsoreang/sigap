import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { redactPaths } from '@/server/log';

describe('redaksi log', () => {
    it('menyamarkan NIK, email, telepon, sandi, dan token', () => {
        const baris: string[] = [];
        const log = pino({ redact: { paths: redactPaths, censor: '[REDACTED]' } }, { write: (s: string) => baris.push(s) });

        log.info({ nik: '3201', tiket: { reporter_email: 'a@b.c', reporter_phone: '0812' }, password: 'x', token: 't', status: 'baru' });

        const isi = JSON.parse(baris[0]);
        expect(isi).toMatchObject({ nik: '[REDACTED]', password: '[REDACTED]', token: '[REDACTED]', status: 'baru' });
        expect(isi.tiket).toEqual({ reporter_email: '[REDACTED]', reporter_phone: '[REDACTED]' });
    });
});
