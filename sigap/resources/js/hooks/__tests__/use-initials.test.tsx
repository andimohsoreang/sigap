import { useInitials } from '@/hooks/use-initials';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('useInitials', () => {
    it('mengambil inisial dua kata', () => {
        const { result } = renderHook(() => useInitials());

        expect(result.current('Budi Santoso')).toBe('BS');
    });

    it('memakai huruf pertama untuk nama satu kata', () => {
        const { result } = renderHook(() => useInitials());

        expect(result.current('Transmigrasi')).toBe('T');
    });

    it('memakai kata pertama dan terakhir untuk nama panjang', () => {
        const { result } = renderHook(() => useInitials());

        expect(result.current('Andi Mohamad Raden')).toBe('AR');
    });

    it('menghormati spasi berlebih', () => {
        const { result } = renderHook(() => useInitials());

        expect(result.current('  Siti   Aminah  ')).toBe('SA');
    });
});
