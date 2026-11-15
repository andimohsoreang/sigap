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

    it.each([' \n', 'null', '(null)', 'EMPTY', 'true', '(false)'])('kunci kosong / sentinel env() %j ditolak', (nilai) => {
        expect(() => kunciNik(nilai)).toThrow('NIK_HASH_KEY belum diatur');
    });

    it('kunci < 32 byte ditolak, termasuk base64 yang ter-decode pendek', () => {
        expect(() => kunciNik('kunci-pendek')).toThrow('minimal 32 byte');
        expect(() => kunciNik('base64:' + Buffer.alloc(31).toString('base64'))).toThrow('minimal 32 byte');
        expect(kunciNik('k'.repeat(32))).toHaveLength(32);
    });
});
