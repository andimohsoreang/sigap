// @vitest-environment jsdom
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import * as ReactWeb from 'react';
import { act } from 'react';
import * as ReactDomWeb from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as kompat from '@/lib/inertia';
import { InertiaApp } from '@/lib/inertia/app';
import type { Page } from '@/lib/inertia/halaman';
import { buatHeadManager } from '@/lib/inertia/head';
import { hrefInertia } from '@/lib/inertia/link';
import { judulApp } from '@/lib/judul';

// Lapisan kompatibilitas vs @inertiajs/react 2.0.3 ASLI (sigap/node_modules, React milik sigap): komponen uji yang
// sama dirender lewat createInertiaApp Laravel dan lewat <InertiaApp>, lalu DOM, judul tab, dan <meta> dibandingkan.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Api = { Link: unknown; Head: unknown; usePage: () => Page };

/** Komponen uji yang memakai Link/Head/usePage; dibangun dengan createElement milik React yang merendernya. */
function buatHalaman(h: typeof ReactWeb.createElement, api: Api) {
    const { Link, Head, usePage } = api as { Link: string; Head: string; usePage: () => Page };
    return function Halaman(props: { judul: string }) {
        const page = usePage();
        return h(
            'div',
            { className: 'akar' },
            h(Head, { title: `${props.judul} — Contact Center` } as never, h('meta', { name: 'description', content: 'Deskripsi uji' })),
            h('p', { id: 'info' }, `${page.component}|${page.url}|${String((page.props as unknown as { auth: unknown }).auth)}`),
            ...['/', '/panduan', '#bagian', 'relatif/x', '/a b/../c?q=1#h', 'https://contoh.test/x?y=1'].map((href, i) =>
                h(Link, { key: i, href, className: 'tautan', 'aria-label': `L${i}`, 'aria-current': i === 1 ? 'page' : undefined } as never, `t${i}`),
            ),
        );
    };
}

const PAGE: Page = {
    component: 'public/uji',
    props: { errors: {}, auth: null, judul: 'Tentang Kami' } as Page['props'],
    url: '/uji?a=1',
    version: null,
    clearHistory: false,
    encryptHistory: false,
};

const tunggu = () => new Promise((ok) => setTimeout(ok, 20));
const metaDeskripsi = () => document.head.querySelector('meta[name="description"]')?.getAttribute('content') ?? null;

/** <head> awal: Laravel dari app.blade.php (`<title inertia>`); Next.js tanpa judul (dirender <InertiaApp>). */
function siapkanDokumen(laravel = false) {
    document.head.innerHTML = laravel ? '<title inertia="">Contact Center</title>' : '';
    document.body.innerHTML = '';
}

afterEach(() => vi.unstubAllGlobals());

// Lingkungan jsdom: import.meta.url bukan file:, jadi jalur dari cwd (web/).
const NM = resolve('../sigap/node_modules');
const adaSigap = existsSync(join(NM, '@inertiajs/react/dist/index.esm.js'));

describe('hrefInertia = mergeDataIntoQueryString GET', () => {
    it.each([
        ['/', '/'],
        ['/panduan', '/panduan'],
        ['#x', '#x'],
        ['?a=1', '?a=1'],
        ['relatif/x', 'relatif/x'],
        ['/a b/../c?q=1#h', '/c?q=1#h'],
        ['/a b/c', '/a%20b/c'],
        ['https://Contoh.test:443/x?y=1', 'https://contoh.test/x?y=1'],
    ])('%s → %s', (masuk, keluar) => expect(hrefInertia(masuk)).toBe(keluar));
});

describe('judulApp = callback title app.tsx', () => {
    it('kosong → nama aplikasi; sudah memuat nama → apa adanya; selain itu diberi akhiran', () => {
        expect(judulApp('')).toBe('Contact Center');
        expect(judulApp('Tentang Kami — Contact Center')).toBe('Tentang Kami — Contact Center');
        expect(judulApp('Masuk')).toBe('Masuk - Contact Center');
    });
});

describe('opsi yang belum didukung → galat jelas', () => {
    it('Link method/as/prefetch dan router.visit non-GET', async () => {
        siapkanDokumen();
        const root = ReactDomWeb.createRoot(document.body.appendChild(document.createElement('div')));
        const galat = vi.spyOn(console, 'error').mockImplementation(() => {});
        await expect(act(async () => root.render(ReactWeb.createElement(kompat.Link, { href: '/keluar', method: 'post' })))).rejects.toThrow(
            /method belum didukung/,
        );
        galat.mockRestore();
        expect(() => kompat.router.visit('/x', { method: 'post' })).toThrow(/hanya GET/);
        const galat2 = vi.spyOn(console, 'error').mockImplementation(() => {});
        await expect(act(async () => root.render(ReactWeb.createElement(() => kompat.usePage().url)))).rejects.toThrow(
            /usePage must be used within the Inertia component/,
        );
        galat2.mockRestore();
    });

    it('router.visit GET → navigasi penuh browser', () => {
        const assign = vi.fn();
        vi.stubGlobal('location', { href: 'http://cc.test/panduan', assign });
        kompat.router.visit('/chat', { onSuccess: () => {} });
        expect(assign).toHaveBeenCalledWith('http://cc.test/chat');
    });
});

describe('Head: nilai atribut di-escape', () => {
    it('deskripsi berisi kutip tidak menambah meta refresh; & dan " tetap utuh', async () => {
        siapkanDokumen();
        const jahat = 'x" http-equiv="refresh" content="0;url=https://evil';
        const Halaman = () =>
            ReactWeb.createElement(
                kompat.Head,
                { title: 'Uji & "kutip"' },
                ReactWeb.createElement('meta', { name: 'description', content: jahat }),
                ReactWeb.createElement('meta', { name: 'keywords', content: 'A & B &amp; C' }),
            );
        const ziggy = { url: 'http://cc.test', port: null, defaults: {}, routes: {} };
        await act(async () => {
            ReactDomWeb.createRoot(document.body.appendChild(document.createElement('div'))).render(
                ReactWeb.createElement(InertiaApp, { page: PAGE, komponen: Halaman as never, ziggy }),
            );
        });
        await tunggu();
        expect(document.head.querySelector('meta[http-equiv]')).toBeNull();
        expect(metaDeskripsi()).toBe(jahat);
        expect(document.head.querySelector('meta[name="keywords"]')?.getAttribute('content')).toBe('A & B &amp; C');
        expect(document.title).toBe('Uji & "kutip" - Contact Center');
    });
});

describe('head manager = createHeadManager @inertiajs/core', () => {
    it.skipIf(!adaSigap)('kumpulan tag sama untuk title default, Head bertitle, meta ber/tanpa head-key', async () => {
        const core = await import(pathToFileURL(join(NM, '@inertiajs/core/dist/index.esm.js')).href);
        const asli: string[][] = [];
        const kita: string[][] = [];
        const ma = core.createHeadManager(true, judulApp, (e: string[]) => asli.push(e));
        const mk = buatHeadManager(judulApp, (e) => kita.push(e));
        for (const m of [ma, mk]) {
            const p1 = m.createProvider();
            const p2 = m.createProvider();
            p1.update(['<meta name="description" content="satu" inertia>', '<title inertia>Halaman</title>']);
            p2.update(['<meta inertia="desc" name="x">', '<title inertia>Tentang — Contact Center</title>']);
            p1.disconnect();
        }
        expect(kita).toEqual(asli);
    });
});

describe.skipIf(!adaSigap)(`Link/Head/usePage vs @inertiajs/react asli${adaSigap ? '' : ' — dilewati: sigap/node_modules belum ada'}`, () => {
    it('DOM, judul tab, dan meta description sama', async () => {
        const muat = (p: string) => import(pathToFileURL(join(NM, p)).href);
        const [ReactL, DomL, InertiaL] = await Promise.all([
            muat('react/index.js'),
            muat('react-dom/client.js'),
            muat('@inertiajs/react/dist/index.esm.js'),
        ]);

        // Laravel: createInertiaApp + createRoot (resources/js/app.tsx tanpa Echo).
        siapkanDokumen(true);
        // router.init Inertia memulihkan posisi gulir; jsdom tidak mengimplementasikan scrollTo.
        window.scrollTo = () => {};
        const elL = document.body.appendChild(document.createElement('div'));
        elL.id = 'app';
        const HalamanL = buatHalaman(ReactL.createElement, InertiaL);
        await act(async () => {
            await InertiaL.createInertiaApp({
                page: PAGE,
                title: judulApp,
                resolve: () => HalamanL,
                setup: ({ el, App, props }: { el: Element; App: unknown; props: object }) =>
                    DomL.createRoot(el).render(ReactL.createElement(App as string, props)),
            });
        });
        await tunggu();
        const laravel = { html: elL.outerHTML, judul: document.title, meta: metaDeskripsi() };

        // Next.js: <InertiaApp> (render klien) dengan modul pengganti.
        siapkanDokumen();
        const elN = document.body.appendChild(document.createElement('div'));
        const HalamanN = buatHalaman(ReactWeb.createElement, kompat as unknown as Api);
        const ziggy = { url: 'http://cc.test', port: null, defaults: {}, routes: { home: { uri: '/', methods: ['GET', 'HEAD'] } } };
        await act(async () => {
            ReactDomWeb.createRoot(elN).render(ReactWeb.createElement(InertiaApp, { page: PAGE, komponen: HalamanN as never, ziggy }));
        });
        await tunggu();
        const next = { html: elN.innerHTML, judul: document.title, meta: metaDeskripsi() };

        // Laravel: <div id="app"> dari Blade diisi createRoot; Next: <div id="app"> dirender InertiaApp.
        expect(next).toEqual(laravel);
        expect(next.judul).toBe('Tentang Kami — Contact Center');
        expect(next.html).toContain('<p id="info">public/uji|/uji?a=1|null</p>');
        expect(globalThis.route('home')).toBe('http://cc.test');
    });
});
