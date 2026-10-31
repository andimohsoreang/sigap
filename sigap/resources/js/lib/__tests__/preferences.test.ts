import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Modul menyimpan salinan di memori: dimuat ulang per tes. */
async function load() {
    vi.resetModules();
    return import('@/lib/preferences');
}

/** Node 25 punya localStorage bawaan yang tidak lengkap; pakai tiruan di memori. */
function memoryStorage(): Storage {
    const data = new Map<string, string>();
    return {
        get length() {
            return data.size;
        },
        clear: () => data.clear(),
        getItem: (k: string) => data.get(k) ?? null,
        key: (i: number) => [...data.keys()][i] ?? null,
        removeItem: (k: string) => void data.delete(k),
        setItem: (k: string, v: string) => void data.set(k, String(v)),
    };
}

function mockSystemDark(dark: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: dark && query.includes('dark'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
}

describe('preferensi tema & aksesibilitas', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', memoryStorage());
        document.documentElement.className = '';
        document.head.querySelectorAll('link[data-cc-font]').forEach((l) => l.remove());
        mockSystemDark(false);
    });

    it('bawaan: terang, tanpa pengaturan aksesibilitas, tanpa kelas', async () => {
        const p = await load();
        p.applyPreferences();

        expect(p.getTheme()).toBe('light');
        expect(p.getA11y()).toEqual(p.DEFAULT_A11Y);
        expect(document.documentElement.className).toBe('');
    });

    it('mode gelap tersimpan dan memasang kelas dark; terang menghapus kunci', async () => {
        const p = await load();

        p.setTheme('dark');
        expect(localStorage.getItem(p.THEME_KEY)).toBe('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);

        p.setTheme('light');
        expect(localStorage.getItem(p.THEME_KEY)).toBeNull();
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('"Ikuti sistem" mengikuti prefers-color-scheme', async () => {
        mockSystemDark(true);
        const p = await load();

        p.setTheme('system');

        expect(p.isDark()).toBe(true);
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('pengaturan aksesibilitas menjadi kelas di <html> dan memuat huruf disleksia sekali', async () => {
        const p = await load();

        p.setA11y({ text: 2, contrast: true, dyslexia: true });
        p.setA11y({ gray: true });

        const cls = document.documentElement.classList;
        expect(['a11y-text-2', 'a11y-contrast', 'a11y-dyslexia', 'a11y-gray'].every((c) => cls.contains(c))).toBe(true);
        expect(cls.contains('a11y-text-1')).toBe(false);
        expect(document.head.querySelectorAll('link[data-cc-font]')).toHaveLength(1);
        expect(JSON.parse(localStorage.getItem(p.A11Y_KEY)!)).toMatchObject({ text: 2, contrast: true, dyslexia: true, gray: true });
    });

    it('atur ulang menghapus semua kelas dan kunci penyimpanan', async () => {
        const p = await load();
        p.setA11y({ links: true, motion: true, focus: true });

        p.resetA11y();

        expect(localStorage.getItem(p.A11Y_KEY)).toBeNull();
        expect([...document.documentElement.classList].filter((c) => c.startsWith('a11y-'))).toEqual([]);
    });

    it('nilai tersimpan yang rusak diabaikan', async () => {
        localStorage.setItem('cc-a11y', '{"text":7,"contrast":"ya","links":true');
        localStorage.setItem('cc-theme', 'ungu');
        const p = await load();

        expect(p.getTheme()).toBe('light');
        expect(p.getA11y()).toEqual(p.DEFAULT_A11Y);
    });

    it('nilai sebagian dipakai, sisanya bawaan', async () => {
        localStorage.setItem('cc-a11y', JSON.stringify({ text: 1, links: true, contrast: 'ya' }));
        const p = await load();

        expect(p.getA11y()).toEqual({ ...p.DEFAULT_A11Y, text: 1, links: true });
    });
});
