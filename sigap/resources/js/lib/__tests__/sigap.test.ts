import { PRIORITY_LABELS, STATUS_CLASSES, STATUS_LABELS } from '@/lib/sigap';
import { describe, expect, it } from 'vitest';

/**
 * Paritas label dengan UI lama — nilai ini tampil di tabel tiket, matriks,
 * portal warga, dan halaman lacak.
 */
describe('STATUS_LABELS', () => {
    it('memuat kelima status tiket', () => {
        expect(Object.keys(STATUS_LABELS).sort()).toEqual(['baru', 'diproses', 'ditolak', 'selesai', 'verifikasi']);
    });

    it('label yang ditampilkan sesuai UI lama', () => {
        expect(STATUS_LABELS.baru).toBe('Menunggu');
        expect(STATUS_LABELS.selesai).toBe('Selesai');
    });

    it('setiap status punya kelas warna (light & dark)', () => {
        for (const key of Object.keys(STATUS_LABELS)) {
            const classes = STATUS_CLASSES[key];

            expect(classes).toBeTruthy();
            expect(classes).toContain('dark:');
        }
    });
});

describe('PRIORITY_LABELS', () => {
    it('memetakan dampak ke prioritas (PRD §6.1)', () => {
        expect(PRIORITY_LABELS.umum).toBe('Umum');
        expect(PRIORITY_LABELS.prioritas).toBe('Prioritas');
        expect(PRIORITY_LABELS.darurat).toBe('Darurat');
    });
});
