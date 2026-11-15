import 'server-only';

import { headers } from 'next/headers';
import { cache } from 'react';

import { log } from '@/server/log';

import { bacaCookie, COOKIE_SESI } from './cookie';
import { bacaKonteks } from './konteks-tertanda';
import { ambilPengguna } from './pengguna';
import type { Pengguna } from './peran';
import { muatSesi, periksaSidik, type Sesi } from './sesi';

// Akses sesi & pengguna untuk route handler, Server Component, dan Server Action. proxy.ts sudah menjalankan
// tumpukan web (sesi dibuat/dirotasi, guard rute) dan meneruskan id sesi efektif lewat header Cookie permintaan,
// plus konteks bertanda tangan (konteks-tertanda.ts) agar sesi & pengguna tidak dimuat ulang dari DB.
// Jalur yang MENULIS sesi (login, logout, rotasi, flash) memakai sesiDariHeader: baris segar dari DB.

/** Sesi dari header Cookie permintaan, langsung dari DB (cookie ganda → tanpa sesi). */
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

/**
 * Sesi & pengguna permintaan ini (hanya baca). Konteks proxy yang sah dipakai tanpa query; header tidak ada atau
 * tidak sah → peringatan log lalu dimuat dari DB (tidak pernah dipercaya tanpa tanda tangan).
 */
export async function konteksDariHeader(h: Headers): Promise<{ sesi: Sesi | null; pengguna: Pengguna | null }> {
    const k = bacaKonteks(h);
    if (typeof k === 'object') return k;
    log.warn({ alasan: k }, 'konteks auth proxy tidak tersedia; sesi dimuat dari DB');
    const sesi = await sesiDariHeader(h);
    return { sesi, pengguna: await penggunaDariSesi(sesi) };
}

const konteksSaatIni = cache(async () => konteksDariHeader(await headers()));

/** Sesi permintaan saat ini (Server Component/Action), hanya baca; untuk menulis pakai sesiDariHeader. */
export const sesiSaatIni = cache(async () => (await konteksSaatIni()).sesi);

/** `$request->user()` untuk Server Component/Action. */
export const penggunaSaatIni = cache(async () => (await konteksSaatIni()).pengguna);
