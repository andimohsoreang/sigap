// sigap/app/Http/Requests/LoginRequest.php (yang dipakai MasukController & Api\V1\AuthController; Auth\LoginRequest
// sisa starter kit, tidak dipasang di rute mana pun). Pesan validasi bawaan Laravel bahasa Inggris: lang/id hanya
// berisi asisten.php, jadi fallback_locale `en` yang dipakai (diverifikasi lewat Validator Laravel asli).

export type GalatValidasi = Record<string, string[]>;

export type HasilValidasi = { ok: true; identifier: string; password: string } | { ok: false; galat: GalatValidasi };

/** Laravel `required`: null, string kosong/spasi saja, atau larik kosong gagal. */
const kosong = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

/** `required|string|max:150` untuk identifier, `required|string` untuk password. Input sudah lewat bacaInput(). */
export function validasiMasuk(input: Record<string, unknown>): HasilValidasi {
    const galat: GalatValidasi = {};
    const id = input.identifier;
    if (kosong(id)) galat.identifier = ['The identifier field is required.'];
    else if (typeof id !== 'string') galat.identifier = ['The identifier field must be a string.'];
    else if (Array.from(id).length > 150) galat.identifier = ['The identifier field must not be greater than 150 characters.'];
    const pw = input.password;
    if (kosong(pw)) galat.password = ['The password field is required.'];
    else if (typeof pw !== 'string') galat.password = ['The password field must be a string.'];
    return Object.keys(galat).length > 0 ? { ok: false, galat } : { ok: true, identifier: id as string, password: pw as string };
}

/** ValidationException::summarize: pesan pertama + "(and N more error[s])". */
export function ringkasGalat(galat: GalatValidasi): string {
    const semua = Object.values(galat).flat();
    const sisa = semua.length - 1;
    return sisa > 0 ? `${semua[0]} (and ${sisa} more ${sisa === 1 ? 'error' : 'errors'})` : (semua[0] ?? '');
}
