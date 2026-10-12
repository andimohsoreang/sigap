import { cn } from '@/lib/utils';
import { describe, expect, it } from 'vitest';

describe('cn', () => {
    it('menggabungkan class sederhana', () => {
        expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
    });

    it('mengabaikan nilai falsy', () => {
        expect(cn('px-2', false, undefined, null, 'py-1')).toBe('px-2 py-1');
    });

    it('class tailwind terakhir menang saat konflik', () => {
        expect(cn('px-2', 'px-4')).toBe('px-4');
        expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });

    it('mendukung objek kondisional', () => {
        expect(cn('base', { aktif: true, nonaktif: false })).toBe('base aktif');
    });
});
