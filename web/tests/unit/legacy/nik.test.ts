import { describe, expect, it } from 'vitest';

import { hashNik, kunciNik, maskNik, miripNik } from '@/server/legacy/nik';

import { fixture, type FixtureNik } from './fixture';

const f = fixture<FixtureNik>('nik.json');

describe('nik: vektor App\\Support\\Nik', () => {
    for (const [label, nilai] of Object.entries(f.kunci_nik)) {
        it(`hashNik dengan kunci ${label}`, () => {
            const kunci = kunciNik(nilai);
            for (const k of f.kasus) expect(hashNik(k.nik, kunci), JSON.stringify(k.nik)).toBe(k.hash[label]);
        });
    }

    it.each(f.kasus)('maskNik & miripNik $nik', ({ nik, mask, mirip_nik }) => {
        expect(maskNik(nik)).toBe(mask);
        if (nik !== null) expect(miripNik(nik)).toBe(mirip_nik);
    });

    it('kunci kosong ditolak (produksi wajib NIK_HASH_KEY)', () => {
        expect(() => kunciNik(' \n')).toThrow('NIK_HASH_KEY');
    });
});
