import 'server-only';

import { isAxiosError } from 'axios';
import pino, { type LoggerOptions } from 'pino';

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
function serializerErr(err: unknown) {
    return isAxiosError(err) ? err.toJSON() : pino.stdSerializers.err(err as Error);
}

export const opsiLog: LoggerOptions = {
    level: env.LOG_LEVEL,
    base: { service: 'contact-center-web' },
    // shortcut: hanya kunci di level atas & satu level bersarang, tambah path bila log membawa objek lebih dalam.
    redact: { paths: [...SENSITIF, ...SENSITIF.map((k) => `*.${k}`), 'req.headers.authorization', 'req.headers.cookie'], censor: '[REDACTED]' },
    serializers: { err: serializerErr },
};

export const log = pino(opsiLog);
