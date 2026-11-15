import 'server-only';

import { isAxiosError } from 'axios';
import pino, { type LoggerOptions } from 'pino';

import { bersihkanGalatDb } from './db/galat';
import { env } from './env';

const SENSITIF = [
    'nik',
    'reporter_nik',
    'email',
    'reporter_email',
    'phone',
    'reporter_phone',
    'telepon',
    'kontak',
    'contact',
    'body',
    'password',
    'password_confirmation',
    'current_password',
    'token',
    'guest_token',
    'lookup_token',
];

// Galat axios dari buatKlien sudah punya toJSON() yang aman (tanpa config, header, body, query).
// Galat DB (juga sebagai `cause`) dipetakan dulu: DrizzleQueryError/pg membawa nilai parameter & detail.
function serializerErr(err: unknown) {
    const bersih = bersihkanGalatDb(err);
    return isAxiosError(bersih) ? bersih.toJSON() : pino.stdSerializers.err(bersih as Error);
}

export const opsiLog: LoggerOptions = {
    level: env.LOG_LEVEL,
    base: { service: env.OTEL_SERVICE_NAME },
    // shortcut: hanya kunci di level atas & satu level bersarang, tambah path bila log membawa objek lebih dalam.
    redact: { paths: [...SENSITIF, ...SENSITIF.map((k) => `*.${k}`), 'req.headers.authorization', 'req.headers.cookie'], censor: '[REDACTED]' },
    serializers: { err: serializerErr },
    hooks: {
        // pino mengisi `msg` dari err.message SEBELUM serializer berjalan (log.error(err) / log.error({ err })).
        logMethod(arg, metode) {
            const [a] = arg as unknown[];
            if (a instanceof Error) arg[0] = bersihkanGalatDb(a) as Error;
            else if (typeof a === 'object' && a !== null && 'err' in a) arg[0] = { ...a, err: bersihkanGalatDb(a.err) };
            return metode.apply(this, arg);
        },
    },
};

export const log = pino(opsiLog);
