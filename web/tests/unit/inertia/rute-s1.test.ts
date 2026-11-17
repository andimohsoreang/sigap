import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { langkahRute } from '@/server/auth/guard';
import { urlInertia } from '@/server/inertia/url';
import { redirectLama, respons301 } from '@/server/web/redirect-lama';

import { cekLaravel } from '../db/laravel';

// Rute S1 di sisi server: url Inertia, guard grup `web`, dan Route::redirect 301.

describe('urlInertia = Response::getUrl inertia-laravel 2.0.28', () => {
    // Nilai Laravel diambil dari data-page target paritas (php artisan serve, 17 Nov 2026).
    it.each([
        ['/panduan', '', '/panduan'],
        ['/panduan/', '?b=1&a=x%20y&c', '/panduan/?a=x%20y&b=1&c='],
        ['/', '?z=1', '/?z=1'],
        ['/', '', '/'],
        ['/tentang', '?a=1&a=2&b=x+y', '/tentang?a=2&b=x%20y'],
        ['/tentang', "?k=!'()*~", '/tentang?k=%21%27%28%29%2A~'],
        ['/tentang//', '', '/tentang/'],
    ])('%s%s → %s', (path, q, hasil) => expect(urlInertia(path, q)).toBe(hasil));
});

describe('guard: halaman S1 = grup web tanpa middleware rute (tamu, warga, admin boleh)', () => {
    it.each(['panduan', 'tentang', 'tentang-kami', 'pedoman-layanan', 'syarat-ketentuan', 'kebijakan-privasi'])('%s', (p) => {
        expect(langkahRute('GET', p)).toEqual([]);
    });
});

describe('Route::redirect (web.php:36-38,45,68,70)', () => {
    it('semua verb Route::any, kecuali POST /pengaduan (pengaduan.store.legacy)', () => {
        expect(redirectLama('GET', 'beranda-baru')).toBe('/');
        expect(redirectLama('HEAD', 'beranda-absol')).toBe('/');
        expect(redirectLama('DELETE', 'katalog/kantor-balai')).toBe('/katalog');
        expect(redirectLama('OPTIONS', 'lacak-tiket')).toBe('/lacak');
        expect(redirectLama('GET', 'pengaduan')).toBe('/pengaduan/baru');
        expect(redirectLama('PUT', 'pengaduan')).toBe('/pengaduan/baru');
        expect(redirectLama('POST', 'pengaduan')).toBeNull();
        expect(redirectLama('GET', 'pengaduan/baru')).toBeNull();
        expect(redirectLama('GET', 'Beranda-Baru')).toBeNull();
        expect(redirectLama('GET', 'lacak-tiket/survei')).toBeNull();
        expect(redirectLama('GET', 'constructor')).toBeNull();
    });

    it('301, Location (dibuat relatif oleh adapter proxy Next.js untuk host yang sama), tanpa Cache-Control', () => {
        const r = respons301('/pengaduan/baru', 'http://cc.test/pengaduan?x=1');
        expect(r.status).toBe(301);
        expect(r.headers.get('location')).toBe('http://cc.test/pengaduan/baru');
        expect(r.headers.get('cache-control')).toBeNull();
    });

    const alasan = cekLaravel();
    it.skipIf(!!alasan)(`RedirectResponse Symfony 301 memang tanpa Cache-Control${alasan ? ` — dilewati: ${alasan}` : ''}`, () => {
        const kode = String.raw`require 'vendor/autoload.php';
echo json_encode((new Symfony\Component\HttpFoundation\RedirectResponse('/', 301))->headers->get('Cache-Control'));`;
        const php = spawnSync('php', ['-r', kode], { cwd: resolve('../sigap'), encoding: 'utf8' });
        expect(JSON.parse(php.stdout)).toBeNull();
    });
});
