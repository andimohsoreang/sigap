import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { enkripsi } from '@/server/legacy/laravel-crypt';
import { hashSandi, tutupPoolSandi } from '@/server/legacy/sandi';

import { DIR_SIGAP, fixture, kunciUji, type FixtureEnkripsi } from './fixture';

// Arah tulis: TS menulis ciphertext & bcrypt, Laravel asli (`cc:ekspor-fixture-kripto --verifikasi`) membacanya.
// Hanya lewat `npm run test:laravel`; butuh PHP + sigap/vendor (composer install).

const diminta = process.env.CC_TEST_LARAVEL === '1';
const siap = spawnSync('php', ['-v']).status === 0 && existsSync(join(DIR_SIGAP, 'vendor/autoload.php'));

// Diminta lewat `npm run test:laravel` tetapi PHP/vendor tidak ada → GAGAL, bukan dilewati diam-diam.
describe.runIf(diminta && !siap)('verifikasi tulisan TS oleh Laravel asli', () => {
    it('membutuhkan PHP dan sigap/vendor (composer install di sigap/)', () => {
        expect.fail('npm run test:laravel butuh `php` di PATH dan sigap/vendor (jalankan composer install di sigap/)');
    });
});

describe.runIf(diminta && siap)('verifikasi tulisan TS oleh Laravel asli', () => {
    afterAll(() => tutupPoolSandi());

    it('Laravel membaca ciphertext dan bcrypt dari TS', { timeout: 180_000 }, async () => {
        const fe = fixture<FixtureEnkripsi>('enkripsi.json');
        const kunci = kunciUji(fe);
        const plaintext = [...new Set(fe.kasus.map((k) => k.plaintext))];
        const sandi = ['rahasia123', 'Kata Sandi ñ 🙂', 'b'.repeat(80)];

        const masukan = {
            enkripsi: plaintext.map((p) => ({ plaintext: p, payload: enkripsi(p, kunci) })),
            sandi: await Promise.all(sandi.map(async (s) => ({ sandi: s, hash: await hashSandi(s) }))),
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
            // Satu per plaintext + empat cek per hash bcrypt.
            expect(hasil.lulus).toBe(plaintext.length + sandi.length * 4);
            expect(r.status).toBe(0);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
