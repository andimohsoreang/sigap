import 'server-only';

import { headers } from 'next/headers';
import { cache } from 'react';

import { bacaCookie, COOKIE_SESI } from './cookie';
import { ambilPengguna } from './pengguna';
import type { Pengguna } from './peran';
import { muatSesi, periksaSidik, type Sesi } from './sesi';

// Akses sesi & pengguna untuk route handler, Server Component, dan Server Action. proxy.ts sudah menjalankan
// tumpukan web (sesi dibuat/dirotasi, guard rute) dan meneruskan id sesi efektif lewat header Cookie permintaan.

/** Sesi dari header Cookie permintaan (cookie ganda → tanpa sesi). */
export async function sesiDariHeader(h: Headers): Promise<Sesi | null> {
    const id = bacaCookie(h.get('cookie'), COOKIE_SESI);
    return id === 'ganda' ? null : muatSesi(id);
}

/** Pengguna login dari sesi; sidik sandi beda → null (pertahanan berlapis di samping proxy). */
export async function penggunaDariSesi(s: Sesi | null): Promise<Pengguna | null> {
    if (!s?.userId) return null;
    const p = await ambilPengguna(s.userId);
    return p && periksaSidik(s, p.password) !== 'beda' ? p : null;
}

/** Sesi permintaan saat ini (Server Component/Action), sekali per permintaan. */
export const sesiSaatIni = cache(async () => sesiDariHeader(await headers()));

/** `$request->user()` untuk Server Component/Action. */
export const penggunaSaatIni = cache(async () => penggunaDariSesi(await sesiSaatIni()));
