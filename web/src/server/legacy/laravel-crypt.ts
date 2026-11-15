import 'server-only';

import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Padanan Illuminate\Encryption\Encrypter (Laravel 12.69.3) dengan cipher AES-256-CBC (config/app.php).

/** Kunci Laravel; tidak pernah tampil di log (JSON.stringify / util.inspect / console.log). */
export class KunciLaravel {
    constructor(
        /** Nilai APP_KEY apa adanya (termasuk awalan `base64:`); dipakai SessionGuard::hashPasswordForCookie. */
        readonly mentah: string,
        readonly kunci: Buffer,
        readonly sebelumnya: Buffer[],
    ) {}

    toJSON() {
        return '[KunciLaravel]';
    }

    [Symbol.for('nodejs.util.inspect.custom')]() {
        return '[KunciLaravel]';
    }
}

/** Pesan sama persis dengan DecryptException Laravel. */
export class GalatDekripsi extends Error {
    override name = 'GalatDekripsi';
}

const PAYLOAD_TIDAK_SAH = 'The payload is invalid.';
const MAC_TIDAK_SAH = 'The MAC is invalid.';
const GAGAL_DEKRIPSI = 'Could not decrypt the data.';
const TAG_AEAD = 'Unable to use tag because the cipher algorithm does not support AEAD.';

// Payload sesi terbesar yang masuk akal (_old_input formulir) jauh di bawah ini.
const MAKS_PAYLOAD = 4 * 1024 * 1024;
// ignoreBOM: U+FEFF di awal adalah isi data, bukan penanda yang boleh dibuang.
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/** EncryptionServiceProvider::parseKey: `base64:` di-decode, selain itu string apa adanya; wajib 32 byte. */
function parseKunci(nilai: string): Buffer {
    if (nilai === '') throw new Error('No application encryption key has been specified.');
    const kunci = nilai.startsWith('base64:') ? Buffer.from(nilai.slice(7), 'base64') : Buffer.from(nilai, 'utf8');
    if (kunci.length !== 32) throw new Error('Unsupported cipher or incorrect key length. Supported ciphers are: aes-256-cbc.');
    return kunci;
}

/** APP_KEY + APP_PREVIOUS_KEYS persis seperti config/app.php (`array_filter(explode(',', …))`, tanpa trim). */
export function bacaKunci(appKey: string, previousKeys = ''): KunciLaravel {
    const sebelumnya = previousKeys
        .split(',')
        .filter((k) => k !== '' && k !== '0')
        .map(parseKunci);
    return new KunciLaravel(appKey, parseKunci(appKey), sebelumnya);
}

/** base64_decode($s, true) PHP: spasi/tab/baris dilewati, padding opsional tetapi bila ada harus lengkap. */
export function base64Ketat(nilai: string): Buffer | null {
    const s = nilai.replace(/[ \t\r\n]/g, '');
    const m = /^([A-Za-z0-9+/]*)(=*)$/.exec(s);
    if (!m || m[2].length > 2 || m[1].length % 4 === 1) return null;
    if (m[2].length > 0 && s.length % 4 !== 0) return null;
    return Buffer.from(m[1], 'base64');
}

function mac(kunci: Buffer, iv: string, value: string): string {
    return createHmac('sha256', kunci)
        .update(iv + value)
        .digest('hex');
}

/** hash_equals PHP: constant-time; panjang berbeda langsung false (panjang bukan rahasia). */
export function samaWaktuTetap(a: string, b: string): boolean {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
}

/** Encrypter::encrypt($value, false) — byte apa adanya, tanpa serialize PHP. */
export function enkripsiByte(data: Buffer, k: KunciLaravel): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', k.kunci, iv);
    const value = Buffer.concat([cipher.update(data), cipher.final()]).toString('base64');
    const ivB64 = iv.toString('base64');
    // Urutan kunci & tanpa escape "/" = json_encode(compact('iv','value','mac','tag'), JSON_UNESCAPED_SLASHES).
    const json = JSON.stringify({ iv: ivB64, value, mac: mac(k.kunci, ivB64, value), tag: '' });
    return Buffer.from(json, 'utf8').toString('base64');
}

/** Crypt::encryptString. */
export function enkripsi(plaintext: string, k: KunciLaravel): string {
    return enkripsiByte(Buffer.from(plaintext, 'utf8'), k);
}

type Amplop = { iv: string; value: string; mac: string; tag?: unknown };

/** Encrypter::getJsonPayload + validPayload. */
function bacaAmplop(payload: unknown): Amplop {
    if (typeof payload !== 'string' || payload.length > MAKS_PAYLOAD) throw new GalatDekripsi(PAYLOAD_TIDAK_SAH);
    let p: unknown;
    try {
        p = JSON.parse(utf8.decode(Buffer.from(payload, 'base64')));
    } catch {
        throw new GalatDekripsi(PAYLOAD_TIDAK_SAH);
    }
    if (typeof p !== 'object' || p === null || Array.isArray(p)) throw new GalatDekripsi(PAYLOAD_TIDAK_SAH);
    const a = p as Record<string, unknown>;
    if (typeof a.iv !== 'string' || typeof a.value !== 'string' || typeof a.mac !== 'string') throw new GalatDekripsi(PAYLOAD_TIDAK_SAH);
    if (a.tag !== undefined && a.tag !== null && typeof a.tag !== 'string') throw new GalatDekripsi(PAYLOAD_TIDAK_SAH);
    if (base64Ketat(a.iv)?.length !== 16) throw new GalatDekripsi(PAYLOAD_TIDAK_SAH);
    return a as Amplop;
}

/** Encrypter::decrypt($payload, false): cek MAC tiap kunci (sekarang lalu sebelumnya), lalu AES-256-CBC. */
export function dekripsiByte(payload: unknown, k: KunciLaravel): Buffer {
    const a = bacaAmplop(payload);
    // ensureTagIsValid: empty($tag) PHP (null, '', '0') berarti tidak ada tag; selain itu ditolak untuk CBC.
    if (a.tag !== undefined && a.tag !== null && a.tag !== '' && a.tag !== '0') throw new GalatDekripsi(TAG_AEAD);

    const kunci = [k.kunci, ...k.sebelumnya].find((kn) => samaWaktuTetap(mac(kn, a.iv, a.value), a.mac));
    if (!kunci) throw new GalatDekripsi(MAC_TIDAK_SAH);
    try {
        const decipher = createDecipheriv('aes-256-cbc', kunci, Buffer.from(a.iv, 'base64'));
        return Buffer.concat([decipher.update(Buffer.from(a.value, 'base64')), decipher.final()]);
    } catch {
        throw new GalatDekripsi(GAGAL_DEKRIPSI);
    }
}

/** Crypt::decryptString; kolom terenkripsi aplikasi selalu teks UTF-8. */
export function dekripsi(payload: unknown, k: KunciLaravel): string {
    const data = dekripsiByte(payload, k);
    try {
        return utf8.decode(data);
    } catch {
        throw new GalatDekripsi(GAGAL_DEKRIPSI);
    }
}
