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

// URL tanpa userinfo, query, dan fragmen (token & data pribadi sering ada di sana).
function urlAman(url?: string, baseURL?: string): string | undefined {
    if (!url) return undefined;
    try {
        const u = new URL(url, baseURL);
        return `${u.origin}${u.pathname}`;
    } catch {
        return url.split(/[?#]/)[0];
    }
}

// Galat axios membawa config (header Authorization, body permintaan) dan respons; hanya ringkasannya yang dicatat.
function serializerErr(err: unknown) {
    if (!isAxiosError(err)) return pino.stdSerializers.err(err as Error);
    return {
        type: 'AxiosError',
        message: err.message,
        code: err.code,
        status: err.response?.status,
        method: err.config?.method?.toUpperCase(),
        url: urlAman(err.config?.url, err.config?.baseURL),
    };
}

export const opsiLog: LoggerOptions = {
    level: env.LOG_LEVEL,
    base: { service: 'contact-center-web' },
    // shortcut: hanya kunci di level atas & satu level bersarang, tambah path bila log membawa objek lebih dalam.
    redact: { paths: [...SENSITIF, ...SENSITIF.map((k) => `*.${k}`), 'req.headers.authorization', 'req.headers.cookie'], censor: '[REDACTED]' },
    serializers: { err: serializerErr },
};

export const log = pino(opsiLog);
