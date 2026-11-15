import 'server-only';

import { createHash } from 'node:crypto';

import { cobaBatas, type HasilBatas, type Limit } from './inti';

// 9 limiter bernama, angka & kunci persis sigap/app/Providers/AppServiceProvider.php (laravel-baseline).
// Pemakaian per rute (middleware `throttle:<nama>`) ada di sigap/routes/web.php & api.php; dipasang oleh slice masing-masing.

/** Data permintaan yang dipakai kunci limiter Laravel. */
export interface KonteksBatas {
    /** `$request->ip()` — IP klien asli (Laravel: dari CF-Connecting-IP lewat nginx). */
    ip: string;
    /** `$request->input('identifier')` mentah (login). */
    identifier?: unknown;
    /** `$request->path()` — lihat jalurLaravel(). */
    path?: string;
    /** `$request->user()?->id ?? $request->session()->getId()` (chat, chat-baca). */
    sesi?: string | number;
}

const sha1 = (s: string) => createHash('sha1').update(s).digest('hex');
const perMenit = (maks: number, kunci: string, menit = 1): Limit => ({ kunci, maks, detik: 60 * menit });
const perJam = (maks: number, kunci: string): Limit => ({ kunci, maks, detik: 3600 });

/** `(string) $v` PHP untuk input request (null → '', true → '1', false → '', array → 'Array'). */
function strPhp(v: unknown): string {
    if (v === null || v === undefined || v === false) return '';
    if (v === true) return '1';
    if (Array.isArray(v) || typeof v === 'object') return 'Array';
    return String(v);
}

/** trim() PHP: hanya " \t\n\r\0\x0B" (String.trim JS juga membuang NBSP & spasi Unicode lain). */
const trimPhp = (s: string) => s.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '');

/** `$request->path()`: path tanpa garis miring di awal/akhir (tidak di-decode), '/' bila kosong. */
export function jalurLaravel(pathname: string): string {
    const p = pathname.replace(/^\/+|\/+$/g, '');
    return p === '' ? '/' : p;
}

const wajib = <T>(v: T | undefined, nama: string): T => {
    if (v === undefined) throw new Error(`KonteksBatas.${nama} wajib untuk limiter ini`);
    return v;
};

export const LIMITER = {
    // AppServiceProvider.php:41-50
    login: (k: KonteksBatas) => {
        const id = sha1(trimPhp(strPhp(k.identifier)).toLowerCase());
        return [perMenit(5, `login:id:${id}|${k.ip}`), perMenit(20, `login:ip:${k.ip}`), perJam(30, `login:id:${id}`)];
    },
    // :55-58
    chat: (k: KonteksBatas) => [perMenit(20, `chat:s:${wajib(k.sesi, 'sesi')}`), perMenit(60, `chat:ip:${k.ip}`)],
    // :59
    'chat-mulai': (k: KonteksBatas) => [perMenit(5, `chat-mulai:${k.ip}`, 10)],
    // :60-63
    'chat-baca': (k: KonteksBatas) => [perMenit(30, `chat-baca:s:${wajib(k.sesi, 'sesi')}`), perMenit(240, `chat-baca:ip:${k.ip}`)],
    // :66
    pengaduan: (k: KonteksBatas) => [perMenit(10, `pengaduan:${k.ip}`, 10)],
    // :71-74
    'chat-lampiran': (k: KonteksBatas) => [perMenit(6, `chat-lampiran:m:${k.ip}`), perJam(30, `chat-lampiran:h:${k.ip}`)],
    // :76-79
    akun: (k: KonteksBatas) => [perMenit(5, `akun:${wajib(k.path, 'path')}|${k.ip}`, 10), perJam(30, `akun:ip:${k.ip}`)],
    // :83
    lookup: (k: KonteksBatas) => [perMenit(30, `lookup:${k.ip}`)],
    // :86
    health: (k: KonteksBatas) => [perMenit(60, `health:${k.ip}`)],
} satisfies Record<string, (k: KonteksBatas) => Limit[]>;

export type NamaLimiter = keyof typeof LIMITER;

/** Padanan middleware `throttle:<nama>`. Beberapa limiter pada satu rute (`throttle:lookup`, `throttle:pengaduan`) dipanggil berurutan. */
export function batasi(nama: NamaLimiter, k: KonteksBatas): Promise<HasilBatas> {
    return cobaBatas(nama, LIMITER[nama](k));
}

/**
 * `throttle:6,1` tanpa nama (sigap/routes/web.php:99, verifikasi surel, di belakang `auth`): 6×/menit, kunci
 * ThrottleRequests::resolveRequestSignature = sha1(id pengguna) untuk pengguna login.
 */
export function batasiVerifikasiEmail(userId: number): Promise<HasilBatas> {
    return cobaBatas(null, [perMenit(6, sha1(String(userId)))]);
}
