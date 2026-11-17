'use client';

import { createElement, useMemo, useState, useSyncExternalStore, type ComponentType } from 'react';

import { APP_NAME, judulApp } from '@/lib/judul';
import { routeZiggy, type ZiggyConfig } from '@/lib/ziggy';

import { PageContext, type Page } from './halaman';
import { buatHeadManager, HeadContext, penerapHead } from './head';

// Padanan createInertiaApp + <App> (sigap/resources/js/app.tsx, @inertiajs/react src/App.ts) untuk satu halaman.
//
// Komponen halaman dirender HANYA di browser, seperti Laravel (Inertia tanpa SSR: server mengirim <div id="app">
// kosong, React mengisinya dengan createRoot). Alasannya paritas DOM, bukan selera: render klien React menulis
// atribut dengan urutan berbeda dari render server (mis. <img> klien memasang `src` paling akhir, SSR paling awal),
// dan snapshot DOM suite paritas membandingkan outerHTML. Hasil render klien = Laravel, termasuk efek & state awal
// (tema dari localStorage, portal panel aksesibilitas) tanpa lompatan hidrasi.

const tanpaLangganan = () => () => {};

/** `@routes` app.blade.php: global Ziggy (rute grup peran ini) + route(). Dipasang sebelum anak dirender. */
function pasangZiggy(ziggy: ZiggyConfig) {
    globalThis.Ziggy = ziggy;
    globalThis.route = routeZiggy;
}
const diBrowser = () => true;
const diServer = () => false;

export function InertiaApp({ page, komponen, ziggy }: { page: Page; komponen: ComponentType<Record<string, unknown>>; ziggy: ZiggyConfig }) {
    // false saat render server & hidrasi, lalu true (render ulang di browser) → anak dirender seperti createRoot.
    const browser = useSyncExternalStore(tanpaLangganan, diBrowser, diServer);
    // <title inertia> app.blade.php berisi config('app.name') sampai <Head> halaman memasang judulnya.
    const [judul, setJudul] = useState(APP_NAME);
    const head = useMemo(() => (browser ? buatHeadManager(judulApp, penerapHead(setJudul)) : undefined), [browser]);

    if (browser) {
        pasangZiggy(ziggy);
        if ((komponen as { layout?: unknown }).layout !== undefined) throw new Error('Persistent layout Inertia (Component.layout) belum didukung');
    }

    return (
        <>
            <title>{judul}</title>
            <div id="app">
                {head && (
                    <HeadContext.Provider value={head}>
                        <PageContext.Provider value={page}>{createElement(komponen, page.props)}</PageContext.Provider>
                    </HeadContext.Provider>
                )}
            </div>
        </>
    );
}
