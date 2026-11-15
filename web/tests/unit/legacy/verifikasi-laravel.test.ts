import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { enkripsiCookie } from '@/server/legacy/cookie';
import { enkripsi } from '@/server/legacy/laravel-crypt';
import { DesimalPhp, serialize, unserialize, type NilaiPhp } from '@/server/legacy/php-serial';
import { hashSandi } from '@/server/legacy/sandi';
import { bacaSesi, hashSandiUntukSesi, KUNCI_LOGIN, NAMA_COOKIE_SESI, perbaruiKunci } from '@/server/legacy/sesi';

import { DIR_SIGAP, fixture, kunciUji, type FixtureCookie, type FixtureEnkripsi, type FixtureSerial, type FixtureSesi } from './fixture';

// Arah tulis: TS menulis ciphertext/cookie/sesi/bcrypt, Laravel asli (`cc:ekspor-fixture-kripto --verifikasi`) membacanya.
// Hanya lewat `npm run test:laravel`; butuh PHP + sigap/vendor (composer install).

const diminta = process.env.CC_TEST_LARAVEL === '1';
const siap = spawnSync('php', ['-v']).status === 0 && existsSync(join(DIR_SIGAP, 'vendor/autoload.php'));

// Diminta lewat `npm run test:laravel` tetapi PHP/vendor tidak ada → GAGAL, bukan dilewati diam-diam.
describe.runIf(diminta && !siap)('verifikasi tulisan TS oleh Laravel asli', () => {
    it('membutuhkan PHP dan sigap/vendor (composer install di sigap/)', () => {
        expect.fail('npm run test:laravel butuh `php` di PATH dan sigap/vendor (jalankan composer install di sigap/)');
    });
});

async function sesiDariTs() {
    const f = fixture<FixtureSesi>('sesi.json');
    const kunci = kunciUji(f);
    const hasil = [];
    for (const label of ['warga', 'admin', 'tamu_chat']) {
        const k = f.kasus.find((x) => x.label === label)!;
        const sesi = (await bacaSesi({
            cookieHeader: `${NAMA_COOKIE_SESI}=${encodeURIComponent(k.cookie)}`,
            kunci,
            muat: async () => k.baris,
            sekarang: f.sekarang,
        }))!;
        const flash = { success: `Dari Next.js: ${label} ñ` };
        const simpan: Record<string, NilaiPhp> = k.user_hash ? { password_hash_web: hashSandiUntukSesi(k.user_hash, kunci) } : {};
        const { data, payload } = perbaruiKunci(sesi.data, { simpan, flash }, kunci);
        hasil.push({
            id: sesi.id,
            cookie: enkripsiCookie(NAMA_COOKIE_SESI, sesi.id, kunci),
            payload,
            serial: serialize(data),
            user_hash: k.user_hash,
            user_id: sesi.userId,
            flash,
        });
    }

    // Sesi baru sepenuhnya dari TS (login warga), id 40 alfanumerik.
    const id = 'NextJs'.padEnd(40, '0');
    const userHash = await hashSandi('sandi-dari-next');
    const data = new Map<number | string, NilaiPhp>([
        ['_token', 'T'.repeat(40)],
        [KUNCI_LOGIN, 202],
        ['password_hash_web', hashSandiUntukSesi(userHash, kunci)],
    ]);
    const baru = perbaruiKunci(data, { flash: { status: 'Akun aktif.' } }, kunci);
    hasil.push({
        id,
        cookie: enkripsiCookie(NAMA_COOKIE_SESI, id, kunci),
        payload: baru.payload,
        serial: serialize(baru.data),
        user_hash: userHash,
        user_id: 202,
        flash: { status: 'Akun aktif.' },
    });
    return hasil;
}

describe.runIf(diminta && siap)('verifikasi tulisan TS oleh Laravel asli', () => {
    it('Laravel membaca semua ciphertext, cookie, sesi, bcrypt, dan serial dari TS', { timeout: 180_000 }, async () => {
        const fe = fixture<FixtureEnkripsi>('enkripsi.json');
        const fc = fixture<FixtureCookie>('cookie.json');
        const kunci = kunciUji(fe);
        const plaintext = [...new Set(fe.kasus.map((k) => k.plaintext))];

        const nilaiTs: NilaiPhp[] = [
            0.1,
            1e15,
            new DesimalPhp(1e17),
            new DesimalPhp(-0),
            1.5e-7,
            123.456,
            new DesimalPhp(3),
            'Sukamaju — ñ 中文 🙂 a";s:1:"b',
            new Map<number | string, NilaiPhp>([
                ['b', true],
                [5, null],
                [
                    'nested',
                    new Map<number | string, NilaiPhp>([
                        [0, 'x'],
                        [1, new DesimalPhp(-2.5e-10)],
                    ]),
                ],
            ]),
        ];

        const masukan = {
            enkripsi: plaintext.map((p) => ({ plaintext: p, payload: enkripsi(p, kunci) })),
            cookie: fc.kasus.map(({ nama, nilai }) => ({ nama, nilai, terenkripsi: enkripsiCookie(nama, nilai, kunci) })),
            sandi: await Promise.all(
                ['rahasia123', 'Kata Sandi ñ 🙂', 'b'.repeat(80)].map(async (sandi) => ({ sandi, hash: await hashSandi(sandi) })),
            ),
            serial: [
                ...nilaiTs.map((v) => ({ serial: serialize(v) })),
                ...fixture<FixtureSerial>('serial.json').kasus.map((k) => ({ serial: serialize(unserialize(k.serial)) })),
                // Termasuk sesi ber-ViewErrorBag: byte objek mentah harus tetap sah bagi unserialize PHP.
                ...fixture<FixtureSesi>('sesi.json').kasus.map((k) => ({ serial: serialize(unserialize(k.serial)) })),
            ],
            sesi: await sesiDariTs(),
        };

        const dir = mkdtempSync(join(tmpdir(), 'cc-verifikasi-'));
        try {
            const berkas = join(dir, 'masukan.json');
            writeFileSync(berkas, JSON.stringify(masukan));
            const r = spawnSync('php', ['artisan', 'cc:ekspor-fixture-kripto', '--env=testing', `--verifikasi=${berkas}`], {
                cwd: DIR_SIGAP,
                encoding: 'utf8',
            });
            const baris = r.stdout.trim().split('\n').at(-1) ?? '';
            expect(r.stderr, r.stdout).toBe('');
            const hasil = JSON.parse(baris) as { lulus: number; gagal: string[] };
            expect(hasil.gagal).toEqual([]);
            expect(hasil.lulus).toBeGreaterThan(50);
            expect(r.status).toBe(0);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
