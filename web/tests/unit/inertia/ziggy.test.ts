import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { routeZiggy, type ParamRute, type ZiggyConfig } from '@/lib/ziggy';
import { ziggyUntuk } from '@/server/inertia/ziggy';

// route() pengganti vs Ziggy 2.6.4 asli (sigap/vendor/tightenco/ziggy/dist) dengan daftar rute Laravel yang sama.

const ZIGGY = resolve('../sigap/vendor/tightenco/ziggy/dist/index.esm.js');
const rute = JSON.parse(readFileSync('src/server/inertia/ziggy-rute.json', 'utf8'));
const config = (url: string, port: number | null): ZiggyConfig => ({
    url,
    port,
    defaults: {},
    routes: { ...rute.public, ...rute.admin, ...rute.warga, opsional: { uri: 'x/{a}/{b?}', methods: ['GET', 'HEAD'] } },
});

const KASUS: [string, ParamRute | undefined, boolean | undefined][] = [
    ['home', undefined, undefined],
    ['home', undefined, false],
    ['panduan', undefined, undefined],
    ['panduan', { tab: 'satu dua', ok: true, kosong: null }, false],
    ['lacak.show', 'TKT-261012-7KQ4MZ', undefined],
    ['lacak.show', ['TKT-1'], false],
    ['lacak.show', { ticket: 'TKT-2', kode: "a!'()*~" }, false],
    ['admin.tiket.show', { id: 7 }, false],
    ['admin.tiket.show', 9, undefined],
    ['admin.tiket.show', { ticket_no: 'TKT-9', judul: 'x' }, false],
    ['admin.tiket.show', { ticket: { ticket_no: 'TKT-8', id: 3 } }, false],
    ['opsional', ['p'], false],
    ['opsional', { a: 'p', b: 'q$|' }, false],
];

describe.skipIf(!existsSync(ZIGGY))(`route() vs Ziggy asli${existsSync(ZIGGY) ? '' : ' — dilewati: sigap/vendor belum ada'}`, () => {
    it.each([
        ['http://127.0.0.1:8134', 8134],
        ['https://app2.andimohamad.my.id', null],
    ] as const)('%s', async (url, port) => {
        const { route } = await import(pathToFileURL(ZIGGY).href);
        const c = config(url, port);
        for (const [nama, params, absolute] of KASUS) {
            expect(routeZiggy(nama, params, absolute, c), nama).toBe(route(nama, params, absolute, c));
        }
        for (const [nama, params] of [
            ['tidak-ada', undefined],
            ['lacak.show', undefined],
            ['lacak.show', 'bukan valid!'],
        ] as const) {
            expect(() => route(nama, params, true, c)).toThrow();
            expect(() => routeZiggy(nama, params, true, c)).toThrow(/Ziggy error/);
        }
    });
});

describe('route() yang belum didukung', () => {
    it('tanpa nama, tanpa konfigurasi, query bertingkat', () => {
        const c = config('http://cc.test', null);
        expect(() => routeZiggy()).toThrow(/belum didukung/);
        expect(() => routeZiggy('home', undefined, true, undefined)).toThrow(/missing configuration/);
        expect(() => routeZiggy('panduan', { a: { id: 1 } }, true, c)).toThrow(/bertingkat/);
    });
});

describe('ziggyUntuk = @routes($ziggyGroups) per peran', () => {
    it('tamu public; warga +warga; admin +admin; pegawai public; port dari URL', () => {
        const n = (role: string | null) => Object.keys(ziggyUntuk(role ? { role } : null, 'https://cc.test').routes);
        expect(n(null)).toEqual(Object.keys(rute.public));
        expect(n('pegawai')).toEqual(Object.keys(rute.public));
        expect(n('warga')).toEqual([...Object.keys(rute.public), ...Object.keys(rute.warga)]);
        expect(n('admin_kawasan')).toEqual([...Object.keys(rute.public), ...Object.keys(rute.admin)]);
        expect(n('super_admin').some((k) => k.startsWith('warga.'))).toBe(false);
        expect(ziggyUntuk(null, 'http://127.0.0.1:8134')).toMatchObject({ url: 'http://127.0.0.1:8134', port: 8134, defaults: {} });
        expect(ziggyUntuk(null, 'https://cc.test/')).toMatchObject({ url: 'https://cc.test', port: null });
    });
});
