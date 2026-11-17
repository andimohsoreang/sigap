import 'server-only';

import { headers } from 'next/headers';
import type { ComponentType } from 'react';

import { InertiaApp } from '@/lib/inertia/app';
import type { Page } from '@/lib/inertia/halaman';
import { penggunaSaatIni, sesiSaatIni } from '@/server/auth/konteks';
import { env } from '@/server/env';

import { hitungPropsBersama } from './props-bersama';
import { HEADER_URL } from './url';
import { ziggyUntuk } from './ziggy';

/**
 * `Inertia::render($komponen, $props)` untuk Server Component halaman: props bersama dihitung dari sesi Next.js,
 * digabung props halaman (array_merge: props halaman menang), lalu komponen klien yang sama dengan Laravel dirender
 * <InertiaApp> di browser. `komponen` = ekspor default berkas src/halaman/** ('use client'), dikirim sebagai
 * referensi modul klien (props tidak diserialisasi dua kali).
 */
export async function renderInertia<P extends Record<string, unknown>>(komponen: ComponentType<P>, nama: string, props?: P) {
    const h = await headers();
    const [sesi, pengguna] = await Promise.all([sesiSaatIni(), penggunaSaatIni()]);
    const bersama = await hitungPropsBersama(pengguna, sesi?.data ?? null);
    const page: Page = {
        component: nama,
        props: { ...bersama, ...props },
        url: h.get(HEADER_URL) ?? '/',
        version: null,
        clearHistory: false,
        encryptHistory: false,
    };
    // url('/') Laravel: origin aplikasi (APP_URL di produksi), di dev origin permintaan.
    const asal = env.APP_URL ?? `http://${h.get('host') ?? 'localhost'}`;
    return <InertiaApp page={page} komponen={komponen as ComponentType<Record<string, unknown>>} ziggy={ziggyUntuk(pengguna, asal)} />;
}
