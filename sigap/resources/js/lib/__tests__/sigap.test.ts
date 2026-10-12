import {
    isLegacyTicketNo,
    isValidTicketNo,
    normalizeTicketNo,
    PRIORITY_LABELS,
    STATUS_CLASSES,
    STATUS_LABELS,
    TICKET_ALPHABET,
    TICKET_NO_EXAMPLE,
} from '@/lib/sigap';
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

describe('nomor tiket', () => {
    it('menerima format baru TKT-YYMMDD-XXXXXX', () => {
        expect(isValidTicketNo('TKT-261012-7KQ4MZ')).toBe(true);
        expect(isValidTicketNo(TICKET_NO_EXAMPLE)).toBe(true);
    });

    it('menerima format lama TKT-<angka>', () => {
        expect(isValidTicketNo('TKT-1')).toBe(true);
        expect(isValidTicketNo('TKT-9920')).toBe(true);
    });

    it('tidak peka huruf besar/kecil & spasi di tepi', () => {
        expect(isValidTicketNo('  tkt-261012-7kq4mz ')).toBe(true);
        expect(normalizeTicketNo('  tkt-261012-7kq4mz ')).toBe('TKT-261012-7KQ4MZ');
    });

    it('menolak karakter ambigu & format salah', () => {
        expect(isValidTicketNo('TKT-261012-0OIL1A')).toBe(false);
        expect(isValidTicketNo('TKT-26101-7KQ4MZ')).toBe(false);
        expect(isValidTicketNo('TKT-261012-7KQ4M')).toBe(false);
        expect(isValidTicketNo('ABC-123')).toBe(false);
        expect(isValidTicketNo('')).toBe(false);
    });

    it('alfabet sufiks berisi 31 karakter tanpa 0/1/I/L/O', () => {
        expect(TICKET_ALPHABET).toHaveLength(31);
        expect(TICKET_ALPHABET).not.toMatch(/[01ILO]/);
    });
});

describe('isLegacyTicketNo', () => {
    it('mengenali nomor format lama yang butuh kode akses', () => {
        expect(isLegacyTicketNo('TKT-42')).toBe(true);
        expect(isLegacyTicketNo(' tkt-123 ')).toBe(true);
        expect(isLegacyTicketNo('TKT-261012-7KQ4MZ')).toBe(false);
        expect(isLegacyTicketNo('TKT-12345678901')).toBe(false);
    });
});
