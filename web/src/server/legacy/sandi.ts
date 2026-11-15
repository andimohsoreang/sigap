import 'server-only';

import bcrypt from 'bcryptjs';

// Padanan Illuminate\Hashing\BcryptHasher dengan konfigurasi produksi: BCRYPT_ROUNDS=12, HASH_VERIFY=true (bawaan).

export const BIAYA_BCRYPT = 12;

// password_get_info() PHP hanya mengenali `$2y$` (60 karakter) sebagai bcrypt; `$2a$`/`$2b$` dianggap "unknown".
const BCRYPT_2Y = /^\$2y\$\d{2}\$[./A-Za-z0-9]{53}$/;

/** Hash::check: hash kosong → false; bukan `$2y$` → galat seperti Laravel (verify=true). */
export async function verifikasiSandi(sandi: string, hash: string | null | undefined): Promise<boolean> {
    if (!hash) return false;
    if (!BCRYPT_2Y.test(hash)) throw new Error('This password does not use the Bcrypt algorithm.');
    return bcrypt.compare(sandi, hash);
}

/** Hash::make: `$2y$12$…`. bcryptjs memakai algoritma yang sama; awalan `$2b$` akan ditolak Hash::check Laravel. */
export async function hashSandi(sandi: string): Promise<string> {
    // password_hash PHP 8.4 menolak NUL; Laravel membungkusnya menjadi RuntimeException ini.
    if (sandi.includes('\0')) throw new Error('Bcrypt hashing not supported.');
    const garam = await bcrypt.genSalt(BIAYA_BCRYPT);
    return bcrypt.hash(sandi, '$2y$' + garam.slice(4));
}
