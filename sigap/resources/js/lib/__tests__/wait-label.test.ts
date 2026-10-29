import { describe, expect, it } from 'vitest';

import { POLL_TYPING_MS, WAIT_STAGES, waitLabelFor } from '@/components/sigap/live-chat-widget';

describe('label tunggu TARA (PRD-AI FR-AI-04)', () => {
    it('mulai dengan "sedang mengetik"', () => {
        expect(waitLabelFor(0)).toBe('TARA sedang mengetik…');
        expect(waitLabelFor(2999)).toBe('TARA sedang mengetik…');
    });

    it('beralih ke pencarian sumber setelah 3 detik', () => {
        expect(waitLabelFor(3000)).toBe('TARA sedang mencari di sumber resmi…');
        expect(waitLabelFor(14999)).toBe('TARA sedang mencari di sumber resmi…');
    });

    it('menampilkan "masih menyiapkan jawaban" setelah 15 detik tanpa balasan', () => {
        expect(waitLabelFor(15000)).toBe('TARA masih menyiapkan jawaban, mohon tunggu sebentar…');
        expect(waitLabelFor(60000)).toBe('TARA masih menyiapkan jawaban, mohon tunggu sebentar…');
    });

    it('tahap terurut dan polling saat menunggu cukup rapat', () => {
        expect(WAIT_STAGES.map((s) => s.after)).toEqual([0, 3000, 15000]);
        expect(POLL_TYPING_MS).toBeLessThanOrEqual(2000);
    });
});
