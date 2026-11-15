import { describe, expect, it } from 'vitest';

import { metadata } from '@/app/layout';
import { judul } from '@/lib/judul';

describe('judul', () => {
    it('memakai template root layout seperti app.tsx', () => {
        expect(metadata.title).toEqual({ default: 'Contact Center', template: '%s - Contact Center' });
        expect(judul('Lacak Pengaduan')).toBe('Lacak Pengaduan');
    });

    it('tidak memberi akhiran ganda bila judul sudah memuat nama aplikasi', () => {
        expect(judul('Peta — Contact Center')).toEqual({ absolute: 'Peta — Contact Center' });
    });
});
