import pino from 'pino';

import { env } from './env';

const SENSITIF = [
    'nik',
    'reporter_nik',
    'email',
    'reporter_email',
    'phone',
    'reporter_phone',
    'password',
    'password_confirmation',
    'current_password',
    'token',
    'guest_token',
    'lookup_token',
];

// shortcut: hanya kunci di level atas & satu level bersarang, tambah path bila log membawa objek lebih dalam.
export const redactPaths = [...SENSITIF, ...SENSITIF.map((k) => `*.${k}`), 'req.headers.authorization', 'req.headers.cookie'];

export const log = pino({
    level: env.LOG_LEVEL,
    base: { service: 'contact-center-web' },
    redact: { paths: redactPaths, censor: '[REDACTED]' },
});
