import { bodyTerlaluBesar, GalatBodyBesar } from './batas-body';

// `$request->input()` Laravel setelah middleware global TrimStrings + ConvertEmptyStringsToNull: query + body
// (JSON, x-www-form-urlencoded, atau multipart), body menang atas query.

// Nama field berasal dari klien: semua objek hasil berprototipe null dan kunci yang menyentuh prototipe JavaScript
// dibuang di posisi mana pun (query, form, JSON). PHP menyimpannya sebagai kunci biasa (`__proto__[a]=1` →
// ['__proto__' => ['a' => '1']]); tidak ada formulir Contact Center yang memakai nama itu, jadi dibuang aman.
const KUNCI_TERLARANG = new Set(['__proto__', 'constructor', 'prototype']);
const objekKosong = () => Object.create(null) as Record<string, unknown>;

/** Nilai field input milik objek itu sendiri (tidak pernah dari prototipe). */
export function nilaiInput(input: Record<string, unknown>, kunci: string): unknown {
    return Object.hasOwn(input, kunci) ? input[kunci] : undefined;
}

/** Kunci yang tidak di-trim (TrimStrings::$except). */
const TANPA_TRIM = new Set(['current_password', 'password', 'password_confirmation']);

// Str::trim: \s + Str::INVISIBLE_CHARACTERS + " \n\r\t\v\0" (laravel/framework 12.69.3 Support/Str.php:32).
const TAK_TERLIHAT =
    '\\u0009\\u0020\\u00A0\\u00AD\\u034F\\u061C\\u115F\\u1160\\u17B4\\u17B5\\u180E\\u2000-\\u200F\\u202F\\u205F\\u2060-\\u2065' +
    '\\u206A-\\u206F\\u3000\\u2800\\u3164\\uFEFF\\uFFA0\\u{1D159}\\u{1D173}-\\u{1D17A}\\u{E0020}\\n\\r\\t\\v\\0';
const POLA_TRIM = new RegExp(`^[\\s${TAK_TERLIHAT}]+|[\\s${TAK_TERLIHAT}]+$`, 'gu');

/** Str::trim. */
export const trimLaravel = (s: string) => s.replace(POLA_TRIM, '');

function ubah(kunci: string, v: unknown): unknown {
    if (typeof v === 'string') {
        const t = TANPA_TRIM.has(kunci) ? v : trimLaravel(v);
        return t === '' ? null : t;
    }
    if (Array.isArray(v)) return v.map((x) => ubah(kunci, x));
    if (v && typeof v === 'object' && !(v instanceof Blob)) {
        const o = objekKosong();
        for (const [k, x] of Object.entries(v)) if (!KUNCI_TERLARANG.has(k)) o[k] = ubah(k, x);
        return o;
    }
    return v;
}

/** Pasangan kunci-nilai gaya PHP: `a[]` → larik, `a[b]` → objek, kunci biasa → nilai terakhir. */
function pasangPhp(entri: Iterable<[string, unknown]>): Record<string, unknown> {
    const hasil = objekKosong();
    for (const [kunci, nilai] of entri) {
        const m = /^([^[\]]+)\[([^\]]*)\]/.exec(kunci);
        const dasar = m ? m[1] : kunci;
        if (KUNCI_TERLARANG.has(dasar) || (m && KUNCI_TERLARANG.has(m[2]))) continue;
        if (!m) {
            hasil[dasar] = nilai;
            continue;
        }
        // shortcut: hanya satu tingkat `a[b]`; formulir auth tidak memakai larik bersarang.
        let wadah = Object.hasOwn(hasil, dasar) ? hasil[dasar] : undefined;
        if (!wadah || typeof wadah !== 'object') wadah = hasil[dasar] = m[2] === '' ? [] : objekKosong();
        if (Array.isArray(wadah)) {
            if (m[2] === '') {
                wadah.push(nilai);
                continue;
            }
            // `a[]=1&a[x]=2` → seperti PHP, satu wadah berkunci campuran (bukan properti larik seperti `length`).
            wadah = hasil[dasar] = Object.assign(objekKosong(), wadah);
        }
        (wadah as Record<string, unknown>)[m[2]] = nilai;
    }
    return hasil;
}

/** Input permintaan dengan semantik Laravel. Body rusak (JSON tidak sah) → dianggap kosong; terlalu besar → GalatBodyBesar. */
export async function bacaInput(req: Request, maksByte: number): Promise<Record<string, unknown>> {
    // proxy.ts sudah menolak; diulang agar body besar tidak pernah dibaca ke memori bila rute dipanggil tanpa proxy.
    if (bodyTerlaluBesar(req.headers, maksByte)) throw new GalatBodyBesar(`body melebihi ${maksByte} byte`);
    const query = pasangPhp(new URL(req.url).searchParams.entries());
    let body: Record<string, unknown> = objekKosong();
    const jenis = req.headers.get('content-type')?.toLowerCase() ?? '';
    try {
        if (jenis.includes('json')) {
            const j: unknown = await req.json();
            if (j && typeof j === 'object' && !Array.isArray(j)) body = j as Record<string, unknown>;
        } else if (jenis.startsWith('application/x-www-form-urlencoded') || jenis.startsWith('multipart/form-data')) {
            body = pasangPhp((await req.formData()).entries());
        }
    } catch {
        body = objekKosong();
    }
    // Object.assign ke objek berprototipe null: kunci `__proto__` dari JSON menjadi properti biasa lalu dibuang ubah().
    return ubah('', Object.assign(objekKosong(), query, body)) as Record<string, unknown>;
}

/** `$request->boolean($kunci)`: FILTER_VALIDATE_BOOLEAN ("1", "true", "on", "yes", true). */
export function inputBoolean(input: Record<string, unknown>, kunci: string): boolean {
    const v = nilaiInput(input, kunci);
    if (v === true || v === 1) return true;
    return typeof v === 'string' && ['1', 'true', 'on', 'yes'].includes(v.trim().toLowerCase());
}
