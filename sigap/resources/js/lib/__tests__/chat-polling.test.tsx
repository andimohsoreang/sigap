import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    POLL_TYPING_FAST_FOR_MS,
    POLL_TYPING_FAST_MS,
    POLL_TYPING_SLOW_MS,
    typingPollInterval,
    useChatPolling,
} from '@/components/sigap/live-chat-widget';

/** Batas limiter `chat-baca` per sesi (AppServiceProvider). */
const CHAT_READ_LIMIT_PER_MINUTE = 30;

describe('jeda polling saat TARA menyiapkan jawaban', () => {
    it('1,5 dtk selama 15 dtk pertama, lalu 4 dtk', () => {
        expect(typingPollInterval(0)).toBe(1500);
        expect(typingPollInterval(14999)).toBe(1500);
        expect(typingPollInterval(15000)).toBe(4000);
        expect(typingPollInterval(120000)).toBe(4000);
        expect([POLL_TYPING_FAST_MS, POLL_TYPING_SLOW_MS, POLL_TYPING_FAST_FOR_MS]).toEqual([1500, 4000, 15000]);
    });
});

describe('useChatPolling', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('menunggu jawaban selama semenit tetap di bawah batas chat-baca', () => {
        const tick = vi.fn();
        renderHook(() => useChatPolling(true, true, 5000, tick));

        vi.advanceTimersByTime(15000);
        expect(tick).toHaveBeenCalledTimes(10); // 1,5 dtk × 10

        vi.advanceTimersByTime(45000);
        expect(tick.mock.calls.length).toBeLessThan(CHAT_READ_LIMIT_PER_MINUTE);
        expect(tick).toHaveBeenCalledTimes(21); // + 4 dtk × 11
    });

    it('tanpa mengetik memakai jeda biasa', () => {
        const tick = vi.fn();
        renderHook(() => useChatPolling(true, false, 5000, tick));

        vi.advanceTimersByTime(60000);
        expect(tick).toHaveBeenCalledTimes(12);
    });

    it('hitungan 15 dtk mulai ulang setiap kali TARA mulai menyiapkan jawaban', () => {
        const tick = vi.fn();
        const { rerender } = renderHook(({ typing }) => useChatPolling(true, typing, 5000, tick), { initialProps: { typing: true } });

        vi.advanceTimersByTime(30000); // sudah di tahap 4 dtk
        rerender({ typing: false });
        rerender({ typing: true });
        tick.mockClear();

        vi.advanceTimersByTime(4500);
        expect(tick).toHaveBeenCalledTimes(3); // kembali 1,5 dtk
    });

    it('tidak memanggil saat tab tersembunyi atau belum ada percakapan', () => {
        const tick = vi.fn();
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
        renderHook(() => useChatPolling(true, true, 5000, tick));
        vi.advanceTimersByTime(10000);
        expect(tick).not.toHaveBeenCalled();

        const idle = vi.fn();
        renderHook(() => useChatPolling(false, true, 5000, idle));
        vi.advanceTimersByTime(10000);
        expect(idle).not.toHaveBeenCalled();
    });
});
