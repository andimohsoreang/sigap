import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BERKAS, ruteZiggyLaravel } from '../../../scripts/rute-ziggy.mjs';
import { berkasPublik, DIR, jalurWeb, SALINAN, tulisUlang } from '../../../scripts/salinan-sigap.mjs';
import { cekLaravel } from '../db/laravel';

// Penjaga salinan: komponen & berkas publik di web/ harus identik dengan sigap/ (selain penulisan ulang impor yang
// diizinkan scripts/salinan-sigap.mjs). Bila gagal: sumber Laravel berubah (perbaikan bug yang ikut di-port) →
// `node scripts/salinan-sigap.mjs salin`; atau salinan diedit tangan → kembalikan, ubah di sigap/ dulu.

const sha = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex');

describe('salinan sigap/resources/js', () => {
    it.each(SALINAN)('%s', (rel) => {
        const sumber = readFileSync(join(DIR.sigap, 'resources/js', rel), 'utf8');
        expect(readFileSync(join(DIR.web, jalurWeb(rel)), 'utf8')).toBe(tulisUlang(sumber, rel));
    });

    it('penulisan ulang hanya jalur impor & use client', () => {
        expect(tulisUlang("import { Link } from '@inertiajs/react';\nimport T from '@/components/sigap/tara-shell';\n", 'pages/public/x.tsx')).toBe(
            "'use client';\n\nimport { Link } from '@/lib/inertia';\nimport T from '@/components/contact-center/tara-shell';\n",
        );
        expect(jalurWeb('lib/sigap.ts')).toBe('src/lib/contact-center.ts');
    });
});

describe('salinan sigap/public (byte-identik, rencana §8.1)', () => {
    it('semua berkas publik Laravel ada & sama', () => {
        const beda = berkasPublik().filter((f: string) => sha(join(DIR.sigap, 'public', f)) !== sha(join(DIR.web, 'public', f)));
        expect(beda).toEqual([]);
        expect(berkasPublik().length).toBeGreaterThan(70);
    });
});

const alasan = cekLaravel();
describe.skipIf(!!alasan)(`ziggy-rute.json = php artisan ziggy:generate per grup${alasan ? ` — dilewati: ${alasan}` : ''}`, () => {
    it('sama dengan Laravel asli', { timeout: 60_000 }, () => {
        expect(JSON.parse(readFileSync(BERKAS, 'utf8'))).toEqual(ruteZiggyLaravel());
    });
});
